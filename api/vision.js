const MODEL = process.env.VISION_MODEL || "claude-sonnet-5-5";
const MAX_B64 = 4 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "server_not_configured" });

  const content = req.body?.messages?.[0]?.content;
  const img = Array.isArray(content) ? content.find((c) => c.type === "image") : null;
  const txt = Array.isArray(content) ? content.find((c) => c.type === "text") : null;
  const data = img?.source?.data;
  if (req.body?.messages?.length !== 1 || !txt || img?.source?.media_type !== "image/jpeg" || typeof data !== "string")
    return res.status(400).json({ error: "bad_request" });
  if (data.length > MAX_B64) return res.status(413).json({ error: "too_large" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        messages: [{ role: "user", content: [img, { type: "text", text: String(txt.text).slice(0, 6000) }] }],
      }),
      signal: AbortSignal.timeout(25000),
    });
    const retry = r.headers.get("retry-after");
    if (retry) res.setHeader("retry-after", retry);
    res.status(r.status).setHeader("content-type", "application/json").send(await r.text());
  } catch (e) {
    res.status(504).json({ error: "upstream_timeout" });
  }
};
