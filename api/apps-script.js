const FALLBACK_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxzmGy5hPVrMwtm5teS-wG8ItEq8mnGoF0B8JonPiRS75efn7iqarCISUuCR0U80t9Q/exec";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const appsScriptUrl = process.env.APPS_SCRIPT_URL || FALLBACK_APPS_SCRIPT_URL;
    const upstream = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
    });

    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        success: false,
        message: "Apps Script returned a non-JSON response.",
        detail: text.slice(0, 500),
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
