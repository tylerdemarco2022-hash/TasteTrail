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
