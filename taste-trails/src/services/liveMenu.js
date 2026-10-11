import { createRequire } from 'module'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dietaryProfile, findMenuItems } from './menuItemFinder.js'
import { getNodeMenuCatalog } from './menuCatalogNode.js'
import { menuLinksFromHtml, parseMenuHtml, parseMenuText } from './menuDocumentParser.js'
import { foldRestaurantName, knownRestaurantRecords } from './restaurantSources.js'

const require = createRequire(import.meta.url)
const defaultCacheDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/menu-cache')
const USER_AGENT = 'Mozilla/5.0 (compatible; TasteTrail/1.0; +https://tastetrails.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const OSM_USER_AGENT = 'TasteTrail/1.0 (restaurant discovery; +https://tastetrails.app)'
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter'
]
const MIN_ITEMS = 3
const DEFAULT_RADIUS_MILES = 3
const MAX_RADIUS_MILES = 8
const NEARBY_LIMIT = 20
const BACKGROUND_MENU_LIMIT = 8
const DISCOVERY_TTL_MS = 30 * 60 * 1000

function hours(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function cacheTtlMs() {
  return hours('MENU_CACHE_TTL_HOURS', 12) * 60 * 60 * 1000
}

function failureTtlMs() {
  return Math.min(cacheTtlMs(), 60 * 60 * 1000)
}

async function defaultPdfParser(buffer) {
  const pdfParse = require('pdf-parse')
  const parsed = await pdfParse(buffer)
  return parsed?.text || ''
}

function savedItemsFor(savedCatalog, name) {
  const wanted = foldRestaurantName(name)
  return savedCatalog.filter((item) => foldRestaurantName(item.restaurant) === wanted)
}

function sectionsFromItems(items) {
  const groups = new Map()
  for (const item of items || []) {
    const name = item.category || 'Menu'
    if (!groups.has(name)) groups.set(name, { name, items: [] })
    groups.get(name).items.push({
      name: item.name,
      description: item.description || '',
      category: item.category || name,
      price: item.price ?? null
    })
  }
  return [...groups.values()]
}

function catalogFromRecords(records) {
  const items = []
  for (const record of records) {
    if (record.source !== 'live' || !Array.isArray(record.items)) continue
    for (const item of record.items) {
      items.push({
        ...item,
        restaurant: record.name,
        address: record.address || null,
        latitude: record.latitude ?? null,
        longitude: record.longitude ?? null,
        approximate: Boolean(record.approximate),
        source: 'live',
        sourceUrl: record.sourceUrl || null,
        fetchedAt: record.fetchedAt || null
      })
    }
  }
  return items
}

function mergeCatalog(liveItems, savedCatalog) {
  const liveNames = new Set(liveItems.map((item) => foldRestaurantName(item.restaurant)))
  const saved = savedCatalog
    .filter((item) => !liveNames.has(foldRestaurantName(item.restaurant)))
    .map((item) => ({ ...item, source: 'saved' }))
  return [...liveItems, ...saved]
}

function milesBetween(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function radiusMiles(value) {
  const radius = Number(value)
  if (!Number.isFinite(radius) || radius <= 0) return DEFAULT_RADIUS_MILES
  const miles = radius > 100 ? radius / 1609.34 : radius
  return Math.min(miles, MAX_RADIUS_MILES)
}

function finiteCoord(value, limit) {
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null
}

export function createLiveMenuService(options = {}) {
  const cacheDir = options.cacheDir || process.env.MENU_CACHE_DIR || defaultCacheDir
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const pdfParser = options.pdfParser || defaultPdfParser
  const sources = options.sources || knownRestaurantRecords()
  const savedCatalog = options.savedCatalog || getNodeMenuCatalog()
  const now = options.now || (() => Date.now())
  const placesKey = options.placesKey !== undefined ? options.placesKey : process.env.GOOGLE_PLACES_API_KEY
  const fetchGapMs = options.fetchGapMs ?? 400
  const discoveryCache = new Map()
  const inFlightMenus = new Set()
  let refreshPromise = null
  let menuChain = Promise.resolve()

  function cachePath(name) {
    const slug = foldRestaurantName(name).replace(/\s+/g, '-') || 'unknown'
    return path.join(cacheDir, `${slug}.json`)
  }

  function readCache(name) {
    try {
      return JSON.parse(readFileSync(cachePath(name), 'utf8'))
    } catch {
      return null
    }
  }

  function writeCache(record) {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(cachePath(record.name), JSON.stringify(record, null, 2))
  }

  function readCachedRecords() {
    try {
      return readdirSync(cacheDir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
          try {
            return JSON.parse(readFileSync(path.join(cacheDir, file), 'utf8'))
          } catch {
            return null
          }
        })
        .filter(Boolean)
    } catch {
      return []
    }
  }

  function findSource(name) {
    const wanted = foldRestaurantName(name)
    return sources.find((entry) => foldRestaurantName(entry.name) === wanted) || null
  }

  async function fetchBuffer(url) {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/pdf,*/*'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000)
    })
    if (!response?.ok) return null
    const type = String(response.headers?.get?.('content-type') || '')
    const buffer = Buffer.from(await response.arrayBuffer())
    const pdf = buffer.subarray(0, 4).toString() === '%PDF' || type.includes('pdf')
    if (pdf) {
      const text = await pdfParser(buffer)
      return { kind: 'text', text, url }
    }
    return { kind: 'html', html: buffer.toString('utf8'), url }
  }

  function itemsFromDocument(document) {
    if (!document) return []
    if (document.kind === 'text') return parseMenuText(document.text)
    return parseMenuHtml(document.html)
  }

  async function itemsFromUrl(url, seen) {
    if (!url || seen.has(url)) return { items: [], url }
    seen.add(url)
    let document = null
    try {
      document = await fetchBuffer(url)
    } catch {
      return { items: [], url }
    }
    let items = itemsFromDocument(document)
    if (items.length >= MIN_ITEMS) return { items, url }
    if (document?.kind === 'html') {
      for (const link of menuLinksFromHtml(document.html, url)) {
        if (seen.has(link)) continue
        seen.add(link)
        try {
          const next = await fetchBuffer(link)
          const parsed = itemsFromDocument(next)
          if (parsed.length > items.length) {
            items = parsed
            url = link
          }
          if (items.length >= MIN_ITEMS) return { items, url: link }
        } catch {
          continue
        }
      }
    }
    return { items, url }
  }

  function resultFromRecord(record, saved) {
    if (record?.source === 'live' && Array.isArray(record.items) && record.items.length >= MIN_ITEMS) {
      let host = 'the restaurant site'
      try { host = new URL(record.sourceUrl).host } catch { host = 'the restaurant site' }
      const day = String(record.fetchedAt || '').slice(0, 10)
      return {
        name: record.name,
        source: 'live',
        sourceUrl: record.sourceUrl || null,
        website: record.website || null,
        fetchedAt: record.fetchedAt || null,
        message: `Menu retrieved ${day} from ${host}.`,
        items: record.items,
        sections: sectionsFromItems(record.items)
      }
    }
    if (saved.length > 0) {
      return {
        name: record?.name,
        source: 'saved',
        sourceUrl: null,
        website: record?.website || null,
        fetchedAt: null,
        message: `Could not retrieve a live menu for ${record?.name || 'this restaurant'}. Showing the saved menu, which may be out of date.`,
        items: saved.map((item) => ({
          name: item.name,
          description: item.description,
          category: item.category,
          price: item.price ?? null
        })),
        sections: sectionsFromItems(saved)
      }
    }
    return {
      name: record?.name,
      source: 'unavailable',
      sourceUrl: null,
      website: record?.website || null,
      fetchedAt: record?.fetchedAt || null,
      message: 'Menu not available online.',
      items: [],
      sections: []
    }
  }

  async function getRestaurantMenu(name, fetchOptions = {}) {
    const source = findSource(name) || {
      name: String(name || '').trim(),
      address: fetchOptions.address || null,
      latitude: fetchOptions.latitude ?? null,
      longitude: fetchOptions.longitude ?? null,
      approximate: fetchOptions.approximate ?? true,
      menuUrls: fetchOptions.menuUrls || [],
      websites: fetchOptions.websites || (fetchOptions.website ? [fetchOptions.website] : [])
    }
    if (!source.name) {
      return resultFromRecord({ name: '' }, [])
    }
    const saved = savedItemsFor(savedCatalog, source.name)
    const cached = readCache(source.name)
    const fresh = cached && Number(cached.expiresAt) > now()
    if (fresh && !fetchOptions.force) return resultFromRecord(cached, saved)

    const seen = new Set()
    const merged = []
    let sourceUrl = null
    function take(parsed) {
      if (!parsed?.items?.length) return
      const known = new Set(merged.map((item) => item.name.toLowerCase()))
      for (const item of parsed.items) {
        const key = String(item.name || '').toLowerCase()
        if (!key || known.has(key)) continue
        known.add(key)
        merged.push(item)
      }
      if (!sourceUrl) sourceUrl = parsed.url
    }
    for (const url of source.menuUrls || []) take(await itemsFromUrl(url, seen))
    if (merged.length < MIN_ITEMS) {
      for (const url of source.websites || []) {
        take(await itemsFromUrl(url, seen))
        if (merged.length >= MIN_ITEMS) break
      }
    }

    const fetchedAt = new Date(now()).toISOString()
    const live = merged.length >= MIN_ITEMS
    const record = {
      name: source.name,
      address: source.address || null,
      latitude: source.latitude ?? null,
      longitude: source.longitude ?? null,
      approximate: Boolean(source.approximate),
      website: (source.websites || [])[0] || null,
      source: live ? 'live' : 'unavailable',
      sourceUrl: live ? sourceUrl : null,
      fetchedAt,
      expiresAt: now() + (live ? cacheTtlMs() : failureTtlMs()),
      items: live ? merged : [],
      message: live ? null : `Could not retrieve a menu for ${source.name}.`
    }
    writeCache(record)
    return resultFromRecord(record, saved)
  }

  function hoursText(value) {
    if (!value) return null
    if (typeof value === 'string') return value
    const lines = value.weekdayDescriptions
    return Array.isArray(lines) && lines.length ? lines.join('; ') : null
  }

  function normalizePlace(place) {
    const latitude = finiteCoord(place.latitude, 90)
    const longitude = finiteCoord(place.longitude, 180)
    const websites = [...new Set((place.websites || []).filter((url) => /^https?:\/\//i.test(String(url))))]
    const menuUrls = [...new Set((place.menuUrls || []).filter((url) => /^https?:\/\//i.test(String(url))))]
    return {
      id: place.id || null,
      name: String(place.name || '').trim(),
      address: place.address || null,
      latitude,
      longitude,
      approximate: Boolean(place.approximate),
      menuUrls,
      websites,
      hours: place.hours || null,
      rating: Number.isFinite(Number(place.rating)) ? Number(place.rating) : null,
      ratingCount: Number.isFinite(Number(place.ratingCount)) ? Number(place.ratingCount) : null,
      photoName: place.photoName || null
    }
  }

  function sortPlaces(lat, lng, places) {
    return places
      .filter((place) => place.name)
      .map((place) => ({
        ...place,
        distanceMiles: place.latitude != null && place.longitude != null
          ? Math.round(milesBetween(lat, lng, place.latitude, place.longitude) * 100) / 100
          : null
      }))
      .filter((place) => place.distanceMiles == null || place.distanceMiles <= MAX_RADIUS_MILES)
      .sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99))
  }

  async function discoverGoogle(lat, lng, meters) {
    if (!placesKey) return null
    const response = await fetchImpl('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': placesKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.rating,places.userRatingCount,places.regularOpeningHours,places.photos'
      },
      body: JSON.stringify({
        includedTypes: ['restaurant'],
        maxResultCount: NEARBY_LIMIT,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: meters
          }
        }
      })
    })
    if (!response?.ok) return null
    const payload = await response.json()
    return (payload.places || []).map((place) => normalizePlace({
      id: place.id || null,
      name: place.displayName?.text || '',
      address: place.formattedAddress || null,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      websites: place.websiteUri ? [place.websiteUri] : [],
      hours: hoursText(place.regularOpeningHours),
      rating: place.rating,
      ratingCount: place.userRatingCount,
      photoName: place.photos?.[0]?.name || null
    }))
  }

  async function discoverOverpass(lat, lng, meters) {
    const query = `[out:json][timeout:25];(node["amenity"="restaurant"](around:${meters},${lat},${lng});way["amenity"="restaurant"](around:${meters},${lat},${lng});node["amenity"="fast_food"](around:${meters},${lat},${lng});way["amenity"="fast_food"](around:${meters},${lat},${lng}););out center tags;`
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': OSM_USER_AGENT
          },
          body: `data=${encodeURIComponent(query)}`
        })
        if (!response?.ok) continue
        const payload = await response.json()
        if (!Array.isArray(payload.elements)) continue
        return payload.elements.map((element) => mapOverpassElement(element))
      } catch {
        continue
      }
    }
    return []
  }

  function mapOverpassElement(element) {
      const tags = element.tags || {}
      const website = tags.website || tags['contact:website'] || tags.url || tags['contact:url'] || null
      const menu = tags.menu || tags['contact:menu'] || null
      return normalizePlace({
        id: element.id ? `osm-${element.type || 'node'}-${element.id}` : null,
        name: tags.name || '',
        address: tags['addr:full'] || [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' ') || null,
        latitude: element.lat ?? element.center?.lat,
        longitude: element.lon ?? element.center?.lon,
        menuUrls: menu ? [menu] : [],
        websites: website ? [website] : [],
        hours: tags.opening_hours || null
      })
  }

  function withKnownNearby(lat, lng, miles, places) {
    const names = new Set(places.map((place) => foldRestaurantName(place.name)))
    const extras = sources.filter((source) => {
      if (names.has(foldRestaurantName(source.name))) return false
      if (source.latitude == null || source.longitude == null) return false
      return milesBetween(lat, lng, source.latitude, source.longitude) <= miles
    }).map((source) => normalizePlace(source))
    return [...places, ...extras]
  }

  async function discoverNearby(lat, lng, miles = DEFAULT_RADIUS_MILES) {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)},${miles}`
    const cached = discoveryCache.get(key)
    if (cached && cached.expiresAt > now()) return cached.value
    const meters = Math.round(miles * 1609.34)
    let provider = 'openstreetmap'
    let places = []
    if (placesKey) {
      try {
        const google = await discoverGoogle(lat, lng, meters)
        if (google?.length) {
          places = google
          provider = 'google'
        }
      } catch {
        places = []
      }
    }
    if (!places.length) {
      try {
        places = await discoverOverpass(lat, lng, meters)
      } catch {
        places = []
      }
      provider = 'openstreetmap'
    }
    const value = {
      provider,
      places: sortPlaces(lat, lng, withKnownNearby(lat, lng, miles, places)).slice(0, NEARBY_LIMIT)
    }
    discoveryCache.set(key, { expiresAt: now() + DISCOVERY_TTL_MS, value })
    return value
  }

  async function geocodeQuery(query) {
    const text = String(query || '').trim()
    if (text.length < 2) return null
    const response = await fetchImpl(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(text)}`, {
      headers: { 'User-Agent': OSM_USER_AGENT, Accept: 'application/json' }
    })
    if (!response?.ok) return null
    const payload = await response.json()
    const hit = Array.isArray(payload) ? payload[0] : null
    const latitude = finiteCoord(hit?.lat, 90)
    const longitude = finiteCoord(hit?.lon, 180)
    if (latitude == null || longitude == null) return null
    return { latitude, longitude, label: hit.display_name || text }
  }

  function menuStatusFor(place) {
    const cached = readCache(place.name)
    if (cached?.source === 'live' && Number(cached.expiresAt) > now()) return 'ready'
    if (cached?.source === 'unavailable' && Number(cached.expiresAt) > now()) return 'unavailable'
    if (savedItemsFor(savedCatalog, place.name).length) return 'saved'
    if (!(place.websites || []).length && !(place.menuUrls || []).length) return 'unavailable'
    return 'unknown'
  }

  function publicRestaurant(place) {
    return {
      id: place.id,
      name: place.name,
      address: place.address,
      lat: place.latitude,
      lon: place.longitude,
      latitude: place.latitude,
      longitude: place.longitude,
      website: place.websites[0] || null,
      menuUrl: place.menuUrls[0] || null,
      hours: place.hours,
      rating: place.rating,
      ratingCount: place.ratingCount,
      photoName: place.photoName,
      distanceMiles: place.distanceMiles,
      menuStatus: menuStatusFor(place)
    }
  }

  function queueMenuLoads(places) {
    const pending = places.filter((place) => {
      const key = foldRestaurantName(place.name)
      if (!key || inFlightMenus.has(key)) return false
      const status = menuStatusFor(place)
      if (status === 'ready' || status === 'unavailable') return false
      return (place.websites || []).length > 0 || (place.menuUrls || []).length > 0
    }).slice(0, BACKGROUND_MENU_LIMIT)
    for (const place of pending) {
      const key = foldRestaurantName(place.name)
      inFlightMenus.add(key)
      menuChain = menuChain.then(async () => {
        if (fetchGapMs) await new Promise((resolve) => setTimeout(resolve, fetchGapMs))
        try {
          await getRestaurantMenu(place.name, place)
        } catch {
          // A failed restaurant does not stop the queue.
        } finally {
          inFlightMenus.delete(key)
        }
      })
    }
    return pending.length
  }

  async function listNearby(query = {}, { loadMenus = true } = {}) {
    const miles = radiusMiles(query.radius ?? query.radiusMiles)
    let latitude = finiteCoord(query.lat ?? query.latitude, 90)
    let longitude = finiteCoord(query.lng ?? query.lon ?? query.longitude, 180)
    let label = null
    if (latitude == null || longitude == null) {
      const geo = await geocodeQuery(query.q || query.query || query.city || query.zip)
      if (!geo) {
        return { status: 400, body: { error: 'Share a location or enter a city or ZIP.' } }
      }
      latitude = geo.latitude
      longitude = geo.longitude
      label = geo.label
    }
    const discovered = await discoverNearby(latitude, longitude, miles)
    const restaurants = discovered.places.map((place) => ({
      ...publicRestaurant(place),
      provider: discovered.provider
    }))
    const queued = loadMenus ? queueMenuLoads(discovered.places) : 0
    return {
      status: 200,
      body: {
        provider: discovered.provider,
        location: { latitude, longitude, label },
        restaurants,
        count: restaurants.length,
        menusLoading: queued
      }
    }
  }

  async function refreshNearby(lat, lng) {
    const discovered = await discoverNearby(lat, lng)
    queueMenuLoads(discovered.places)
    await menuChain
  }

  function scheduleRefresh(lat, lng) {
    if (refreshPromise) return refreshPromise
    refreshPromise = refreshNearby(lat, lng).finally(() => {
      refreshPromise = null
    })
    return refreshPromise
  }

  function searchMenus(body = {}, { schedule = true } = {}) {
    const liveItems = catalogFromRecords(readCachedRecords().filter((record) => Number(record.expiresAt) > now()))
    const catalog = mergeCatalog(liveItems, savedCatalog)
    const lat = body.lat == null || body.lat === '' ? null : Number(body.lat)
    const lng = body.lng == null || body.lng === '' ? null : Number(body.lng)
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)
    const started = Date.now()
    const result = findMenuItems(catalog, {
      q: body.q ?? body.query ?? '',
      lat: hasCoords ? lat : null,
      lng: hasCoords ? lng : null,
      dietary: body.dietary,
      maxPrice: body.maxPrice,
      maxPriceLevel: body.maxPriceLevel,
      maxDistanceMiles: body.maxDistanceMiles ?? body.radiusMiles,
      restaurant: body.restaurant,
      limit: body.limit
    })
    const named = findSource(body.restaurant || body.q || '')
    if (named && !result.items.some((item) => foldRestaurantName(item.restaurant?.name || item.restaurant) === foldRestaurantName(named.name))) {
      const cached = readCache(named.name)
      if (!cached || cached.source !== 'live') {
        const saved = savedItemsFor(savedCatalog, named.name)
        result.message = saved.length
          ? `Could not retrieve a live menu for ${named.name}. Showing the saved menu, which may be out of date.`
          : `Could not retrieve a menu for ${named.name}.`
      }
    }
    if (schedule && hasCoords) {
      scheduleRefresh(lat, lng)
      if (!result.message) result.message = 'Looking up menus at nearby restaurants.'
    }
    const liveCount = result.items.filter((item) => item.source === 'live').length
    const savedCount = result.items.filter((item) => item.source === 'saved').length
    return {
      status: 200,
      body: {
        ...result,
        tookMs: Date.now() - started,
        refreshing: Boolean(refreshPromise),
        sources: { live: liveCount, saved: savedCount }
      }
    }
  }

  async function coverage() {
    const rows = []
    for (const source of sources) {
      const menu = await getRestaurantMenu(source.name, { force: true })
      const suspicious = []
      for (const item of menu.items.slice(0, 40)) {
        const text = `${item.name} ${item.description || ''}`.toLowerCase()
        const labels = dietaryProfile(item.name, item.description).labels.map((label) => label.key)
        if (labels.includes('vegan') && /cheese|mozzarella|beef|chicken|pork|shrimp/.test(text)) suspicious.push(`${item.name}: vegan`)
        if (labels.includes('vegetarian') && /beef|chicken|pork|shrimp|bacon|fish/.test(text)) suspicious.push(`${item.name}: vegetarian`)
        if (labels.includes('halal') && /pork|bacon|wine|beer/.test(text)) suspicious.push(`${item.name}: halal`)
      }
      rows.push({
        name: source.name,
        source: menu.source,
        count: menu.items.length,
        priced: menu.items.filter((item) => item.price != null).length,
        sourceUrl: menu.sourceUrl || null,
        message: menu.message,
        suspicious
      })
    }
    return {
      restaurants: rows.length,
      live: rows.filter((row) => row.source === 'live').length,
      saved: rows.filter((row) => row.source === 'saved').length,
      unavailable: rows.filter((row) => row.source === 'unavailable').length,
      rows
    }
  }

  return {
    getRestaurantMenu,
    searchMenus,
    listNearby,
    refreshNearby,
    coverage,
    cacheDir
  }
}

let singleton = null

export function getLiveMenuService() {
  if (!singleton) singleton = createLiveMenuService()
  return singleton
}

export async function handleLiveFindMenuItems(body) {
  return getLiveMenuService().searchMenus(body || {})
}

export async function handleLiveSearchDishes(query) {
  const q = String(query.q || '').trim()
  if (!q && !query.dietary && query.maxPrice == null && query.maxDistanceMiles == null) {
    return { status: 400, body: { error: 'Missing search query' } }
  }
  const result = getLiveMenuService().searchMenus({ ...query, q }, { schedule: false })
  return {
    status: result.status,
    body: {
      results: result.body.items.map((item) => ({
        dish_name: item.dish_name,
        description: item.description,
        price: item.priceLabel || item.price,
        restaurant_name: item.restaurant?.name || null,
        address: item.restaurant?.address || null,
        latitude: item.restaurant?.latitude ?? null,
        longitude: item.restaurant?.longitude ?? null,
        distanceMiles: item.distanceMiles,
        dietary: item.dietary,
        category: item.category,
        source: item.source
      })),
      found: result.body.found,
      message: result.body.message,
      sources: result.body.sources
    }
  }
}

export async function handleNearbyRestaurants(query) {
  return getLiveMenuService().listNearby(query || {})
}

export async function handleRestaurantMenu(query) {
  const name = String(query.name || query.restaurant || '').trim()
  if (!name) return { status: 400, body: { error: 'name is required' } }
  const websites = [query.website, query.menuUrl].filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))
  const menu = await getLiveMenuService().getRestaurantMenu(name, {
    address: query.address || null,
    latitude: query.lat,
    longitude: query.lng || query.lon,
    approximate: false,
    websites
  })
  return { status: 200, body: menu }
}
