import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { createLiveMenuService } from '../src/services/liveMenu.js'
import { foldRestaurantName, knownRestaurantRecords } from '../src/services/restaurantSources.js'

const lat = Number(process.env.NEARBY_LAT || 35.2271)
const lng = Number(process.env.NEARBY_LNG || -80.8431)
const limit = Number(process.env.NEARBY_MENU_LIMIT || 12)
const service = createLiveMenuService({
  cacheDir: mkdtempSync(path.join(tmpdir(), 'nearby-coverage-')),
  placesKey: process.env.GOOGLE_PLACES_API_KEY || '',
  fetchGapMs: 0,
  savedCatalog: []
})

const listed = await service.listNearby({ lat, lng, radius: 3 }, { loadMenus: false })
if (listed.status !== 200) {
  console.error(listed.body)
  process.exit(1)
}
const restaurants = listed.body.restaurants || []
const known = new Set(knownRestaurantRecords().map((record) => foldRestaurantName(record.name)))
const fresh = restaurants.filter((place) => !known.has(foldRestaurantName(place.name)))
console.log(`discovered ${restaurants.length} via ${listed.body.provider} within 3 miles of ${lat},${lng}; ${fresh.length} are not in the saved list`)
let checked = 0
let live = 0
const examples = []
const ordered = [...fresh, ...restaurants.filter((place) => known.has(foldRestaurantName(place.name)))]
for (const place of ordered) {
  if (checked >= limit) break
  if (!place.website && !place.menuUrl) continue
  checked += 1
  const menu = await service.getRestaurantMenu(place.name, {
    address: place.address,
    latitude: place.lat,
    longitude: place.lon,
    approximate: false,
    websites: place.website ? [place.website] : [],
    menuUrls: place.menuUrl ? [place.menuUrl] : []
  })
  console.log(`- ${place.name}: ${menu.source} items=${menu.items.length} url=${menu.sourceUrl || place.website || ''}`)
  if (menu.source === 'live') {
    live += 1
    const sample = menu.items.find((item) => item.name) 
    if (sample && examples.length < 5) {
      examples.push(`${sample.name}${sample.price != null ? ` ($${Number(sample.price).toFixed(2)})` : ''} at ${place.name} from ${menu.sourceUrl}`)
    }
  }
}
console.log(`checked ${checked} websites, live menus ${live}`)
for (const example of examples) console.log(`example: ${example}`)
