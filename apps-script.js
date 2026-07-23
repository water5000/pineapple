import { isMutationAllowed, readSession, requestContext } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const user = readSession(req);
    const appsScriptUrl = String(process.env.APPS_SCRIPT_URL || "").trim();
    const requestBody =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const apiSecret = String(process.env.API_SECRET || "").trim();
    const action = String(requestBody.action || "");
    const publicReadActions = new Set(["getPublicOverview", "getPublicDashboardData"]);
    const isPublicRead = publicReadActions.has(action);
    if (!user && !isPublicRead) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!isPublicRead && !isMutationAllowed(user, action)) {
      return res.status(403).json({ success: false, message: "บัญชีนี้มีสิทธิ์ดูรายงานเท่านั้น" });
    }
    if (!appsScriptUrl || !apiSecret) {
      return res.status(503).json({ success: false, message: "APPS_SCRIPT_URL or API_SECRET is not configured." });
    }
    const payload = requestBody.payload && typeof requestBody.payload === "object" ? requestBody.payload : {};
    const publicStation = String(process.env.PUBLIC_STATION || "").trim();
    if (isPublicRead && !publicStation) {
      return res.status(503).json({ success: false, message: "PUBLIC_STATION is not configured." });
    }
    const context = isPublicRead
      ? { email: "public-overview@system.local", name: "ผู้ใช้ทั่วไป", role: "viewer", station: publicStation }
      : requestContext(user);

    const upstream = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload, requestContext: context, apiSecret }),
    });

    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      const looksLikeHtmlApp =
        text.includes("google.script.run") || text.includes("userCodeAppPanel");
      const detail = text
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 800);

      return res.status(502).json({
        success: false,
        message: looksLikeHtmlApp
          ? "Apps Script URL ยังเป็นหน้าเว็บ HTML ไม่ใช่ API JSON กรุณา redeploy Apps Script เป็น Web app เวอร์ชันใหม่"
          : "Apps Script ส่งข้อมูลกลับมาไม่สมบูรณ์ กรุณาตรวจสอบเวอร์ชันที่เผยแพร่",
        detail,
        status: upstream.status,
        contentType: upstream.headers.get("content-type") || "",
      });
    }

    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
