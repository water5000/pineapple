import crypto from "node:crypto";

const COOKIE_NAME = "pineapple_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return secret;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(req) {
  return String(req.headers.cookie || "").split(";").reduce((cookies, item) => {
    const separator = item.indexOf("=");
    if (separator < 0) return cookies;
    cookies[item.slice(0, separator).trim()] = decodeURIComponent(item.slice(separator + 1).trim());
    return cookies;
  }, {});
}

export function createSessionToken(user) {
  const payload = encode({
    sub: user.sub,
    email: user.email,
    name: user.name,
    role: user.role,
    station: user.station,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
  return `${payload}.${sign(payload)}`;
}

export function readSession(req) {
  try {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!user.exp || user.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!user.email || !["operator", "viewer", "admin"].includes(user.role)) return null;
    const configured = configuredUsers().find(item => item.email === String(user.email).toLowerCase());
    if (!configured) return null;
    return {
      ...user,
      name: configured.name || user.name || user.email,
      role: configured.role,
      station: configured.role === "admin" ? (configured.station || "*") : configured.station,
    };
  } catch {
    return null;
  }
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function configuredUsers() {
  let parsed;
  try {
    parsed = JSON.parse(process.env.APP_USERS_JSON || "[]");
  } catch {
    throw new Error("APP_USERS_JSON is not valid JSON.");
  }
  const users = Array.isArray(parsed)
    ? parsed
    : Object.entries(parsed).map(([email, value]) => ({ email, ...(value || {}) }));
  return users.map(user => ({
    email: String(user.email || "").trim().toLowerCase(),
    name: String(user.name || "").trim(),
    role: ["operator", "viewer", "admin"].includes(user.role) ? user.role : "viewer",
    station: String(user.station || "").trim(),
  })).filter(user => user.email && (user.station || user.role === "admin"));
}

export function resolveAuthorizedUser(googleProfile) {
  const email = String(googleProfile.email || "").toLowerCase();
  const configured = configuredUsers().find(user => user.email === email);
  if (!configured) return null;
  return {
    sub: googleProfile.sub,
    email,
    name: configured.name || googleProfile.name || email,
    role: configured.role,
    station: configured.role === "admin" ? (configured.station || "*") : configured.station,
  };
}

export function publicUser(user) {
  if (!user) return null;
  return { email: user.email, name: user.name, role: user.role, station: user.station };
}

export function requestContext(user) {
  return { email: user.email, name: user.name, role: user.role, station: user.station };
}

export function isMutationAllowed(user, action) {
  const readActions = new Set(["getDashboardData", "getMLModelStatus"]);
  if (action === "trainMLModels") return user.role === "admin";
  return readActions.has(action) || user.role === "operator" || user.role === "admin";
}
