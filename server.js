import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { discoverRestaurants } from './services/restaurantDiscovery.js';
import fs from 'fs';
import path from 'path';
// import supabaseInstance from './services/supabaseClient';

// Load environment variables
dotenv.config();

console.log("🔥 THIS INDEX.JS IS RUNNING");
console.log("FILE PATH:", import.meta.url);

// Initialize Express app
const app = express();

// Export necessary functions
export default {
  // Add exported functions here
};

// discovery route
// initialize Supabase client (must be configured in production)
// import supabaseInstance from './services/supabaseClient'

app.post('/run-city', async (req, res) => {
  try {
    const city = req.body.city;
    if (!city) return res.status(400).json({ error: 'city is required' });

    console.log("Fetching restaurants for:", city);

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurants in ${city}, SC&type=restaurant&key=${process.env.GOOGLE_PLACES_API_KEY}`;

    const { data } = await axios.get(url);

    if (!data.results || data.results.length === 0) {
      return res.json({ message: 'No restaurants found.' });
    }

    let insertedCount = 0;

    // Skip inserting into Supabase here — just return the fetched restaurants
    const restaurants = (data.results || []).map((place) => ({
      name: place.name,
      address: place.formatted_address,
      google_place_id: place.place_id
    }));

    return res.json({ count: restaurants.length, restaurants });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Production-ready discovery endpoint
app.post('/api/discover', async (req, res) => {
  try {
    const { location } = req.body || {}
    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      return res.status(400).json({ error: 'location is required' })
    }
    if (location.length > 200) return res.status(400).json({ error: 'location too long' })

    console.info('Discovery requested for location:', location)

    // caching: try to reuse discovered results if recent
    const cacheDir = path.join(process.cwd(), 'cache')
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
    const citySlug = (location.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
    const discoveryCachePath = path.join(cacheDir, `discovered_${citySlug}.json`)
    let restaurants = null
    try {
      if (fs.existsSync(discoveryCachePath)) {
        const stats = fs.statSync(discoveryCachePath)
        const age = Date.now() - stats.mtimeMs
        if (age < 24 * 60 * 60 * 1000) {
          console.log('Using cached discovery')
          restaurants = JSON.parse(fs.readFileSync(discoveryCachePath, 'utf8'))
        }
      }
    } catch (e) {
      restaurants = null
    }
    if (!restaurants) {
      restaurants = await discoverRestaurants(location.trim())
      try { fs.writeFileSync(discoveryCachePath, JSON.stringify(restaurants, null, 2), 'utf8') } catch (e) {}
    }

    const total = restaurants.length
    const withWeb = restaurants.filter((r) => !!r.website).length

    console.info('Discovery complete:', { total, withWeb })

    return res.json({ total, restaurants })
  } catch (err) {
    console.error('Discovery API error:', err instanceof Error ? err.message : String(err))
    return res.status(500).json({ error: 'internal server error' })
  }
})

// Simple homepage so visiting `/` shows something instead of 404
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>App Home</title>
    <style>body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:20px}input{padding:8px;min-width:280px}button{padding:8px 12px;margin-left:8px}pre{background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto}</style>
  </head>
  <body>
    <h1>App is running</h1>
    <p>Use the form below to call the API endpoints and view JSON responses.</p>
    <div>
        <label for="location">Location:</label>
        <input id="location" value="Charlotte, NC" />
        <button id="discover">Discover</button>
        <button id="discover-ingest">Discover &amp; Ingest</button>
      </div>
      <h3>Nearby Menu Search</h3>
      <div>
        <label for="dish">Dish / Query:</label>
        <input id="dish" placeholder="e.g. 'margherita' or 'chicken tikka'" />
        <button id="find-nearby">Find Nearby Items (use my location)</button>
    </div>
    <h3>Response</h3>
    <div id="status" style="margin-bottom:8px;color:#555">Idle</div>
    <pre id="output">Click a button to run an API call.</pre>

    <script>
      const out = (v) => { document.getElementById('output').textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2) }
      const setStatus = (s) => { document.getElementById('status').textContent = s }
      async function call(path){
        const loc = document.getElementById('location').value || ''
        setStatus('Calling '+path+'...')
        out('')
        try{
          const res = await fetch(path, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({location:loc})})
          const text = await res.text()
          try{ const json = JSON.parse(text); out(json); } catch(e){ out(text) }
          setStatus('HTTP '+res.status+' '+res.statusText)
        }catch(e){ setStatus('Error'); out(String(e)) }
      }

      async function findNearbyItems(){
        if (!navigator.geolocation) { setStatus('Geolocation not supported'); return }
        setStatus('Getting location...')
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          const q = document.getElementById('dish').value || ''
          setStatus('Searching nearby menus...')
          out('')
          try{
            const res = await fetch('/api/find-menu-items', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ lat, lng, q }) })
            const json = await res.json()
            out(json)
            setStatus('HTTP '+res.status+' '+res.statusText)
          }catch(e){ setStatus('Error'); out(String(e)) }
        }, (err) => { setStatus('Location error: '+err.message) }, { enableHighAccuracy: true, timeout: 10000 })
      }
      document.getElementById('discover').addEventListener('click', ()=>call('/api/discover'))
      document.getElementById('discover-ingest').addEventListener('click', ()=>call('/api/discover-and-ingest'))
      document.getElementById('find-nearby').addEventListener('click', ()=>findNearbyItems())
    </script>
  </body>
  </html>`)
})

