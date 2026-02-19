const fs = require('fs')
const path = require('path')

// Load OPENAI_API_KEY from taste-trails/server/.env or root .env
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

// Find cached mill house menu
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

// Require extractor after setting env so it creates the OpenAI client
const extractor = require(path.join(__dirname, '..', 'services', 'menuExtractor'))
const extractFullMenu = extractor.extractFullMenu

(async () => {
  try {
    console.log('Parsing cached file:', target)
    console.log('extractor type:', typeof extractor)
    try { console.log('extractor keys:', Object.keys(extractor)) } catch (e) {}
    console.log('extractFullMenu type:', typeof extractFullMenu)
    const parsed = await extractFullMenu(text)
    const outPath = path.join(__dirname, 'parsed_mill_house.json')
    fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), 'utf8')
    console.log('Parsed output written to', outPath)
    console.log(JSON.stringify(parsed, null, 2))
  } catch (e) {
    console.error('Parsing failed:', e && e.message ? e.message : String(e))
    process.exit(2)
  }
})()
