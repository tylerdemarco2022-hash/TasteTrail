import { logger } from '../utils/logger.js'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export async function discoverWebsiteWithLLM(restaurantName, location = '') {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing')

  const system = 'You are a web investigator. Given a restaurant name and optional location, return a JSON array of likely official website URLs for that restaurant, ordered by confidence. Return ONLY valid JSON: an array of strings. Do not include any explanation.'
  const user = `Restaurant: ${restaurantName}${location ? `\nLocation: ${location}` : ''}\nProvide up to 3 likely official website URLs as a JSON array.`

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  })

  if (!res.ok) {
    const text = await res.text()
    logger.error('OpenAI discovery error', text)
    throw new Error('OpenAI discovery request failed')
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed
    // try to extract urls from a wrapped object
    if (parsed.urls && Array.isArray(parsed.urls)) return parsed.urls
    throw new Error('LLM returned unexpected JSON')
  } catch (e) {
    // attempt to extract first URL via regex as a last resort
    const m = content.match(/https?:\/\/[^\s\]"']+/i)
    if (m) return [m[0]]
    logger.error('OpenAI discovery parse error', e)
    throw new Error('OpenAI returned invalid JSON for discovery')
  }
}
