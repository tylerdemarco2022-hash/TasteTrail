import assert from 'node:assert/strict'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import test from 'node:test'
import { createLiveMenuService } from './liveMenu.js'

const menuHtml = `
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Menu","hasMenuSection":[{"@type":"MenuSection","name":"Mains","hasMenuItem":[
{"@type":"MenuItem","name":"Margherita","description":"tomato, mozzarella, basil","offers":{"price":"16.00"}},
{"@type":"MenuItem","name":"Pork Chop","description":"sage brown butter"},
{"@type":"MenuItem","name":"Burrata","description":"basil pesto, tomato"}
]}]}
</script>
`

function htmlResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null) },
    arrayBuffer: async () => Buffer.from(body),
    json: async () => JSON.parse(body)
  }
}

function serviceWith(fetchImpl, extra = {}) {
  return createLiveMenuService({
    cacheDir: mkdtempSync(path.join(tmpdir(), 'menu-cache-')),
    fetchImpl,
    sources: [{
      name: 'Sixty Vines',
      address: 'Charlotte, NC',
      latitude: 35.15,
      longitude: -80.83,
      approximate: false,
      menuUrls: ['https://example.test/menu'],
      websites: []
    }],
    savedCatalog: extra.savedCatalog || [],
    ...extra
  })
}

test('a fetched menu is cached and a failed fetch does not invent dishes', async () => {
  let calls = 0
  const service = serviceWith(async () => {
    calls += 1
    return htmlResponse(menuHtml)
  })
  const first = await service.getRestaurantMenu('Sixty Vines')
  assert.equal(first.source, 'live')
  assert.match(first.message, /example\.test/)
  assert.equal(first.items.some((item) => item.name === 'Margherita' && item.price === 16), true)
  const second = await service.getRestaurantMenu('Sixty Vines')
  assert.equal(second.source, 'live')
  assert.equal(calls, 1)

  const search = service.searchMenus({ q: 'margherita', lat: 35.2, lng: -80.84 }, { schedule: false })
  assert.equal(search.body.items[0].name, 'Margherita')
  assert.equal(search.body.items[0].source, 'live')
  assert.equal(search.body.items[0].priceLabel, '$16.00')

  const empty = serviceWith(async () => htmlResponse('no menu here', 404), {
    savedCatalog: [{
      name: 'Veggie Bao',
      description: 'Steamed vegetable bun',
      restaurant: 'Sixty Vines',
      price: null,
      dietary: ['vegetarian'],
      dietaryLabels: [{ key: 'vegetarian', label: 'Vegetarian' }]
    }]
  })
  const fallback = await empty.getRestaurantMenu('Sixty Vines')
  assert.equal(fallback.source, 'saved')
  assert.match(fallback.message, /Could not retrieve a live menu/)
  assert.equal(fallback.items[0].name, 'Veggie Bao')
  assert.equal(fallback.items.some((item) => item.name === 'Chef Special'), false)
})

test('sixty vines publishes a real dinner menu', { timeout: 30000 }, async () => {
  const service = createLiveMenuService({
    cacheDir: mkdtempSync(path.join(tmpdir(), 'menu-live-')),
    sources: [{
      name: 'Sixty Vines',
      address: 'Charlotte, NC',
      latitude: 35.1517,
      longitude: -80.8346,
      menuUrls: ['https://www.sixtyvines.com/menu/all/dinner'],
      websites: []
    }],
    savedCatalog: []
  })
  const menu = await service.getRestaurantMenu('Sixty Vines')
  assert.equal(menu.source, 'live')
  assert.ok(menu.items.length >= 3)
  const margherita = menu.items.find((item) => /margherita/i.test(item.name))
  assert.ok(margherita, 'expected the published Margherita')
  assert.match(margherita.description || '', /mozzarella/i)
  assert.equal(menu.items.some((item) => item.name === 'Chef Special'), false)
})

function jsonResponse(body, status = 200) {
  const text = JSON.stringify(body)
  return htmlResponse(text, status)
}

