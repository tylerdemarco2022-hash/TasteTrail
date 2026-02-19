import { searchRestaurants } from '../services/googlePlaces.js'

const [name, location = 'Charlotte, NC'] = process.argv.slice(2)
if (!name) {
  console.error('Usage: node tools/ingestByName.js "Restaurant Name" "Location"')
  process.exit(1)
}

function scoreMatch(candidateName, targetName) {
  const a = (candidateName || '').toLowerCase()
  const b = (targetName || '').toLowerCase()
  if (a === b) return 3
  if (a.includes(b) || b.includes(a)) return 2
  return 0
}

const results = await searchRestaurants(name, location)
if (!results.length) {
  console.error('No places found for', name)
  process.exit(1)
}

const best = results
  .map((r) => ({ r, score: scoreMatch(r.name, name) }))
  .sort((a, b) => b.score - a.score)[0].r

if (!best?.place_id) {
  console.error('No place_id available for', name)
  process.exit(1)
}

const port = process.env.PORT || 8080
const res = await fetch(`http://localhost:${port}/restaurants/ingest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ place_id: best.place_id })
})

const data = await res.json()
console.log(JSON.stringify({
  name,
  location,
  place_id: best.place_id,
  status: res.status,
  data
}, null, 2))
