import { OAuth2Client } from "google-auth-library";
import crypto from "node:crypto";
import {
  clearSessionCookie,
  createSessionToken,
  publicUser,
  readSession,
  resolveAuthorizedUser,
  sessionCookie,
} from "./_auth.js";

const LOGIN_CSRF_COOKIE = "pineapple_login_csrf";

function cookieValue(req, name) {
  const item = String(req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

function csrfMatches(req, token) {
  const cookie = Buffer.from(cookieValue(req, LOGIN_CSRF_COOKIE));
  const submitted = Buffer.from(String(token || ""));
  return cookie.length > 0 && cookie.length === submitted.length && crypto.timingSafeEqual(cookie, submitted);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const user = readSession(req);
    const csrfToken = crypto.randomBytes(24).toString("base64url");
    res.setHeader("Set-Cookie", `${LOGIN_CSRF_COOKIE}=${csrfToken}; Secure; SameSite=Strict; Path=/api/session; Max-Age=600`);
    return res.status(200).json({
      success: true,
      authenticated: Boolean(user),
      googleClientId: process.env.GOOGLE_CLIENT_ID || "",
      forecastPeriod: process.env.DEFAULT_FORECAST_PERIOD || "",
      csrfToken,
      user: publicUser(user),
    });
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearSessionCookie());
    return res.status(200).json({ success: true });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    if (!clientId) return res.status(503).json({ success: false, message: "GOOGLE_CLIENT_ID is not configured." });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (!csrfMatches(req, body.csrfToken)) return res.status(403).json({ success: false, message: "Invalid login request." });
    const credential = String(body.credential || "");
    if (!credential) return res.status(400).json({ success: false, message: "Missing Google credential." });

    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      return res.status(401).json({ success: false, message: "Google account could not be verified." });
    }

    const user = resolveAuthorizedUser(profile);
    if (!user) return res.status(403).json({ success: false, message: "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน Smart Pineapple" });
    res.setHeader("Set-Cookie", sessionCookie(createSessionToken(user)));
    return res.status(200).json({ success: true, authenticated: true, forecastPeriod: process.env.DEFAULT_FORECAST_PERIOD || "", user: publicUser(user) });
  } catch (error) {
    return res.status(401).json({ success: false, message: "ไม่สามารถยืนยันบัญชี Google ได้", detail: error instanceof Error ? error.message : String(error) });
  }
}