// POST /api/discover-and-ingest
app.post('/api/discover-and-ingest', async (req, res) => {
  try {
    const { location } = req.body || {}
    if (!location || typeof location !== 'string' || location.trim().length === 0) return res.status(400).json({ error: 'location is required' })
    if (location.length > 200) return res.status(400).json({ error: 'location too long' })

    console.info('Discover-and-ingest requested for:', location)

    const { fetchMenu } = require('./services/menuFetcher')
    const { extractFullMenu } = require('./services/menuExtractor')
    const { normalizeMenu } = require('./services/menuNormalizer')
    const { storeMenu, upsertRestaurant } = require('./services/menuStorage')

    const restaurants = await discoverRestaurants(location.trim())
    // TEMPORARY: limit to first 5 restaurants for performance testing
    const testRestaurants = restaurants.slice(0, 5)
    const startTime = Date.now()

    let restaurantsProcessed = 0
    let menusFetched = 0
    let totalDishesInserted = 0
    let successfulExtractions = 0
    let failedExtractions = 0
    const failures = []
    console.log('Starting ingestion loop...')
    for (const r of testRestaurants) {
      console.log('Processing restaurant:', r && (r.name || r.place_id) ? (r.name || r.place_id) : 'unknown')
      restaurantsProcessed++
      let success = false
      let lastError = null
      const maxAttempts = 3
      const delays = [500, 1000, 2000]

      // Do not attempt retries for restaurants without a website
      if (!r.website) {
        failures.push({ place_id: r.place_id || null, error: 'no website, skipped' })
        continue
      }

      for (let attempt = 0; attempt < maxAttempts && !success; attempt++) {
        try {
          if (attempt > 0) console.info(`Retry ${attempt} for Restaurant ${r.name || r.place_id || 'unknown'}`)

          const fetched = await fetchMenu(r)

          // If no menu found, do not retry per requirements
          if (!fetched || !fetched.rawMenuText) {
            lastError = 'no menu found'
            failedExtractions++
            break
          }

          // proceed with extraction/normalize/store (with caching)
          const extractedDir = path.join(process.cwd(), 'cache', 'extracted')
          try { if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir, { recursive: true }) } catch (e) {}
          const slugBaseLocal = (r.name || r.place_id || r.website || '')
          const rslugLocal = (slugBaseLocal.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + (r.place_id ? `-${r.place_id}` : '')
          const extractedCachePathLocal = path.join(extractedDir, `${rslugLocal}.json`)
          let extracted = null
          if (fs.existsSync(extractedCachePathLocal)) {
            console.log('Using cached extraction')
            try { extracted = JSON.parse(fs.readFileSync(extractedCachePathLocal, 'utf8')) } catch (e) { extracted = null }
          }
          if (!extracted) {
            extracted = await extractFullMenu(fetched.rawMenuText)
            try { fs.writeFileSync(extractedCachePathLocal, JSON.stringify(extracted, null, 2), 'utf8') } catch (e) {}
          }
          // count extracted dishes
          try {
            const extractedDishCount = (extracted && Array.isArray(extracted.categories)) ? extracted.categories.reduce((acc, c) => acc + ((c.items && c.items.length) || 0), 0) : 0
            if (extractedDishCount > 0) successfulExtractions++
            else failedExtractions++
          } catch (countErr) {
            failedExtractions++
          }

          const normalized = normalizeMenu(extracted)
          const storeRes = await storeMenu(r, normalized)
          totalDishesInserted += (storeRes.dishesInserted || 0)
          menusFetched++
          success = true
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e)
          failedExtractions++
          // If we have more attempts left, wait exponential backoff then retry
          if (attempt < maxAttempts - 1) {
            const retryNumber = attempt + 1
            console.info(`Retry ${retryNumber} for Restaurant ${r.name || r.place_id || 'unknown'}`)
            const delay = delays[attempt] || 2000
            await new Promise((res) => setTimeout(res, delay))
            continue
          }
        }
      }

      if (!success) {
        failures.push({ place_id: r.place_id || null, error: lastError || 'failed after retries' })
        continue
      }
    }

    const totalTime = (Date.now() - startTime) / 1000
    console.log('Total ingestion time (seconds):', totalTime)
    console.log('Average time per restaurant:', totalTime / (testRestaurants.length || 1))

    console.info('Ingest complete:', { restaurantsProcessed, menusFetched, totalDishesInserted, failuresCount: failures.length, successfulExtractions, failedExtractions })
    return res.json({ restaurantsProcessed, menusFetched, totalDishesInserted, successfulExtractions, failedExtractions, failures })
  } catch (e) {
    console.error('Discover-and-ingest error:', e instanceof Error ? e.message : String(e))
    return res.status(500).json({ error: 'internal server error' })
  }
})