test('nearby discovery lists real places and does not invent dishes', async () => {
  const calls = []
  const service = serviceWith(async (url) => {
    calls.push(String(url))
    if (String(url).includes('overpass-api.de')) {
      return jsonResponse({
        elements: [
          {
            type: 'node',
            id: 42,
            lat: 35.228,
            lon: -80.844,
            tags: {
              name: 'Real Bistro',
              amenity: 'restaurant',
              website: 'https://realbistro.test/menu',
              opening_hours: 'Mo-Sa 11:00-22:00',
              'addr:street': 'Trade St'
            }
          },
          {
            type: 'node',
            id: 43,
            lat: 35.229,
            lon: -80.845,
            tags: { name: 'No Site Cafe', amenity: 'restaurant' }
          }
        ]
      })
    }
    if (String(url).includes('realbistro.test')) return htmlResponse(menuHtml)
    return htmlResponse('no menu', 404)
  }, { placesKey: '', savedCatalog: [], fetchGapMs: 0, sources: [] })

  const listed = await service.listNearby({ lat: 35.2271, lng: -80.8431 }, { loadMenus: false })
  assert.equal(listed.status, 200)
  assert.equal(listed.body.provider, 'openstreetmap')
  assert.equal(listed.body.restaurants[0].name, 'Real Bistro')
  assert.equal(listed.body.restaurants[0].website, 'https://realbistro.test/menu')
  assert.equal(listed.body.restaurants[0].hours, 'Mo-Sa 11:00-22:00')
  assert.equal(listed.body.restaurants.some((place) => place.name === 'No Site Cafe' && place.menuStatus === 'unavailable'), true)
  assert.equal(JSON.stringify(listed.body).includes('Chef Special'), false)

  const menu = await service.getRestaurantMenu('Real Bistro', {
    websites: ['https://realbistro.test/menu'],
    latitude: 35.228,
    longitude: -80.844,
    approximate: false
  })
  assert.equal(menu.source, 'live')
  assert.equal(menu.items.some((item) => item.name === 'Margherita' && item.price === 16), true)
  const search = service.searchMenus({ q: 'margherita', lat: 35.2271, lng: -80.8431 }, { schedule: false })
  assert.equal(search.body.items[0].restaurant.name, 'Real Bistro')
  assert.equal(search.body.items[0].source, 'live')

  const missing = await service.getRestaurantMenu('No Site Cafe', { websites: ['https://nosite.test/'] })
  assert.equal(missing.source, 'unavailable')
  assert.equal(missing.message, 'Menu not available online.')
  assert.equal(missing.website, 'https://nosite.test/')
  assert.equal(missing.items.length, 0)
})

test('a city or ZIP is geocoded and Google Places is preferred when a key is set', async () => {
  const service = serviceWith(async (url) => {
    const target = String(url)
    if (target.includes('nominatim.openstreetmap.org')) {
      return jsonResponse([{ lat: '35.2271', lon: '-80.8431', display_name: 'Charlotte, NC' }])
    }
    if (target.includes('places.googleapis.com')) {
      return jsonResponse({
        places: [{
          id: 'place-1',
          displayName: { text: 'Uptown Grill' },
          formattedAddress: '100 Tryon St, Charlotte, NC',
          location: { latitude: 35.227, longitude: -80.843 },
          websiteUri: 'https://uptowngrill.test/',
          rating: 4.6,
          userRatingCount: 120,
          regularOpeningHours: { weekdayDescriptions: ['Monday: 11:00 AM – 10:00 PM'] },
          photos: [{ name: 'places/place-1/photos/abc' }]
        }]
      })
    }
    return htmlResponse('no menu', 404)
  }, { placesKey: 'test-key', savedCatalog: [], fetchGapMs: 0, sources: [] })

  const listed = await service.listNearby({ q: 'Charlotte, NC' }, { loadMenus: false })
  assert.equal(listed.body.provider, 'google')
  assert.equal(listed.body.location.label, 'Charlotte, NC')
  assert.equal(listed.body.restaurants[0].name, 'Uptown Grill')
  assert.equal(listed.body.restaurants[0].rating, 4.6)
  assert.equal(listed.body.restaurants[0].photoName, 'places/place-1/photos/abc')
  assert.equal(listed.body.restaurants[0].website, 'https://uptowngrill.test/')
  const blank = await service.listNearby({ q: ' ' })
  assert.equal(blank.status, 400)
})
