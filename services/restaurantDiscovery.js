import axios from 'axios'

const PLACES_KEY = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_API_KEY
const CSE_KEY = process.env.GOOGLE_CUSTOM_SEARCH_KEY
const CSE_CX = process.env.GOOGLE_CUSTOM_SEARCH_CX

if (!PLACES_KEY) console.warn('Warning: GOOGLE_PLACES_KEY not set. Discovery may fail without it.')

const axiosInst = axios.create({ timeout: 15000 })

const COMMON_MENU_PATHS = ['/menu','/menus','/food','/dinner','/lunch','/brunch','/drinks']
const ORDERING_PROVIDERS = ['toasttab.com','order.toasttab.com','squareup.com','square.site','clover.com','ubereats.com','chownow.com','grubhub.com','doordash.com']

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function withRetry(fn, retries = 3, baseMs = 300) {
  let attempt = 0
  let lastErr
  while (attempt < retries) {
    try { return await fn() } catch (e) { lastErr = e; await sleep(baseMs * 2 ** attempt); attempt++ }
  }
  throw lastErr
}

async function geocodeLocation(location) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json'
  const res = await withRetry(async () => {
    const r = await axiosInst.get(url, { params: { address: location, key: PLACES_KEY } })
    if (r.data.status && r.data.status !== 'OK' && r.data.status !== 'ZERO_RESULTS') throw new Error('Geocode failed: ' + r.data.status)
    return r.data
  })
  const first = res.results && res.results[0]
  if (!first) throw new Error('No geocoding results')
  return { lat: first.geometry.location.lat, lng: first.geometry.location.lng }
}

function filterNearbyResult(r) {
  const excludeTypes = new Set(['meal_takeaway', 'meal_delivery', 'convenience_store', 'gas_station', 'food_truck'])
  for (const t of r.types || []) if (excludeTypes.has(t)) return false
  const name = (r.name || '').toLowerCase()
  const blacklist = ['mcdonald', 'burger king', 'wendy', 'taco bell', 'subway', 'kfc', 'domino', 'dunkin', 'chipotle']
  if (blacklist.some((b) => name.includes(b))) return false
  return true
}

async function nearbySearch(lat, lng) {
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
  const results = []
  let nextPageToken
  let page = 0
  do {
    const params = { key: PLACES_KEY, location: `${lat},${lng}`, radius: 24000, type: 'restaurant' }
    if (nextPageToken) params.pagetoken = nextPageToken
    const res = await withRetry(async () => {
      const r = await axiosInst.get(url, { params })
      if (r.data.status && r.data.status !== 'OK' && r.data.status !== 'ZERO_RESULTS') throw new Error('Nearby search error: ' + r.data.status)
      return r.data
    })
    const pageResults = (res.results || []).filter(filterNearbyResult)
    results.push(...pageResults)
    nextPageToken = res.next_page_token
    page++
    if (nextPageToken) await sleep(2000)
  } while (nextPageToken && page < 3)
  return results
}

async function getPlaceDetails(place_id) {
  const url = 'https://maps.googleapis.com/maps/api/place/details/json'
  const params = { key: PLACES_KEY, place_id, fields: 'name,website,formatted_address,formatted_phone_number,rating,types' }
  const data = await withRetry(async () => {
    const r = await axiosInst.get(url, { params })
    if (r.data.status && r.data.status !== 'OK') throw new Error('Place details error: ' + r.data.status)
    return r.data
  }, 3, 200)
  const d = data.result || {}
  return { name: d.name || '', address: d.formatted_address || '', website: d.website || null, phone: d.formatted_phone_number || null, place_id, rating: d.rating, types: d.types || [] }
}

