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

const parsedPath = path.join(__dirname, 'parsed_mill_house_direct.json')
if (!fs.existsSync(parsedPath)) {
  console.error('Parsed file not found:', parsedPath)
  process.exit(1)
}
const parsed = JSON.parse(fs.readFileSync(parsedPath, 'utf8'))

const { normalizeMenu } = require(path.join(__dirname, '..', 'services', 'menuNormalizer'))
const { storeMenu, upsertRestaurant } = require(path.join(__dirname, '..', 'services', 'menuStorage'))

async function main() {
  try {
    const normalized = normalizeMenu(parsed)
    const restaurant = { name: 'The Mill House', website: null }
    console.log('Upserting restaurant...')
    const up = await upsertRestaurant(restaurant)
    console.log('Restaurant id:', up.id)
    if (!up.id) {
      console.error('Failed to get restaurant id; aborting save')
      process.exit(2)
    }
    const res = await storeMenu(Object.assign({}, restaurant, { id: up.id }), normalized)
    console.log('storeMenu result:', res)
  } catch (e) {
    console.error('Save failed:', e && e.message ? e.message : String(e))
    process.exit(3)
  }
}

main()
