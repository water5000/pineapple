const FALLBACK_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxzmGy5hPVrMwtm5teS-wG8ItEq8mnGoF0B8JonPiRS75efn7iqarCISUuCR0U80t9Q/exec";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const appsScriptUrl = process.env.APPS_SCRIPT_URL || FALLBACK_APPS_SCRIPT_URL;
    const requestBody =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const apiSecret = process.env.API_SECRET || "";

    const upstream = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...requestBody, apiSecret }),
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
          : "Apps Script returned a non-JSON response.",
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
