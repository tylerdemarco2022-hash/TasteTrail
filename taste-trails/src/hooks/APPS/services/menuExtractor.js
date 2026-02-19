const { OpenAI } = require('openai')

const client = (() => {
  if (!process.env.OPENAI_API_KEY) return null
  try { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) } catch (e) { return null }
})()

function chunkText(text, size = 16000) {
  const chunks = []
  let i = 0
  while (i < text.length) {
    chunks.push(text.slice(i, i + size))
    i += size
  }
  return chunks
}

function mergeMenus(menus) {
  const merged = { categories: [] }
  const catMap = new Map()
  for (const m of menus) {
    if (!m || !Array.isArray(m.categories)) continue
    for (const c of m.categories) {
      const key = (c.category || '').trim() || 'Uncategorized'
      if (!catMap.has(key)) {
        catMap.set(key, { category: key, items: [] })
      }
      const dest = catMap.get(key)
      for (const it of c.items || []) {
        const name = (it.dish_name || '').trim()
        if (!name) continue
        // dedupe by name+price
        const exists = dest.items.find(x => x.dish_name.trim().toLowerCase() === name.toLowerCase() && (x.price || '') === (it.price || ''))
        if (!exists) dest.items.push({ dish_name: name, description: (it.description || '').trim(), price: (it.price || '').trim() })
      }
    }
  }
  merged.categories = Array.from(catMap.values())
  return merged
}

async function callOpenAIForChunk(chunk) {
  if (!client) throw new Error('OPENAI_API_KEY missing')
  const system = { role: 'system', content: `You are a restaurant menu data extraction engine.

The input text may contain navigation, footer content, and other non-menu text.

Your job:

Identify all food and drink items listed.
Infer categories if explicit headers are missing.
Extract dish names even if prices are missing.
If menu structure is unclear, still extract likely dish names.
Do NOT return empty categories unless no food items exist.

Return strict JSON:
{
  "categories": [
    {
      "category": "Category Name",
      "items": [ { "dish_name": "", "description": "", "price": "" } ]
    }
  ]
}

If no clear categories exist, use:
category: "Menu Items"

Never return an empty categories array unless the page clearly contains no menu items.` }
  const user = { role: 'user', content: `Extract the complete structured menu from this text:\n\n${chunk}\n\nReturn format:\n{\n"categories": [ { "category": "", "items": [ { "dish_name": "", "description": "", "price": "" } ] } ] \n}` }

  // use temperature 0
  const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [system, user], temperature: 0 })
  const txt = (resp?.choices?.[0]?.message?.content) || ''
  // try to extract JSON substring
  const jsonMatch = txt.match(/\{[\s\S]*\}$/m)
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(txt)
  return parsed
}

async function extractFullMenu(rawMenuText) {
  if (!rawMenuText) return { categories: [] }
  // chunk large menus
  const chunks = chunkText(rawMenuText, 15000)
  const results = []
  for (const c of chunks) {
    try {
      const r = await callOpenAIForChunk(c)
      results.push(r)
    } catch (e) {
      // continue; don't crash entire job
      console.warn('OpenAI menu chunk failed:', e instanceof Error ? e.message : String(e))
    }
  }
  const merged = mergeMenus(results)
  // Clean items: remove short or generic entries before saving
  try {
    const blacklist = ['food','snacks','drinks','beer','promotions','games']
    for (const cat of merged.categories || []) {
      const items = Array.isArray(cat.items) ? cat.items : []
      const normalized = items.map(it => ({
        ...it,
        name: (it.name || it.dish_name || '').trim()
      }))
      const cleanedItems = normalized.filter(item =>
        item.name &&
        item.name.length > 2 &&
        !blacklist.includes(item.name.toLowerCase())
      )
      cat.items = cleanedItems
    }
  } catch (cleanErr) {
    // non-fatal
    console.warn('Menu cleaning failed:', cleanErr instanceof Error ? cleanErr.message : String(cleanErr))
  }
  try {
    const totalDishCount = merged.categories.reduce((acc, c) => acc + ((c.items && c.items.length) || 0), 0)
    console.log('Extracted categories:', (merged.categories && merged.categories.length) || 0)
    console.log('Total dishes extracted:', totalDishCount)
  } catch (logErr) {
    // non-fatal logging error
  }
  return merged
}

module.exports = { extractFullMenu }