const BLOCKED_DOMAINS = ['yelp.com','tripadvisor.com','doordash.com','grubhub.com','ubereats.com','opentable.com','facebook.com']
function isBlockedDomain(u) { try { const host = new URL(u).hostname.replace(/^www\./,''); return BLOCKED_DOMAINS.some((b)=>host===b||host.endsWith('.'+b)) } catch { return true } }
function looksLikeOfficial(urlStr) { try { const u = new URL(urlStr); const host = u.hostname.replace(/^www\./,''); const path = u.pathname || '/'; if (path !== '/' && path.split('/').length > 2) return false; if (isBlockedDomain(urlStr)) return false; const deliveryIndicators = ['doordash','grubhub','ubereats','chownow','squareup']; if (deliveryIndicators.some((d)=>host.includes(d))) return false; return true } catch { return false } }

function normalizeBase(urlStr) {
  try {
    const u = new URL(urlStr)
    return u.origin
  } catch {
    return null
  }
}

async function fetchHtml(url) {
  try {
    const r = await axiosInst.get(url, { responseType: 'text', maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0' } })
    return { status: r.status, data: r.data, headers: r.headers }
  } catch (e) {
    return { error: e }
  }
}

function extractLinksFromHtml(html, base) {
  const links = new Set()
  try {
    const hrefRe = /href\s*=\s*\"([^\"]+)\"/ig
    let m
    while ((m = hrefRe.exec(html))) {
      let href = m[1]
      if (!href) continue
      // ignore anchors and mailto
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue
      try {
        const u = new URL(href, base)
        links.add(u.href)
      } catch { }
    }
  } catch {}
  return Array.from(links)
}

function isPdfLink(u) {
  try {
    const U = new URL(u)
    return U.pathname.toLowerCase().endsWith('.pdf') || u.toLowerCase().includes('menu') && U.pathname.toLowerCase().includes('.pdf')
  } catch { return false }
}

function detectOrderingProvider(u) {
  try {
    const host = new URL(u).hostname.replace(/^www\./,'')
    return ORDERING_PROVIDERS.find(p => host === p || host.endsWith('.' + p)) || null
  } catch { return null }
}

async function crawlSiteForMenus(website) {
  const base = normalizeBase(website)
  if (!base) return []
  const found = new Map()
  // Always fetch homepage
  const homepage = await fetchHtml(base)
  if (!homepage.error && homepage.status && String(homepage.status).startsWith('2')) {
    found.set(base, { url: base, type: 'html', status: homepage.status, snippet: String(homepage.data).slice(0,1000) })
    const links = extractLinksFromHtml(homepage.data, base)
    for (const l of links) {
      if (isPdfLink(l)) found.set(l, { url: l, type: 'pdf' })
      const prov = detectOrderingProvider(l)
      if (prov) found.set(l, { url: l, type: 'ordering', provider: prov })
    }
  }

  // Crawl common menu paths under the same origin
  for (const p of COMMON_MENU_PATHS) {
    try {
      const url = new URL(p, base).href
      if (found.has(url)) continue
      const res = await fetchHtml(url)
      if (!res.error && res.status && String(res.status).startsWith('2')) {
        found.set(url, { url, type: 'html', status: res.status, snippet: String(res.data).slice(0,1000) })
        const links = extractLinksFromHtml(res.data, url)
        for (const l of links) {
          if (isPdfLink(l)) found.set(l, { url: l, type: 'pdf' })
          const prov = detectOrderingProvider(l)
          if (prov) found.set(l, { url: l, type: 'ordering', provider: prov })
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // If homepage didn't reveal PDFs or ordering, try to scan a bit more (first-level links)
  try {
    const homepageHtml = homepage && homepage.data ? homepage.data : ''
    const firstLevel = extractLinksFromHtml(homepageHtml, base)
    for (const l of firstLevel) {
      if (found.has(l)) continue
      // only follow same origin or obvious menu pdfs
      try {
        const u = new URL(l)
        if (u.origin !== base && !isPdfLink(l) && !detectOrderingProvider(l)) continue
        const res = await fetchHtml(l)
        if (!res.error && res.status && String(res.status).startsWith('2')) {
          const type = isPdfLink(l) ? 'pdf' : (detectOrderingProvider(l) ? 'ordering' : 'html')
          found.set(l, { url: l, type, status: res.status, snippet: String(res.data).slice(0,1000) })
        }
      } catch {}
    }
  } catch {}

  // Return as array preserving insertion order
  return Array.from(found.values())
}

async function fallbackWebsiteSearch(name, address) {
  const query = `${name} ${address} official website`
  if (CSE_KEY && CSE_CX) {
    try {
      const url = 'https://www.googleapis.com/customsearch/v1'
      const res = await withRetry(async () => await axiosInst.get(url, { params: { key: CSE_KEY, cx: CSE_CX, q: query } }), 3, 300)
      const items = res.data.items || []
      for (const it of items) {
        const link = it.link
        if (!link) continue
        if (isBlockedDomain(link)) continue
        if (!looksLikeOfficial(link)) continue
        return link
      }
    } catch (e) {
      console.warn('Custom Search failed:', e instanceof Error ? e.message : String(e))
    }
  }
  try {
    const ddg = await withRetry(async () => {
      const r = await axiosInst.get('https://html.duckduckgo.com/html', { params: { q: query }, headers: { 'User-Agent': 'Mozilla/5.0' } })
      return r.data
    }, 2, 300)
    const m = ddg.match(/<a[^>]+class=\"result__a\"[^>]+href=\"([^\"]+)\"/i)
    if (m && m[1]) {
      let link = m[1]
      try {
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

async function discoverRestaurants(location) {
  if (!PLACES_KEY) throw new Error('GOOGLE_PLACES_KEY is required')
  const coords = await geocodeLocation(location)
  const nearby = await nearbySearch(coords.lat, coords.lng)
  console.info('Total nearby results (after filtering):', nearby.length)
  const out = []
  let websitesRetrieved = 0
  let fallbacksUsed = 0
  let failures = 0
  for (const r of nearby) {
    try {
      await sleep(200)
      const details = await getPlaceDetails(r.place_id)
      if (!details) { failures++; continue }
      if (!details.address) continue
      let website = details.website
      if (website) websitesRetrieved++
      if (!website) {
        const fallback = await fallbackWebsiteSearch(details.name, details.address)
        if (fallback) { website = fallback; fallbacksUsed++ }
      }
      let discovered = []
      if (website) {
        try { discovered = await crawlSiteForMenus(website) } catch (e) { console.warn('Crawl failed for', website, e && e.message) }
      }
      out.push({ name: details.name, address: details.address, website: website || null, phone: details.phone || null, place_id: details.place_id, rating: details.rating, types: details.types, discoveredMenuPages: discovered })
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

async function discoverNearbyCoords(lat, lng) {
  if (!PLACES_KEY) throw new Error('GOOGLE_PLACES_KEY is required')
  const nearby = await nearbySearch(lat, lng)
  console.info('Total nearby results (after filtering):', nearby.length)
  const out = []
  let websitesRetrieved = 0
  let fallbacksUsed = 0
  let failures = 0
  for (const r of nearby) {
    try {
      await sleep(200)
      const details = await getPlaceDetails(r.place_id)
      if (!details) { failures++; continue }
      if (!details.address) continue
      let website = details.website
      if (website) websitesRetrieved++
      if (!website) {
        const fallback = await fallbackWebsiteSearch(details.name, details.address)
        if (fallback) { website = fallback; fallbacksUsed++ }
      }
      let discovered = []
      if (website) {
        try { discovered = await crawlSiteForMenus(website) } catch (e) { console.warn('Crawl failed for', website, e && e.message) }
      }
      out.push({ name: details.name, address: details.address, website: website || null, phone: details.phone || null, place_id: details.place_id, rating: details.rating, types: details.types, discoveredMenuPages: discovered })
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

export { discoverRestaurants, discoverNearbyCoords, crawlSiteForMenus };
