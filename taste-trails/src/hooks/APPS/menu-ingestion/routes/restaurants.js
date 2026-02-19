import express from 'express'
import { searchRestaurants, getPlaceDetails } from '../services/googlePlaces.js'
import { scrapeMenu } from '../services/menuScraper.js'
import { parseMenuWithAI } from '../services/aiMenuParser.js'
import { findMenuUrls, prioritizeDinnerMenus } from '../services/menuUrlFinder.js'
import { findDinnerMenuUrl } from '../services/dinnerMenuFinder.js'
import { query } from '../db/client.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

const BLOCKED_HOSTS = ['yelp.com', 'doordash.com', 'ubereats.com', 'grubhub.com']

const isBlockedHost = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))
  } catch {
    return true
  }
}

const sanitizeText = (text = '') => text.replace(/\s+/g, ' ').trim()

const normalizePrice = (raw) => {
  if (!raw) return null
  const cleaned = raw.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const value = parseFloat(cleaned)
  return Number.isFinite(value) ? value : null
}

async function getCachedMenu(restaurantId) {
  const cached = await query('select menu_json from menu_cache where restaurant_id = $1', [restaurantId])
  if (cached.rows.length) return cached.rows[0].menu_json
  return null
}

async function upsertRestaurant(details) {
  const res = await query(
    `insert into restaurants (name, address, place_id, website_url, menu_url)
     values ($1, $2, $3, $4, $5)
     on conflict (place_id) do update
     set name = excluded.name,
         address = excluded.address,
         website_url = excluded.website_url,
         menu_url = coalesce(excluded.menu_url, restaurants.menu_url),
         updated_at = now()
     returning *`,
    [details.name, details.address, details.place_id, details.website_url, details.menu_url]
  )
  return res.rows[0]
}

async function recordAttempt(restaurantId, status, errorMessage = null) {
  const existing = await query(
    'select attempt_count from ingestion_attempts where restaurant_id = $1',
    [restaurantId]
  )
  if (existing.rows.length) {
    const nextCount = existing.rows[0].attempt_count + 1
    await query(
      `update ingestion_attempts
       set status = $2, error_message = $3, attempt_count = $4, last_attempt_at = now()
       where restaurant_id = $1`,
      [restaurantId, status, errorMessage, nextCount]
    )
  } else {
    await query(
      `insert into ingestion_attempts (restaurant_id, status, error_message, attempt_count)
       values ($1, $2, $3, 1)`,
      [restaurantId, status, errorMessage]
    )
  }
}

async function shouldThrottle(restaurantId) {
  const res = await query(
    `select attempt_count, last_attempt_at
     from ingestion_attempts
     where restaurant_id = $1`,
    [restaurantId]
  )
  if (!res.rows.length) return false
  const { attempt_count, last_attempt_at } = res.rows[0]
  const last = new Date(last_attempt_at)
  const minutes = (Date.now() - last.getTime()) / 60000
  return attempt_count >= 3 && minutes < 30
}

async function discoverMenuUrl(websiteUrl) {
  if (!websiteUrl || isBlockedHost(websiteUrl)) return null
  try {
    const dinnerResult = await findDinnerMenuUrl(websiteUrl)
    if (dinnerResult?.status === 'success' && dinnerResult.bestMatch) {
      if (!isBlockedHost(dinnerResult.bestMatch)) return dinnerResult.bestMatch
    }

    const menuLinks = await findMenuUrls(websiteUrl)
    const prioritized = prioritizeDinnerMenus(menuLinks)
      .filter((link) => !isBlockedHost(link))

    if (prioritized.length) return prioritized[0]

    const res = await fetch(websiteUrl)
    if (!res.ok) return null
    const html = await res.text()
    const menuMatch = html.match(/href=["']([^"']*menu[^"']*)["']/i)
    if (!menuMatch) return null
    const link = menuMatch[1]
    const menuUrl = link.startsWith('http') ? link : new URL(link, websiteUrl).toString()
    if (isBlockedHost(menuUrl)) return null
    return menuUrl
  } catch (e) {
    return null
  }
}

async function persistMenu({ restaurantId, source, rawUrl, rawHtml, rawText, menuJson }) {
  const menuRes = await query(
    `insert into menus (restaurant_id, source, raw_url, raw_html, raw_text)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [restaurantId, source, rawUrl, rawHtml, rawText]
  )
  const menuId = menuRes.rows[0].id

  for (let s = 0; s < menuJson.sections.length; s += 1) {
    const section = menuJson.sections[s]
    const sectionRes = await query(
      `insert into menu_sections (menu_id, name, position)
       values ($1, $2, $3)
       returning id`,
      [menuId, sanitizeText(section.name), s]
    )
    const sectionId = sectionRes.rows[0].id
    const items = section.items || []
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      await query(
        `insert into menu_items (section_id, name, description, price, position)
         values ($1, $2, $3, $4, $5)`,
        [
          sectionId,
          sanitizeText(item.name),
          sanitizeText(item.description || ''),
          normalizePrice(item.price),
          i
        ]
      )
    }
  }

  await query(
    `insert into menu_cache (restaurant_id, menu_json)
     values ($1, $2)
     on conflict (restaurant_id) do update set menu_json = excluded.menu_json`,
    [restaurantId, menuJson]
  )
}

// POST /restaurants/search
router.post('/search', async (req, res) => {
  try {
    const { query: q, location } = req.body || {}
    if (!q) return res.status(400).json({ error: 'query is required' })

    const results = await searchRestaurants(q, location)
    const payload = []

    for (const r of results) {
      const details = {
        name: r.name,
        address: r.formatted_address,
        place_id: r.place_id,
        website_url: null,
        menu_url: null
      }
      const saved = await upsertRestaurant(details)
      payload.push(saved)
    }

    res.json({ results: payload })
  } catch (e) {
    logger.error('search error', e)
    res.status(500).json({ error: 'Search failed' })
  }
})

// Helpful GET for browsers / accidental GETs
router.get('/search', (req, res) => {
  res.json({
    message: 'This endpoint expects POST. POST /restaurants/search { query, location }',
    example: { query: 'sushi', location: { lat: 35.22, lng: -80.84, radiusMeters: 5000 } }
  })
})

// Save restaurant for a user and optionally trigger ingestion
router.post('/:id/save', async (req, res) => {
  try {
    const restaurantId = req.params.id
    const userId = req.body.user_id || 'user1'
    // upsert into saved_restaurants
    await query(
      `insert into saved_restaurants (user_id, restaurant_id)
       values ($1, $2)
       on conflict (user_id, restaurant_id) do nothing`,
      [userId, restaurantId]
    )

    // Optionally trigger ingestion async (fire-and-forget)
    (async () => {
      try {
        // attempt to ingest by restaurant id
        const found = await query('select place_id from restaurants where id = $1', [restaurantId])
        if (found.rows.length) {
          const placeId = found.rows[0].place_id
          if (placeId) {
            // perform ingest by calling existing logic via fetch to local endpoint
            try {
              await fetch(`http://localhost:${process.env.PORT || 8081}/restaurants/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ place_id: placeId })
              })
            } catch (e) {
              logger.warn('async ingest trigger failed', e.message)
            }
          }
        }
      } catch (e) {
        logger.warn('save trigger failed', e.message)
      }
    })()

    res.json({ success: true })
  } catch (e) {
    logger.error('save error', e)
    res.status(500).json({ error: 'Failed to save restaurant' })
  }
})

