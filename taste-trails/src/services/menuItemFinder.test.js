import assert from 'node:assert/strict'
import test from 'node:test'
import { getNodeMenuCatalog } from './menuCatalogNode.js'
import {
  assembleCatalog,
  dietaryProfile,
  findMenuItems,
  handleFindMenuItems,
  handleSearchDishes,
  searchRestaurants
} from './menuItemFinder.js'
import { SEED_MENUS } from './restaurantMeta.js'

const uptown = { lat: 35.2271, lng: -80.8431 }

test('fuzzy search ranks the matching dish and tolerates a typo', () => {
  const catalog = getNodeMenuCatalog()
  assert.ok(catalog.length > 400)

  const typo = findMenuItems(catalog, { q: 'margerita', ...uptown, limit: 5 })
  assert.ok(typo.items.some((item) => item.name === 'Margherita Pizza'))
  assert.equal(typo.items[0].name, 'Margherita Pizza')

  const exact = findMenuItems(catalog, { q: 'tuna crudo', ...uptown, limit: 5 })
  assert.equal(exact.items[0].name, 'Tuna Crudo')
  assert.equal(exact.items[0].restaurant.name, 'Figtree')
  assert.ok(exact.tookMs === undefined)
})

test('dietary, price, and distance filters change the result set', () => {
  const catalog = getNodeMenuCatalog()

  const vegetarian = findMenuItems(catalog, { q: 'pizza', dietary: ['vegetarian'], ...uptown })
  assert.ok(vegetarian.items.some((item) => item.name === 'Margherita Pizza'))
  assert.equal(vegetarian.items.some((item) => /pepperoni|sausage/i.test(item.name)), false)

  const vegan = findMenuItems(assembleCatalog({ seeds: SEED_MENUS }), { q: 'biryani', dietary: ['vegan'], ...uptown })
  assert.equal(vegan.items.some((item) => item.name === 'Lamb Biryani'), false)
  assert.equal(vegan.items.some((item) => item.name === 'Vegetable Biryani'), false)

  const margheritaDiet = dietaryProfile('Margherita Pizza', 'Tomato Sauce, Mozzarella, Basil, EVOO')
  assert.equal(margheritaDiet.matches.vegetarian, true)
  assert.equal(margheritaDiet.matches.vegan, false)
  assert.equal(margheritaDiet.matches.halal, false)
  const statedHalal = dietaryProfile('Chicken plate', 'halal grilled chicken')
  assert.equal(statedHalal.matches.halal, true)
  assert.equal(dietaryProfile('Pork chop', 'halal pork').matches.halal, false)
  const wine = dietaryProfile('Ridge Vineyards', '')
  assert.equal(wine.labels.length, 0)
  assert.equal(dietaryProfile('Pez Espada', 'Black scabbardfish with vegetables').matches.vegetarian, false)

  const chana = findMenuItems(assembleCatalog({ seeds: SEED_MENUS }), {
    q: 'chana',
    dietary: ['vegan'],
    ...uptown
  })
  assert.equal(chana.items[0].name, 'Chana Masala')

  const priced = findMenuItems(assembleCatalog({ seeds: SEED_MENUS }), {
    q: 'bao',
    maxPriceLevel: 2,
    ...uptown
  })
  assert.ok(priced.items.every((item) => item.priceLevel <= 2))
  assert.equal(priced.items.some((item) => item.name === 'Pork Belly Bao'), false)
  assert.ok(priced.items.some((item) => item.name === 'Veggie Bao'))

  const near = findMenuItems(assembleCatalog({ seeds: SEED_MENUS }), {
    q: 'biryani',
    maxDistanceMiles: 2,
    ...uptown
  })
  assert.equal(near.items.length, 0)
  assert.match(near.message, /No menu items|dietary|price/i)

  const farther = findMenuItems(assembleCatalog({ seeds: SEED_MENUS }), {
    q: 'biryani',
    maxDistanceMiles: 15,
    ...uptown
  })
  assert.ok(farther.items.some((item) => item.name === 'Lamb Biryani'))
  assert.ok(farther.items[0].distanceMiles > 0)
})

test('restaurant words narrow dishes without dumping a whole menu', () => {
  const catalog = getNodeMenuCatalog()
  const pizza = findMenuItems(catalog, { q: 'angeline pizza', ...uptown, limit: 10 })
  assert.ok(pizza.items.length > 0)
  assert.ok(pizza.items.every((item) => item.restaurant.name === "Angeline's"))
  assert.ok(pizza.items.some((item) => /pizza/i.test(item.name)))

  const restaurants = searchRestaurants(catalog, 'sixti vines', uptown)
  assert.equal(restaurants[0].name, 'Sixty Vines')

  const namedDishes = findMenuItems(catalog, { q: 'sixty vines', ...uptown, limit: 20 })
  assert.ok(namedDishes.items.length > 0)
  assert.ok(namedDishes.items.length < 8)
  assert.ok(namedDishes.items.every((item) => item.restaurant.name === 'Sixty Vines'))
  assert.ok(namedDishes.items.some((item) => /vines burger|sixty brunch/i.test(item.name)))
})

test('invalid lookups fail clearly and empty filters do not return the catalog', () => {
  const catalog = assembleCatalog({ seeds: SEED_MENUS })
  const missing = handleFindMenuItems({ q: 'bao' }, catalog)
  assert.equal(missing.status, 400)

  const bad = handleFindMenuItems({ lat: 'north', lng: -80 }, catalog)
  assert.equal(bad.status, 400)

  const browse = findMenuItems(catalog, { ...uptown })
  assert.equal(browse.found, 0)
  assert.match(browse.message, /Enter a dish/)

  const unpriced = findMenuItems(catalog, { q: 'veggie bao', maxPrice: null, maxPriceLevel: null, ...uptown })
  assert.equal(unpriced.items[0]?.name, 'Veggie Bao')

  const ok = handleFindMenuItems({ lat: '35.2271', lng: '-80.8431', q: 'veggie bao', dietary: 'vegetarian' }, catalog)
  assert.equal(ok.status, 200)
  assert.equal(ok.body.items[0].name, 'Veggie Bao')
  assert.ok(ok.body.tookMs >= 0)

  const dishes = handleSearchDishes({ q: '' }, catalog)
  assert.equal(dishes.status, 400)

  const found = handleSearchDishes({ q: 'guacamole', lat: uptown.lat, lng: uptown.lng }, getNodeMenuCatalog())
  assert.equal(found.status, 200)
  assert.ok(found.body.results.some((row) => /guacamole/i.test(row.dish_name)))
})

test('catalog search stays fast on the full menu set', () => {
  const catalog = getNodeMenuCatalog()
  const started = Date.now()
  const result = findMenuItems(catalog, { q: 'caesar', dietary: ['vegetarian'], maxDistanceMiles: 20, ...uptown })
  const elapsed = Date.now() - started
  assert.ok(result.items.length > 0)
  assert.ok(elapsed < 250, `search took ${elapsed}ms`)
})
