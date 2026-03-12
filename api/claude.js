// api/claude.js — Vercel serverless function
// Proxies requests to Anthropic so the API key never touches the browser.
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Basic rate-limit hint via Vercel edge (optional — Vercel free tier already limits)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { messages, system, max_tokens = 1000 } = req.body;

    // Validate input shape
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages" });
    }

    // Cap to prevent abuse
    const cappedMessages = messages.slice(-20);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens,
        system,
        messages: cappedMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(response.status).json({ error: "AI service error" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    console.error("Proxy error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