// List saved restaurants for a user
router.get('/saved', async (req, res) => {
  try {
    const userId = req.query.user_id || 'user1'
    const saved = await query(
      `select r.* from saved_restaurants s join restaurants r on s.restaurant_id = r.id where s.user_id = $1 order by s.created_at desc`,
      [userId]
    )
    // attach menu cache if exists
    const out = []
    for (const r of saved.rows) {
      const cached = await query('select menu_json from menu_cache where restaurant_id = $1', [r.id])
      out.push({ restaurant: r, menu: cached.rows[0]?.menu_json || null })
    }
    res.json({ saved: out })
  } catch (e) {
    logger.error('saved list error', e)
    res.status(500).json({ error: 'Failed to list saved restaurants' })
  }
})

// POST /restaurants/ingest
router.post('/ingest', async (req, res) => {
  try {
    const { place_id, restaurant_id } = req.body || {}
    if (!place_id && !restaurant_id) {
      return res.status(400).json({ error: 'place_id or restaurant_id required' })
    }

    let restaurant

    if (restaurant_id) {
      const found = await query('select * from restaurants where id = $1', [restaurant_id])
      restaurant = found.rows[0]
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' })
    }

    if (!restaurant && place_id) {
      const details = await getPlaceDetails(place_id)
      const menuUrl = await discoverMenuUrl(details.website)
      restaurant = await upsertRestaurant({
        name: details.name,
        address: details.formatted_address,
        place_id: details.place_id,
        website_url: details.website || null,
        menu_url: menuUrl
      })
    }

    const cached = await getCachedMenu(restaurant.id)
    if (cached) return res.json(cached)

    if (await shouldThrottle(restaurant.id)) {
      return res.status(429).json({ error: 'Too many ingestion attempts. Try later.' })
    }

    if (!restaurant.menu_url) {
      await recordAttempt(restaurant.id, 'failed', 'No menu URL')
      return res.status(400).json({ error: 'Menu URL not found' })
    }

    if (isBlockedHost(restaurant.menu_url)) {
      await recordAttempt(restaurant.id, 'failed', 'Blocked host')
      return res.status(400).json({ error: 'Menu host is blocked' })
    }

    const scrapeResult = await scrapeMenu(restaurant.menu_url)
    let menuJson = {
      restaurant_id: restaurant.id,
      sections: scrapeResult.sections || []
    }

    let source = 'scrape'
    if (!menuJson.sections.length) {
      const ai = await parseMenuWithAI(scrapeResult.rawText || scrapeResult.rawHtml || '')
      menuJson = {
        restaurant_id: restaurant.id,
        sections: ai.sections || []
      }
      source = 'ai'
    }

    await persistMenu({
      restaurantId: restaurant.id,
      source,
      rawUrl: restaurant.menu_url,
      rawHtml: scrapeResult.rawHtml,
      rawText: scrapeResult.rawText,
      menuJson
    })

    await recordAttempt(restaurant.id, 'success')

    res.json(menuJson)
  } catch (e) {
    logger.error('ingest error', e)
    res.status(500).json({ error: 'Ingestion failed' })
  }
})

// Helpful GET for browsers / accidental GETs
router.get('/ingest', (req, res) => {
  res.json({
    message: 'This endpoint expects POST. POST /restaurants/ingest { place_id } or { restaurant_id }',
    example: { place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4' }
  })
})

// GET /restaurants/:id/menu
router.get('/:id/menu', async (req, res) => {
  try {
    const cached = await getCachedMenu(req.params.id)
    if (!cached) return res.status(404).json({ error: 'Menu not found' })
    res.json(cached)
  } catch (e) {
    logger.error('menu fetch error', e)
    res.status(500).json({ error: 'Failed to fetch menu' })
  }
})

export default router
