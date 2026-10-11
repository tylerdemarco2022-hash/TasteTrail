import { haversine } from '../utils/distance.js'
import { DIETARY_FILTERS } from './restaurantMeta.js'

const DIETARY_KEYS = new Set(DIETARY_FILTERS.map((entry) => entry.key))

const PORK = ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'sausage', 'pepperoni', 'salami', 'chorizo', 'lardon', 'guanciale']
const MEAT = [...PORK, 'beef', 'steak', 'chicken', 'turkey', 'duck', 'lamb', 'veal', 'meatball', 'brisket', 'ribeye', 'filet', 'sirloin', 'wagyu', 'bison', 'venison', 'gyro', 'pastrami']
const SEAFOOD = ['fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'clam', 'scallop', 'anchovy', 'anchovies', 'calamari', 'octopus', 'seafood', 'cod', 'halibut', 'trout', 'crudo', 'ahi', 'snapper', 'crawfish', 'crayfish']
const SHELLFISH = ['shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'clam', 'scallop', 'crawfish', 'crayfish', 'shellfish']
const DAIRY = ['cheese', 'cream', 'butter', 'milk', 'yogurt', 'yoghurt', 'mozzarella', 'parmesan', 'parmigiano', 'ricotta', 'ghee', 'dairy', 'latte', 'feta', 'cheddar', 'burrata', 'brie', 'provolone', 'gouda', 'gruyere', 'manchego', 'pecorino', 'queso', 'fontina', 'mascarpone', 'paneer', 'bleu']
const EGG = ['egg', 'eggs', 'aioli', 'mayo', 'mayonnaise', 'meringue']
const GLUTEN = ['bread', 'bun', 'pasta', 'noodle', 'noodles', 'flour', 'tortilla', 'pita', 'naan', 'crouton', 'croutons', 'breadcrumb', 'breadcrumbs', 'wheat', 'barley', 'rye', 'seitan', 'gnocchi', 'dumpling', 'dumplings', 'bao', 'pizza', 'sandwich', 'wrap', 'cracker', 'crackers', 'focaccia', 'brioche', 'sourdough', 'ciabatta', 'baguette', 'orzo', 'risotto', 'panko', 'tempura', 'beer']
const NUTS = ['peanut', 'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'pesto', 'praline', 'nut']
const ALCOHOL = ['wine', 'beer', 'cocktail', 'whiskey', 'whisky', 'bourbon', 'rum', 'vodka', 'gin', 'tequila', 'mezcal', 'sake', 'prosecco', 'champagne', 'liqueur', 'amaro', 'vermouth']
const STARCH = ['sugar', 'honey', 'syrup', 'cake', 'brownie', 'ice cream', 'gelato', 'dessert', 'bread', 'pasta', 'rice', 'potato', 'fries', 'noodle', 'noodles', 'pizza', 'tortilla', 'bun', 'granola', 'bao', 'dumpling', 'dumplings', 'naan', 'sandwich', 'breadcrumbs']
const LEGUMES = ['bean', 'beans', 'lentil', 'chickpea', 'hummus', 'soy', 'tofu', 'edamame', 'peanut']
const ANIMAL = [...MEAT, ...SEAFOOD]

function hasWord(text, word) {
  if (word.includes(' ')) return text.includes(word)
  return new RegExp(`\\b${word}\\b`, 'i').test(text)
}

function hasAny(text, words) {
  return words.some((word) => hasWord(text, word))
}

function fold(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(value) {
  return fold(value).split(/\s+/).filter((token) => token.length > 1)
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) row[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = tmp
    }
  }
  return row[b.length]
}

function tokenFuzzy(queryToken, targetToken) {
  if (!queryToken || !targetToken) return false
  if (queryToken === targetToken) return true
  if (queryToken.length >= 4 && targetToken.startsWith(queryToken) && targetToken.length - queryToken.length <= 6) return true
  const limit = Math.min(queryToken.length, targetToken.length) >= 8 ? 2 : 1
  if (queryToken.length < 5 || targetToken.length < 4) return false
  if (Math.abs(queryToken.length - targetToken.length) > limit) return false
  return levenshtein(queryToken, targetToken) <= limit
}

export function parsePrice(value) {
  if (value == null || value === '') return { price: null, priceLevel: null }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value) && value >= 1 && value <= 5) return { price: null, priceLevel: value }
    if (value > 0) return { price: value, priceLevel: null }
    return { price: null, priceLevel: null }
  }
  const text = String(value).trim()
  if (/^[1-5]$/.test(text)) return { price: null, priceLevel: Number(text) }
  const amount = text.replace(/[^0-9.]/g, '')
  if (!amount) return { price: null, priceLevel: null }
  const number = Number(amount)
  if (!Number.isFinite(number) || number <= 0) return { price: null, priceLevel: null }
  return { price: number, priceLevel: null }
}

