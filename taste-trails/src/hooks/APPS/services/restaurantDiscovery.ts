import axios, { AxiosInstance } from 'axios'

export interface Restaurant {
  name: string
  address: string
  website: string | null
  phone: string | null
  place_id: string
  rating?: number
  types?: string[]
}

const PLACES_KEY = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_API_KEY
const CSE_KEY = process.env.GOOGLE_CUSTOM_SEARCH_KEY
const CSE_CX = process.env.GOOGLE_CUSTOM_SEARCH_CX

if (!PLACES_KEY) {
  console.warn('Warning: GOOGLE_PLACES_KEY not set. The service will fail without it.')
}

const axiosInst: AxiosInstance = axios.create({ timeout: 15000 })

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseMs = 300): Promise<T> {
  let attempt = 0
  let lastErr: any
  while (attempt < retries) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const delay = baseMs * 2 ** attempt
      await sleep(delay)
      attempt++
    }
  }
  throw lastErr
}

async function geocodeLocation(location: string) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json'
  const res = await withRetry(async () => {
    const r = await axiosInst.get(url, { params: { address: location, key: PLACES_KEY } })
    if (r.data.status !== 'OK' && r.data.status !== 'ZERO_RESULTS') throw new Error(`Geocode failed: ${r.data.status}`)
    return r.data
  })
  const first = res.results?.[0]
  if (!first) throw new Error('No geocoding results')
  return { lat: first.geometry.location.lat, lng: first.geometry.location.lng }
}

function filterNearbyResult(r: any) {
  // Exclude types that indicate delivery/takeaway or non-sit-down places
  const excludeTypes = new Set(['meal_takeaway', 'meal_delivery', 'convenience_store', 'gas_station', 'food_truck'])
  for (const t of r.types || []) if (excludeTypes.has(t)) return false

  // Exclude common fast-food chains by name heuristics
  const name = (r.name || '').toLowerCase()
  const blacklist = ['mcdonald', 'burger king', 'wendy', 'taco bell', 'subway', 'kfc', 'domino', 'dunkin', 'chipotle']
  if (blacklist.some((b) => name.includes(b))) return false

  return true
}

async function nearbySearch(lat: number, lng: number) {
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
  const results: any[] = []
  let nextPageToken: string | undefined
  let page = 0
  do {
    const params: any = {
      key: PLACES_KEY,
      location: `${lat},${lng}`,
      radius: 24000,
      type: 'restaurant'
    }
    if (nextPageToken) params.pagetoken = nextPageToken

    const res = await withRetry(async () => {
      const r = await axiosInst.get(url, { params })
      if (r.data.status && r.data.status !== 'OK' && r.data.status !== 'ZERO_RESULTS') throw new Error(`Nearby search error: ${r.data.status}`)
      return r.data
    })

    const pageResults = (res.results || []).filter(filterNearbyResult)
    results.push(...pageResults)

    nextPageToken = res.next_page_token
    page++
    if (nextPageToken) await sleep(2000) // Google requires a short pause before next_page_token becomes valid
  } while (nextPageToken && page < 3)

  return results
}

async function getPlaceDetails(place_id: string): Promise<Restaurant | null> {
  const url = 'https://maps.googleapis.com/maps/api/place/details/json'
  const params = {
    key: PLACES_KEY,
    place_id,
    fields: 'name,website,formatted_address,formatted_phone_number,rating,types'
  }

  const data = await withRetry(async () => {
    const r = await axiosInst.get(url, { params })
    if (r.data.status && r.data.status !== 'OK') throw new Error(`Place details error: ${r.data.status}`)
    return r.data
  }, 3, 200)

  const d = data.result || {}
  return {
    name: d.name || '',
    address: d.formatted_address || '',
    website: d.website || null,
    phone: d.formatted_phone_number || null,
    place_id: place_id,
    rating: d.rating,
    types: d.types || []
  }
}

const BLOCKED_DOMAINS = [
  'yelp.com',
  'tripadvisor.com',
  'doordash.com',
  'grubhub.com',
  'ubereats.com',
  'opentable.com',
  'facebook.com'
]

function isBlockedDomain(u: string) {
  try {
    const host = new URL(u).hostname.replace(/^www\./, '')
    return BLOCKED_DOMAINS.some((b) => host === b || host.endsWith(`.${b}`))
  } catch {
    return true
  }
}

