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
const MIN_ITEMS = 3

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

export function createLiveMenuService(options = {}) {
  const cacheDir = options.cacheDir || process.env.MENU_CACHE_DIR || defaultCacheDir
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const pdfParser = options.pdfParser || defaultPdfParser
  const sources = options.sources || knownRestaurantRecords()
  const savedCatalog = options.savedCatalog || getNodeMenuCatalog()
  const now = options.now || (() => Date.now())
  let refreshPromise = null

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
      fetchedAt: record?.fetchedAt || null,
      message: `Could not retrieve a menu for ${record?.name || 'this restaurant'}.`,
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
      approximate: true,
      menuUrls: fetchOptions.menuUrls || [],
      websites: fetchOptions.websites || []
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

  async function discoverNearby(lat, lng) {
    const key = process.env.GOOGLE_PLACES_API_KEY
    if (key) {
      try {
        const response = await fetchImpl('https://places.googleapis.com/v1/places:searchNearby', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri'
          },
          body: JSON.stringify({
            includedTypes: ['restaurant'],
            maxResultCount: 10,
            locationRestriction: {
              circle: {
                center: { latitude: Number(lat), longitude: Number(lng) },
                radius: 2000
              }
            }
          })
        })
        if (response?.ok) {
          const payload = await response.json()
          const places = Array.isArray(payload.places) ? payload.places : []
          return places.map((place) => ({
            name: place.displayName?.text || '',
            address: place.formattedAddress || null,
            latitude: place.location?.latitude ?? null,
            longitude: place.location?.longitude ?? null,
            approximate: false,
            menuUrls: [],
            websites: place.websiteUri ? [place.websiteUri] : []
          })).filter((place) => place.name)
        }
      } catch {
        // Fall through to OpenStreetMap when Places is unreachable.
      }
    }
    const query = `[out:json][timeout:15];(node["amenity"~"restaurant|fast_food"](around:2000,${lat},${lng});way["amenity"~"restaurant|fast_food"](around:2000,${lat},${lng}););out center tags 12;`
    const response = await fetchImpl('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT
      },
      body: `data=${encodeURIComponent(query)}`
    })
    if (!response?.ok) return []
    const payload = await response.json()
    return (payload.elements || []).map((element) => {
      const tags = element.tags || {}
      const website = tags.website || tags['contact:website'] || null
      const menu = tags.menu || tags['contact:menu'] || null
      return {
        name: tags.name || '',
        address: tags['addr:full'] || [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' ') || null,
        latitude: element.lat ?? element.center?.lat ?? null,
        longitude: element.lon ?? element.center?.lon ?? null,
        approximate: false,
        menuUrls: menu ? [menu] : [],
        websites: website ? [website] : []
      }
    }).filter((place) => place.name).slice(0, 12)
  }

  async function refreshNearby(lat, lng) {
    const jobs = [...sources]
    try {
      const nearby = await discoverNearby(lat, lng)
      for (const place of nearby) {
        if (!sources.some((entry) => foldRestaurantName(entry.name) === foldRestaurantName(place.name))) {
          jobs.push(place)
        }
      }
    } catch {
      // Known restaurants can still refresh when discovery fails.
    }
    const queue = jobs.filter((job) => {
      const cached = readCache(job.name)
      return !(cached && Number(cached.expiresAt) > now() && cached.source === 'live')
    }).slice(0, 8)
    let cursor = 0
    async function worker() {
      while (cursor < queue.length) {
        const job = queue[cursor]
        cursor += 1
        await getRestaurantMenu(job.name, job)
      }
    }
    await Promise.all([worker(), worker()])
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
    if (schedule && hasCoords) scheduleRefresh(lat, lng)
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

export async function handleRestaurantMenu(query) {
  const name = String(query.name || query.restaurant || '').trim()
  if (!name) return { status: 400, body: { error: 'name is required' } }
  const menu = await getLiveMenuService().getRestaurantMenu(name, {
    latitude: query.lat,
    longitude: query.lng || query.lon,
    websites: query.website ? [query.website] : []
  })
  return { status: 200, body: menu }
}
