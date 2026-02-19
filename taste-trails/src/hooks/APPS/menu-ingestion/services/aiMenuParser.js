// OpenAI fallback parser for raw HTML/text
// Extracts menu data into the required JSON schema.

import { logger } from '../utils/logger.js'
import fs from 'fs'
import path from 'path'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const PROMPT_PATH = path.join(process.cwd(), 'menu-ingestion', 'prompts', 'menu_parser_prompt.json')

async function loadPromptTemplate() {
  try {
    const raw = await fs.promises.readFile(PROMPT_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      system: parsed.system || '',
      userTemplate: parsed.user || ''
    }
  } catch (e) {
    // fallback to built-in prompts
    return {
      system:
        'You are a parser that extracts restaurant menus. Return ONLY valid JSON with the schema: { "sections": [ { "name": string, "items": [ { "name": string, "description": string, "price": number|null } ] } ] }. Do not include markdown or extra text.',
      userTemplate: 'Extract the menu from the content below. Normalize prices to numbers (USD) or null.\n\nCONTENT:\n{{CONTENT}}'
    }
  }
}

export async function parseMenuWithAI(rawContent) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing')

  const prompt = await loadPromptTemplate()
  const systemPrompt = prompt.system
  const userPrompt = prompt.userTemplate.replace('{{CONTENT}}', (rawContent || '').slice(0, 12000))

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: Number(process.env.OPENAI_TEMP || 0.1),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!res.ok) {
    const text = await res.text()
    logger.error('OpenAI error', text)
    throw new Error('OpenAI request failed')
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  function extractJsonLike(str) {
    if (!str) return null
    // remove triple-backtick fences and language markers
    let s = str.replace(/```[a-zA-Z0-9_-]*\n?/g, '')
    s = s.replace(/```/g, '')
    // find first { and last } and attempt to extract balanced JSON
    const first = s.indexOf('{')
    const last = s.lastIndexOf('}')
    if (first === -1 || last === -1 || last <= first) return null
    // attempt to find matching brace from first
    let depth = 0
    for (let i = first; i < s.length; i++) {
      if (s[i] === '{') depth++
      else if (s[i] === '}') {
        depth--
        if (depth === 0) {
          const candidate = s.slice(first, i + 1)
          return candidate
        }
      }
    }
    // fallback to substring between first and last
    return s.slice(first, last + 1)
  }

  try {
    return JSON.parse(content)
  } catch (e) {
    // try to recover JSON from fenced/annotated output
    try {
      const candidate = extractJsonLike(content)
      if (candidate) return JSON.parse(candidate)
    } catch (e2) {
      logger.warn('aiMenuParser recovery failed', e2.message)
    }

    // If recovery failed, ask the model to extract JSON only from its previous output
    try {
      const clarifyingRes = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.0,
          messages: [
            { role: 'system', content: 'You are a JSON extractor. Extract and return ONLY the JSON object or array from the provided text. Do not include code fences or any commentary.' },
            { role: 'user', content: content }
          ]
        })
      })
      if (clarifyingRes.ok) {
        const clarData = await clarifyingRes.json()
        const clarContent = clarData?.choices?.[0]?.message?.content || ''
        try {
          return JSON.parse(clarContent)
        } catch (e3) {
          const recovered = extractJsonLike(clarContent)
          if (recovered) return JSON.parse(recovered)
        }
      }
    } catch (e4) {
      logger.warn('aiMenuParser clarifying request failed', e4.message)
    }

    logger.error('OpenAI JSON parse error', e)
    throw new Error('OpenAI returned invalid JSON')
  }
}
