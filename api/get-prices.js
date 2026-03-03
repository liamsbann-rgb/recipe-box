export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No items provided" });
  }

  const itemList = items.map((item, i) => `${i}: ${item}`).join("\n");
  const prompt = `You are a grocery price estimator. For each item below, search the web for current typical US grocery store prices (check sites like Instacart, Kroger, Walmart Grocery, or similar). Return ONLY a JSON object where keys are the item index numbers and values are estimated price in USD as a number (e.g. {"0": 2.49, "1": 1.99}). Use realistic current prices. If you cannot determine a price for an item, use null.

Items:
${itemList}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "You are a grocery price assistant. Always respond with only a valid JSON object mapping item indices to prices. No markdown, no explanation — just the JSON.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return res.status(500).json({ error: "Anthropic API request failed" });
    }

    const data = await response.json();

    // Find the last text block (after any tool use blocks)
    const textBlocks = (data.content || []).filter((b) => b.type === "text");
    const raw = textBlocks[textBlocks.length - 1]?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not find JSON in response:", raw);
      return res.status(500).json({ error: "Could not parse prices from response" });
    }

    const prices = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ prices });
  } catch (e) {
    console.error("get-prices error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
