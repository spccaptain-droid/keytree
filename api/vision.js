const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_B64 = 4 * 1024 * 1024;

module.exports = async (req, res) => {
  const key = process.env.GEMINI_API_KEY;

  if (req.method === "GET") return res.status(200).json({ version: "gemini-v2", model: MODEL, keyConfigured: Boolean(key) });
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!key) {
    console.error("GEMINI_API_KEY 환경변수가 없습니다. Vercel > Settings > Environment Variables 확인 후 Redeploy 하세요.");
    return res.status(401).json({ error: "api_key_missing" });
  }

  const content = req.body?.messages?.[0]?.content;
  const img = Array.isArray(content) ? content.find((c) => c.type === "image") : null;
  const txt = Array.isArray(content) ? content.find((c) => c.type === "text") : null;
  const data = img?.source?.data;
  if (req.body?.messages?.length !== 1 || !txt || img?.source?.media_type !== "image/jpeg" || typeof data !== "string")
    return res.status(400).json({ error: "bad_request" });
  if (data.length > MAX_B64) return res.status(413).json({ error: "too_large" });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ inline_data: { mime_type: "image/jpeg", data } }, { text: String(txt.text).slice(0, 6000) }],
            },
          ],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );
    const retry = r.headers.get("retry-after");
    if (retry) res.setHeader("retry-after", retry);

    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Gemini 오류", r.status, json?.error?.status, json?.error?.message);
      const bad = r.status === 400 && /api key/i.test(json?.error?.message || "");
      return res.status(bad ? 401 : r.status).json({ error: json?.error?.status || "upstream_error" });
    }
    const text = (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    if (!text) {
      console.error("Gemini 빈 응답", JSON.stringify(json).slice(0, 300));
      return res.status(502).json({ error: "empty_response" });
    }
    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) {
    console.error("vision 함수 오류", e && e.message);
    return res.status(504).json({ error: "upstream_timeout" });
  }
};
