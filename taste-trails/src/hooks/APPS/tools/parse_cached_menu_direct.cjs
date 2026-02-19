const fs = require('fs')
const path = require('path')

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/)
    if (!m) continue
    const k = m[1]
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[k] = v
  }
}

loadEnv(path.join(__dirname, '..', 'taste-trails', 'server', '.env'))
loadEnv(path.join(__dirname, '..', '.env'))

const cacheDir = path.join(__dirname, '..', 'cache', 'menus')
if (!fs.existsSync(cacheDir)) {
  console.error('cache/menus not found')
  process.exit(1)
}
const files = fs.readdirSync(cacheDir)
const target = files.find(f => f.toLowerCase().startsWith('the-mill-house'))
if (!target) {
  console.error('No cached file starting with "the-mill-house" found in cache/menus')
  process.exit(1)
}
const text = fs.readFileSync(path.join(cacheDir, target), 'utf8')

const { OpenAI } = require('openai')
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not set in env files')
  process.exit(1)
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

const user = { role: 'user', content: `Extract the complete structured menu from this text:\n\n${text}\n\nReturn format:\n{\n"categories": [ { "category": "", "items": [ { "dish_name": "", "description": "", "price": "" } ] } ] \n}` }

async function main() {
  try {
    console.log('Calling OpenAI...')
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [system, user], temperature: 0 })
    const txt = (resp?.choices?.[0]?.message?.content) || ''
    const jsonMatch = txt.match(/\{[\s\S]*\}$/m)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(txt)
    const outPath = path.join(__dirname, 'parsed_mill_house_direct.json')
    fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), 'utf8')
    console.log('Wrote parsed JSON to', outPath)
    console.log(JSON.stringify(parsed, null, 2))
  } catch (e) {
    console.error('OpenAI call failed:', e && e.message ? e.message : String(e))
    process.exit(2)
  }
}

main()