export function formatItemPrice(item) {
  if (item?.price != null && item.price !== '') return `$${Number(item.price).toFixed(2)}`
  if (item?.priceLevel) return '$'.repeat(item.priceLevel)
  return null
}

export function dietaryProfile(name = '', description = '') {
  const text = `${name} ${description}`.toLowerCase()
  const hasText = fold(`${name} ${description}`).length > 0
  const hasDescription = fold(description).length > 0 || fold(name).split(' ').length > 1
  const meat = hasAny(text, MEAT)
  const seafood = hasAny(text, SEAFOOD)
  const pork = hasAny(text, PORK)
  const shellfish = hasAny(text, SHELLFISH)
  const dairy = hasAny(text, DAIRY)
  const egg = hasAny(text, EGG)
  const gluten = hasAny(text, GLUTEN)
  const nuts = hasAny(text, NUTS)
  const alcohol = hasAny(text, ALCOHOL)
  const starch = hasAny(text, STARCH)
  const legumes = hasAny(text, LEGUMES)
  const honey = hasWord(text, 'honey')
  const stated = {
    vegan: /\bvegan\b|plant[-\s]?based/.test(text),
    vegetarian: /\bvegetarian\b|\bveggie\b|meatless/.test(text),
    gluten_free: /gluten[-\s]?free|\bgf\b|no gluten/.test(text),
    dairy_free: /dairy[-\s]?free|no dairy|lactose[-\s]?free/.test(text),
    nut_free: /nut[-\s]?free|no nuts/.test(text),
    shellfish_free: /shellfish[-\s]?free/.test(text),
    egg_free: /egg[-\s]?free/.test(text),
    halal: /\bhalal\b/.test(text),
    kosher: /\bkosher\b/.test(text),
    keto: /\bketo\b/.test(text),
    paleo: /\bpaleo\b/.test(text)
  }

  const canInfer = hasDescription && hasText
  const matches = {
    vegan: (stated.vegan || (canInfer && !meat && !seafood && !dairy && !egg && !honey)) && !(meat || seafood || dairy || egg || honey),
    vegetarian: (stated.vegetarian || stated.vegan || (canInfer && !meat && !seafood)) && !(meat || seafood),
    gluten_free: stated.gluten_free && !(!stated.gluten_free && gluten),
    dairy_free: (stated.dairy_free || (canInfer && !dairy)) && !dairy,
    nut_free: (stated.nut_free || (canInfer && !nuts)) && !nuts,
    shellfish_free: (stated.shellfish_free || (canInfer && !shellfish)) && !shellfish,
    egg_free: (stated.egg_free || (canInfer && !egg)) && !egg,
    halal: (stated.halal || canInfer) && !pork && !alcohol,
    kosher: (stated.kosher || canInfer) && !pork && !shellfish && !(meat && dairy),
    keto: (stated.keto || (canInfer && !starch && (meat || seafood || dairy || /\bsalad\b|\bgreens\b/.test(text)))) && !starch,
    paleo: (stated.paleo || (canInfer && !gluten && !dairy && !legumes && !starch)) && !dairy && !legumes && !hasAny(text, ['bread', 'pasta', 'rice', 'wheat', 'noodle', 'noodles', 'pizza', 'sugar', 'honey'])
  }

  if (stated.gluten_free) matches.gluten_free = true
  const labels = DIETARY_FILTERS.filter((entry) => matches[entry.key]).map((entry) => ({
    key: entry.key,
    label: entry.label,
    stated: Boolean(stated[entry.key] || (entry.key === 'vegetarian' && stated.vegan))
  }))

  return { matches, stated, labels }
}

