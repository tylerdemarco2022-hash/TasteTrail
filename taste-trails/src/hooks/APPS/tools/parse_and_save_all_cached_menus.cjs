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

const { OpenAI } = require('openai')
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
if (!client) {
  console.error('OPENAI_API_KEY not set; aborting')
  process.exit(1)
}

const cacheDir = path.join(__dirname, '..', 'cache', 'menus')
if (!fs.existsSync(cacheDir)) {
  console.error('cache/menus not found')
  process.exit(1)
}
const files = fs.readdirSync(cacheDir).filter(f => f.toLowerCase().endsWith('.txt') || f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.json'))
if (!files.length) {
  console.log('No cached menu files found.')
  process.exit(0)
}

const { normalizeMenu } = require(path.join(__dirname, '..', 'services', 'menuNormalizer'))
const { upsertRestaurant, storeMenu } = require(path.join(__dirname, '..', 'services', 'menuStorage'))

async function parseTextWithAI(text) {
  const system = { role: 'system', content: `You are a restaurant menu data extraction engine.
Return strict JSON:
{ "categories": [ { "category": "Category Name", "items": [ { "dish_name": "", "description": "", "price": "" } ] } ] }` }
  const user = { role: 'user', content: `Extract the complete structured menu from this text:\n\n${text}\n\nReturn only JSON.` }
  const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [system, user], temperature: 0 })
  const txt = (resp?.choices?.[0]?.message?.content) || ''
  const jsonMatch = txt.match(/\{[\s\S]*\}$/m)
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(txt)
  return parsed
}

async function main() {
  for (const f of files) {
    try {
      console.log('\n---')
      console.log('Processing', f)
      const raw = fs.readFileSync(path.join(cacheDir, f), 'utf8')
      const parsed = await parseTextWithAI(raw)
      const normalized = normalizeMenu(parsed)
      // attempt to derive restaurant name from filename
      const name = f.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      const up = await upsertRestaurant({ name })
      if (!up.id) {
        console.warn('Could not upsert restaurant for', name)
        continue
      }
      const saveRes = await storeMenu(Object.assign({}, { name }, { id: up.id }), normalized)
      console.log('Saved:', f, '-> inserted dishes:', saveRes.dishesInserted || 0)
    } catch (e) {
      console.error('Failed:', f, e && e.message ? e.message : String(e))
      continue
    }
  }
  console.log('\nDone processing cached menus.')
}

main()
