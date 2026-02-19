require("dotenv").config();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function parseMenu(rawText) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are a menu extraction engine.
Extract ONLY restaurant food and drink items.
Return valid JSON in this format (no markdown, just raw JSON):

[
  {
    "category": "Dinner",
    "name": "Dish Name",
    "description": "Short description or null"
  }
]

Do NOT include prices.
Ignore navigation, hours, addresses, footers.
Return ONLY the JSON array, no markdown code blocks.
`
      },
      {
        role: "user",
        content: rawText.slice(0, 15000)
      }
    ],
    temperature: 0
  });

  let content = response.choices[0].message.content.trim();
  
  // Strip markdown code blocks if present
  if (content.startsWith("```")) {
    content = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(content);
}

module.exports = parseMenu;