// POST /api/find-menu-items - accept { lat, lng, q }
app.post('/api/find-menu-items', async (req, res) => {
  try {
    const { lat, lng, q } = req.body || {}
    if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).json({ error: 'lat and lng are required as numbers' })
    const query = (q || '').toString().trim().toLowerCase()
    const { discoverNearbyCoords } = require('./services/restaurantDiscovery')
    const { fetchMenu } = require('./services/menuFetcher')
    const { extractFullMenu } = require('./services/menuExtractor')
    const { normalizeMenu } = require('./services/menuNormalizer')

    const restaurants = await discoverNearbyCoords(lat, lng)
    const candidates = restaurants.slice(0, 30)
    const results = []
    for (const r of candidates) {
      if (!r.website) continue
      try {
        const fetched = await fetchMenu(r)
        if (!fetched || !fetched.rawMenuText) continue
        const extracted = await extractFullMenu(fetched.rawMenuText)
        const normalized = normalizeMenu(extracted)
        for (const cat of normalized.categories || []) {
          for (const it of cat.items || []) {
            const name = (it.dish_name || '').toString()
            const desc = (it.description || '').toString()
            const hay = (name + ' ' + desc).toLowerCase()
            if (!query || hay.includes(query)) {
              results.push({ restaurant: { name: r.name, address: r.address, website: r.website, place_id: r.place_id }, category: cat.category, dish_name: name, description: desc || null, price: it.price || null })
            }
          }
        }
      } catch (e) {
        console.warn('Menu find error for', r.name, e instanceof Error ? e.message : String(e))
        continue
      }
    }
    return res.json({ found: results.length, items: results.slice(0, 200) })
  } catch (e) {
    console.error('find-menu-items error:', e instanceof Error ? e.message : String(e))
    return res.status(500).json({ error: 'internal server error' })
  }
})

// GET /api/search-dishes
app.get('/api/search-dishes', async (req, res) => {
  try {
    const { q } = req.query || {}
    if (!q || String(q).trim().length === 0) return res.status(400).json({ error: 'Missing search query' })

    const term = `%${String(q).trim()}%`
    try {
      const { data, error } = await supabaseInstance
        .from('dishes')
        .select('dish_name, description, price, restaurants(name, address, latitude, longitude)')
        .ilike('dish_name', term)
        .limit(50)

      if (error) throw error

      const results = (data || []).map((row) => {
        const r = row.restaurants && Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants || {}
        return {
          dish_name: row.dish_name || null,
          description: row.description || null,
          price: row.price != null ? row.price : null,
          restaurant_name: r && r.name ? r.name : null,
          address: r && r.address ? r.address : null,
          latitude: r && (r.latitude != null) ? r.latitude : null,
          longitude: r && (r.longitude != null) ? r.longitude : null
        }
      })

      return res.json({ results })
    } catch (dbErr) {
      const detail = dbErr && dbErr.message ? dbErr.message : (typeof dbErr === 'object' ? JSON.stringify(dbErr) : String(dbErr))
      console.error('search-dishes db error:', detail)
      return res.status(500).json({ error: 'internal server error' })
    }
  } catch (e) {
    console.error('search-dishes error:', e instanceof Error ? e.message : String(e))
    return res.status(500).json({ error: 'internal server error' })
  }
})

// Start the server and listen on the specified port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