function looksLikeOfficial(urlStr: string) {
  try {
    const u = new URL(urlStr)
    const host = u.hostname.replace(/^www\./, '')
    // not a path-heavy URL (avoid directories)
    const path = u.pathname || '/'
    if (path !== '/' && path.split('/').length > 2) return false
    // avoid blocked domains
    if (isBlockedDomain(urlStr)) return false
    // avoid delivery or ordering providers
    const deliveryIndicators = ['doordash', 'grubhub', 'ubereats', 'chownow', 'squareup']
    if (deliveryIndicators.some((d) => host.includes(d))) return false
    return true
  } catch {
    return false
  }
}

async function fallbackWebsiteSearch(name: string, address: string): Promise<string | null> {
  // Prefer Google Custom Search if configured
  const query = `${name} ${address} official website`
  if (CSE_KEY && CSE_CX) {
    try {
      const url = 'https://www.googleapis.com/customsearch/v1'
      const res = await withRetry(async () => await axiosInst.get(url, { params: { key: CSE_KEY, cx: CSE_CX, q: query } }), 3, 300)
      const items = res.data.items || []
      for (const it of items) {
        try {
          const link = it.link
          if (!link) continue
          if (isBlockedDomain(link)) continue
          if (!looksLikeOfficial(link)) continue
          return link
        } catch {}
      }
    } catch (e) {
        console.warn('Custom Search failed:', e instanceof Error ? e.message : String(e))
    }
  }

  // Fallback: DuckDuckGo HTML search (no API key required)
  try {
    const ddg = await withRetry(async () => {
      const r = await axiosInst.get('https://html.duckduckgo.com/html', { params: { q: query }, headers: { 'User-Agent': 'Mozilla/5.0' } })
      return r.data as string
    }, 2, 300)
    // crude parse: look for first <a class="result__a" href="..."
    const m = ddg.match(/<a[^>]+class=\"result__a\"[^>]+href=\"([^\"]+)\"/i)
    if (m && m[1]) {
      // DuckDuckGo wraps in /l/?uddg=encoded_url sometimes
      let link = m[1]
      try {
        // decode uddg if present
        if (link.includes('/l/?uddg=')) {
          const u = new URL(link, 'https://duckduckgo.com')
          const params = new URLSearchParams(u.search)
          const enc = params.get('uddg')
          if (enc) link = decodeURIComponent(enc)
        }
      } catch {}
      if (looksLikeOfficial(link)) return link
    }
  } catch (e) {
      console.warn('DuckDuckGo fallback failed:', e instanceof Error ? e.message : String(e))
  }

  return null
}

export async function discoverRestaurants(location: string): Promise<Restaurant[]> {
  if (!PLACES_KEY) throw new Error('GOOGLE_PLACES_KEY is required')
  const coords = await geocodeLocation(location)
  const nearby = await nearbySearch(coords.lat, coords.lng)

  console.info('Total nearby results (after filtering):', nearby.length)

  const out: Restaurant[] = []
  let websitesRetrieved = 0
  let fallbacksUsed = 0
  let failures = 0

  for (const r of nearby) {
    try {
      // fetch details with rate limiting
      await sleep(200)
      const details = await getPlaceDetails(r.place_id)
      if (!details) { failures++; continue }
      // ensure address exists
      if (!details.address) { continue }

      let website = details.website
      if (website) websitesRetrieved++
      if (!website) {
        const fallback = await fallbackWebsiteSearch(details.name, details.address)
        if (fallback) {
          website = fallback
          fallbacksUsed++
        }
      }

      out.push({
        name: details.name,
        address: details.address,
        website: website || null,
        phone: details.phone || null,
        place_id: details.place_id,
        rating: details.rating,
        types: details.types
      })
    } catch (e) {
      failures++
        console.warn('Failed processing place:', r.place_id, e instanceof Error ? e.message : String(e))
    }
  }

  console.info('Total restaurants returned:', out.length)
  console.info('Websites retrieved from Place Details:', websitesRetrieved)
  console.info('Fallback websites used:', fallbacksUsed)
  console.info('Failures:', failures)

  return out.filter((x) => !!x.address)
}

export default discoverRestaurants