function normalizeRawItem(raw, restaurant) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name || raw.dish_name || raw.dish || raw.title || '').trim()
  if (!name) return null
  const description = String(raw.description || raw.desc || '').trim()
  const category = String(raw.category || raw.section || '').trim()
  const parsed = parsePrice(raw.price)
  const profile = dietaryProfile(name, description)
  return {
    name,
    description: description || null,
    category: category || null,
    price: parsed.price,
    priceLevel: parsed.priceLevel,
    restaurant: restaurant.name,
    address: restaurant.address || null,
    latitude: numberOrNull(restaurant.latitude),
    longitude: numberOrNull(restaurant.longitude),
    approximate: Boolean(restaurant.approximate),
    dietary: profile.labels.map((label) => label.key),
    dietaryLabels: profile.labels
  }
}

function numberOrNull(value) {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

export function assembleCatalog({ menusByName = {}, meta = [], seeds = [] } = {}) {
  const metaByName = new Map(meta.map((entry) => [entry.name, entry]))
  const items = []
  const seen = new Set()

  const pushItem = (item) => {
    if (!item) return
    const key = `${fold(item.restaurant)}|${fold(item.name)}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  }

  for (const [name, menu] of Object.entries(menusByName)) {
    const restaurant = metaByName.get(name) || { name, address: null, latitude: null, longitude: null, approximate: true }
    const list = Array.isArray(menu) ? menu : []
    for (const raw of list) pushItem(normalizeRawItem(raw, restaurant))
  }

  for (const seed of seeds) {
    for (const raw of seed.items || []) pushItem(normalizeRawItem(raw, seed))
  }

  return items
}

function scoreItem(item, queryTokens) {
  if (!queryTokens.length) return { score: 1, reason: 'browse' }
  const nameTokens = tokens(item.name)
  const descTokens = tokens(item.description)
  const categoryTokens = tokens(item.category)
  const restaurantTokens = tokens(item.restaurant)
  const nameText = fold(item.name)
  const queryText = queryTokens.join(' ')

  if (nameText === queryText) return { score: 100, reason: 'exact' }
  if (nameText.startsWith(queryText)) return { score: 86, reason: 'prefix' }

  let score = 0
  let dishMatched = 0
  let matched = 0
  for (const queryToken of queryTokens) {
    if (nameTokens.some((token) => token === queryToken)) {
      score += 28
      dishMatched += 1
      matched += 1
      continue
    }
    if (nameTokens.some((token) => tokenFuzzy(queryToken, token))) {
      score += 18
      dishMatched += 1
      matched += 1
      continue
    }
    if (categoryTokens.some((token) => token === queryToken || tokenFuzzy(queryToken, token))) {
      score += 10
      dishMatched += 1
      matched += 1
      continue
    }
    if (descTokens.some((token) => token === queryToken || tokenFuzzy(queryToken, token))) {
      score += 8
      dishMatched += 1
      matched += 1
      continue
    }
    if (restaurantTokens.some((token) => token === queryToken || tokenFuzzy(queryToken, token))) {
      score += 6
      matched += 1
    }
  }

  if (dishMatched === 0 || matched < queryTokens.length) return { score: 0, reason: 'none' }
  score += 12
  if (nameText.includes(queryText)) score += 8
  return { score, reason: 'tokens' }
}

function passesPrice(item, maxPrice, maxPriceLevel) {
  if (maxPrice == null && maxPriceLevel == null) return true
  if (maxPrice != null) {
    if (item.price == null) return false
    if (item.price > maxPrice) return false
  }
  if (maxPriceLevel != null) {
    if (item.priceLevel == null) return false
    if (item.priceLevel > maxPriceLevel) return false
  }
  return true
}

function normalizeDietary(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean)
  return list.filter((key) => DIETARY_KEYS.has(key))
}

export function findMenuItems(catalog, options = {}) {
  const items = Array.isArray(catalog) ? catalog : []
  const query = fold(options.q ?? options.query ?? '')
  const queryTokens = tokens(query).slice(0, 8)
  const dietary = normalizeDietary(options.dietary)
  const maxPrice = numberOrNull(options.maxPrice)
  const maxPriceLevel = numberOrNull(options.maxPriceLevel)
  const maxDistanceMiles = numberOrNull(options.maxDistanceMiles)
  const lat = numberOrNull(options.lat)
  const lng = numberOrNull(options.lng ?? options.lon)
  const restaurantFilter = fold(options.restaurant || '')
  const limit = Math.min(Math.max(Number(options.limit) || 40, 1), 100)
  const filtersActive = Boolean(queryTokens.length || dietary.length || maxPrice != null || maxPriceLevel != null || maxDistanceMiles != null || restaurantFilter)

  if (!filtersActive) {
    return {
      found: 0,
      items: [],
      query,
      dietary,
      message: 'Enter a dish or choose a filter.'
    }
  }

  const ranked = []
  for (const item of items) {
    if (!item || !item.name) continue
    if (restaurantFilter && !fold(item.restaurant).includes(restaurantFilter) && fold(item.restaurant) !== restaurantFilter) {
      continue
    }
    const profile = item.dietary ? null : dietaryProfile(item.name, item.description)
    const dietaryKeys = new Set(item.dietary || profile?.labels.map((label) => label.key) || [])
    if (dietary.some((key) => !dietaryKeys.has(key))) continue
    if (!passesPrice(item, maxPrice, maxPriceLevel)) continue

    let distanceMiles = null
    if (lat != null && lng != null && item.latitude != null && item.longitude != null) {
      distanceMiles = haversine(lat, lng, item.latitude, item.longitude) * 0.621371
      if (maxDistanceMiles != null && distanceMiles > maxDistanceMiles) continue
    } else if (maxDistanceMiles != null) {
      continue
    }

    const scored = scoreItem(item, queryTokens)
    if (queryTokens.length && scored.score <= 0) continue
    ranked.push({
      ...item,
      score: scored.score,
      match: scored.reason,
      distanceMiles: distanceMiles == null ? null : Math.round(distanceMiles * 10) / 10
    })
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aDist = a.distanceMiles == null ? Number.POSITIVE_INFINITY : a.distanceMiles
    const bDist = b.distanceMiles == null ? Number.POSITIVE_INFINITY : b.distanceMiles
    if (aDist !== bDist) return aDist - bDist
    return a.name.localeCompare(b.name)
  })

  const sliced = ranked.slice(0, limit).map((item) => ({
    restaurant: {
      name: item.restaurant,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
      approximate: item.approximate
    },
    category: item.category,
    dish_name: item.name,
    name: item.name,
    description: item.description,
    price: item.price,
    priceLevel: item.priceLevel,
    priceLabel: formatItemPrice(item),
    dietary: item.dietary,
    dietaryLabels: item.dietaryLabels,
    distanceMiles: item.distanceMiles,
    score: item.score,
    match: item.match,
    approximateLocation: item.approximate
  }))

  let message = null
  if (!sliced.length) {
    message = 'No menu items match that search.'
    if (maxPrice != null || maxPriceLevel != null) {
      message = 'No priced dishes match. Many menus do not list prices, so those items stay hidden while a price limit is on.'
    } else if (dietary.length) {
      message = 'No dishes matched those dietary filters. Filters are estimated from the menu text and can miss unlisted ingredients.'
    }
  }

  return {
    found: ranked.length,
    items: sliced,
    query,
    dietary,
    message
  }
}

export function searchRestaurants(catalog, query, options = {}) {
  const needle = fold(query)
  if (!needle) return []
  const byName = new Map()
  for (const item of Array.isArray(catalog) ? catalog : []) {
    if (!item?.restaurant || byName.has(item.restaurant)) continue
    byName.set(item.restaurant, item)
  }
  const queryTokens = tokens(needle)
  const hits = []
  for (const item of byName.values()) {
    const name = fold(item.restaurant)
    const nameTokens = tokens(item.restaurant)
    let score = 0
    if (name === needle) score = 100
    else if (name.startsWith(needle)) score = 80
    else {
      const matched = queryTokens.filter((token) => nameTokens.some((part) => tokenFuzzy(token, part))).length
      if (matched) score = 20 + matched * 15
    }
    if (score <= 0) continue
    let distanceMiles = null
    const lat = numberOrNull(options.lat)
    const lng = numberOrNull(options.lng ?? options.lon)
    if (lat != null && lng != null && item.latitude != null && item.longitude != null) {
      distanceMiles = Math.round(haversine(lat, lng, item.latitude, item.longitude) * 0.621371 * 10) / 10
    }
    hits.push({
      id: `menu-${fold(item.restaurant).replace(/\s+/g, '-')}`,
      name: item.restaurant,
      location: item.address || '',
      latitude: item.latitude,
      longitude: item.longitude,
      distanceMiles,
      score,
      isMenuCatalog: true
    })
  }
  const maxDistanceMiles = numberOrNull(options.maxDistanceMiles)
  return hits
    .filter((hit) => maxDistanceMiles == null || (hit.distanceMiles != null && hit.distanceMiles <= maxDistanceMiles))
    .sort((a, b) => b.score - a.score || ((a.distanceMiles ?? 999) - (b.distanceMiles ?? 999)))
}

export function filterMenuSections(sections, options = {}) {
  const groups = Array.isArray(sections) ? sections : []
  const flat = []
  groups.forEach((section) => {
    const sectionName = section?.name || section?.category || 'Menu'
    for (const item of section?.items || []) {
      flat.push({
        ...item,
        name: item?.name || item?.dish_name || item?.dish || item?.title,
        description: item?.description || item?.desc || '',
        category: item?.category || sectionName,
        restaurant: options.restaurant || 'Menu'
      })
    }
  })
  const query = fold(options.q ?? options.query ?? '')
  const dietary = normalizeDietary(options.dietary)
  const maxPrice = numberOrNull(options.maxPrice)
  if (!query && !dietary.length && maxPrice == null && numberOrNull(options.maxPriceLevel) == null) {
    return groups
  }
  const result = findMenuItems(assembleCatalog({
    menusByName: { [options.restaurant || 'Menu']: flat },
    meta: [{ name: options.restaurant || 'Menu' }]
  }), options)
  const allowed = new Set(result.items.map((item) => fold(item.name)))
  return groups
    .map((section) => ({
      ...section,
      items: (section.items || []).filter((item) => allowed.has(fold(item?.name || item?.dish_name || item?.dish || item?.title)))
    }))
    .filter((section) => section.items.length > 0)
}

function clampLimit(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 40
  return Math.min(Math.max(Math.round(number), 1), 100)
}

export function handleFindMenuItems(body = {}, catalog = []) {
  const lat = numberOrNull(body.lat)
  const lng = numberOrNull(body.lng ?? body.lon)
  if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { status: 400, body: { error: 'lat and lng are required as numbers' } }
  }
  const started = Date.now()
  const result = findMenuItems(catalog, {
    q: body.q ?? body.query ?? '',
    lat,
    lng,
    dietary: body.dietary,
    maxPrice: body.maxPrice,
    maxPriceLevel: body.maxPriceLevel,
    maxDistanceMiles: body.maxDistanceMiles ?? body.radiusMiles,
    restaurant: body.restaurant,
    limit: clampLimit(body.limit)
  })
  return {
    status: 200,
    body: {
      ...result,
      tookMs: Date.now() - started
    }
  }
}

export function handleSearchDishes(query = {}, catalog = []) {
  const q = String(query.q || '').trim()
  if (!q && !query.dietary && query.maxPrice == null && query.maxDistanceMiles == null) {
    return { status: 400, body: { error: 'Missing search query' } }
  }
  const result = findMenuItems(catalog, {
    q,
    lat: query.lat,
    lng: query.lng ?? query.lon,
    dietary: query.dietary,
    maxPrice: query.maxPrice,
    maxPriceLevel: query.maxPriceLevel,
    maxDistanceMiles: query.maxDistanceMiles,
    limit: clampLimit(query.limit || 50)
  })
  return {
    status: 200,
    body: {
      results: result.items.map((item) => ({
        dish_name: item.dish_name,
        description: item.description,
        price: item.priceLabel || item.price,
        restaurant_name: item.restaurant?.name || null,
        address: item.restaurant?.address || null,
        latitude: item.restaurant?.latitude ?? null,
        longitude: item.restaurant?.longitude ?? null,
        distanceMiles: item.distanceMiles,
        dietary: item.dietary,
        category: item.category
      })),
      found: result.found,
      message: result.message
    }
  }
}
