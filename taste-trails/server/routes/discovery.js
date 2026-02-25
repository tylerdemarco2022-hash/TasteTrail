import express from 'express'
import axios from 'axios'
import { supabase } from '../../backend/supabase.js'
import { createRateLimiter } from '../../backend/middleware/rateLimiter.js'
import {
  calculateBoundingBox,
  identifyTile,
  boostTilePriority,
  haversineDistance,
  calculateTrendingScore,
  calculateDynamicConfidence,
  getTrendingBadge,
  shouldLogView,
  logActivity
} from '../../backend/discovery/discoveryEngineUtils.js'

const router = express.Router()

// PHASE 15: Rate limiting (60 req/min per IP)
const discoverRateLimiter = createRateLimiter(60)

// In-memory cache to avoid hammering Overpass API (CRITICAL for production)
const cache = {}
const CACHE_TIME = 1000 * 60 * 60 // 1 hour

// PRODUCTION: Query result cache (60 second TTL for burst traffic protection)
const queryCache = {}
const QUERY_CACHE_TTL = 1000 * 60 // 60 seconds

/**
 * Get badge for restaurant based on confidence score
 */
function getBadge(confidence) {
  if (confidence >= 4) return 'Verified';
  if (confidence >= 3) return 'Strong Data';
  return 'New';
}

/**
 * GET /api/restaurants
 * Location-aware restaurant discovery from Supabase database
 * Query params: lat (required), lng (required), radius (optional, in miles, default 5)
 * 
 * PHASE 8: Performance optimized with bounding box pre-filtering
 * PHASE 14: Removed internal scoring details (trending_score, views_7d, confirms_30d)
 * PHASE 15: Rate limited (60 req/min per IP)
 * PHASE 16: Query timing logged
 */
router.get('/restaurants', discoverRateLimiter, async (req, res) => {
  const queryStartTime = Date.now();
  const timings = {}; // Track detailed timing breakdown
  
  try {
    const { lat, lng, radius, sort, include_closed } = req.query;
    const userIp = req.ip || req.connection.remoteAddress || 'unknown';

    // Validate inputs
    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat and lng',
        example: '/api/restaurants?lat=35.227&lng=-80.843&radius=5&sort=distance'
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    let radiusMiles = parseFloat(radius) || 5;
    const sortBy = sort === 'trending' ? 'trending' : 'distance';
    const includeClosed = include_closed === 'true';

    // Validate coordinates
    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // PRODUCTION SAFEGUARD: Clamp radius to safe range (0.1 - 25 miles)
    radiusMiles = Math.min(Math.max(radiusMiles, 0.1), 25);

    // PRODUCTION: Check query cache first (protects Supabase from burst traffic)
    const cacheKey = `${userLat.toFixed(3)}_${userLng.toFixed(3)}_${radiusMiles}_${sortBy}`;
    if (queryCache[cacheKey] && Date.now() - queryCache[cacheKey].timestamp < QUERY_CACHE_TTL) {
      return res.json(queryCache[cacheKey].data);
    }

    // ========== TIMER: Database Query (Restaurants) ==========
    const dbQueryStart = Date.now();
    
    // PHASE 8: PRODUCTION-GRADE RADIUS QUERY
    // Using PostgreSQL earthdistance extension + GIST index
    // True haversine distance calculation at database level
    const radiusMeters = radiusMiles * 1609.34;
    
    const { data: restaurants, error } = await supabase.rpc('restaurants_within_radius', {
      user_lat: userLat,
      user_lng: userLng,
      radius_meters: radiusMeters
    });
    
    timings.dbQueryMs = Date.now() - dbQueryStart;

    // PRODUCTION SAFEGUARD: Limit results to prevent abuse (max 200 rows)
    if (restaurants && restaurants.length > 200) {
      restaurants.length = 200;
    }

    if (error) {
      console.error('Database query failed:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch restaurants',
        details: error.message
      });
    }

    if (!restaurants || restaurants.length === 0) {
      const emptyResponse = {
        success: true,
        searchCenter: { lat: userLat, lng: userLng },
        radiusMiles,
        count: 0,
        restaurants: [],
        sortBy
      };
      queryCache[cacheKey] = {
        timestamp: Date.now(),
        data: emptyResponse
      };
      return res.json(emptyResponse);
    }

    // PHASE 9: Identify tile and boost it (non-blocking, don't time)
    const tile = await identifyTile(supabase, userLat, userLng);
    if (tile) {
      boostTilePriority(supabase, tile.id).catch(err =>
        console.warn('Tile boost failed:', err.message)
      );
    }

    // ========== TIMER: Distance Calculation & Enrichment ==========
    const distanceCalcStart = Date.now();

    // Enrich results with distance and badges
    // PHASE 14: Use pre-computed trending scores from database
    const enrichedRestaurants = restaurants.map(r => {
      const distance = haversineDistance(userLat, userLng, r.lat, r.lng);
      const trendingScore = r.trending_score || 0;

      // PHASE 10: Recalculate dynamic confidence
      const dynamicConfidence = calculateDynamicConfidence(
        r.confidence,
        r.scan_count,
        !!r.cover_photo_url,
        r.user_confirmations,
        r.flagged_closed
      );

      const trendingBadge = getTrendingBadge(trendingScore, 20);

      // PHASE 14: Return only public-safe fields
      return {
        id: r.id,
        name: r.name,
        cuisine: r.cuisine,
        cover_photo_url: r.cover_photo_url,
        distance: parseFloat(distance.toFixed(2)),
        badge: getBadge(dynamicConfidence),
        confidence: dynamicConfidence,
        trending_badge: trendingBadge,
        trending_score: trendingScore, // Keep for internal sorting
        flagged_closed: r.flagged_closed
      };
    });
    
    timings.distanceCalcMs = Date.now() - distanceCalcStart;

    // ========== TIMER: Sorting ==========
    const sortStart = Date.now();
    
    // Sort by requested criteria (trending sort already done in DB)
    let finalResults = enrichedRestaurants;
    if (sortBy !== 'trending') {
      // Only sort by distance if not trending (trending sorted in database)
      finalResults.sort((a, b) => a.distance - b.distance);
    }
    
    timings.sortMs = Date.now() - sortStart;

    // Filter by distance (final safety check)
    finalResults = finalResults.filter(r => r.distance <= radiusMiles);

    // Remove trending_score before sending to client (internal use only)
    const cleanResults = finalResults.map(r => {
      const { trending_score, ...rest } = r;
      return rest;
    });

    // PHASE 11: Log view events (truly fire-and-forget with setImmediate)
    // Note: Completely non-blocking - runs after response is sent
    setImmediate(() => {
      finalResults.forEach(async (restaurant) => {
        try {
          if (await shouldLogView(supabase, restaurant.id, userIp)) {
            await logActivity(supabase, restaurant.id, 'view', userIp);
          }
        } catch (err) {
          // Silently fail - view logging is not critical
        }
      });
    });

    // Calculate final timing
    timings.totalMs = Date.now() - queryStartTime;
    
    // Log detailed breakdown (always log server-side for monitoring)
    console.log(`📊 Query Performance: ${timings.totalMs}ms (DB: ${timings.dbQueryMs}ms, Calc: ${timings.distanceCalcMs}ms, Sort: ${timings.sortMs}ms)`);
    
    if (timings.totalMs > 150) {
      console.warn(`⚠️ SLOW QUERY: ${timings.totalMs}ms for ${finalResults.length} restaurants`);
    }

    // Build response (NO debug timing exposed to client)
    const response = {
      success: true,
      searchCenter: { lat: userLat, lng: userLng },
      radiusMiles,
      count: cleanResults.length,
      restaurants: cleanResults,
      sortBy,
      tile: tile ? { city: tile.city, priority: tile.priority } : null
    };
    
    // PRODUCTION: Cache this response for 60 seconds to protect against burst traffic
    queryCache[cacheKey] = {
      timestamp: Date.now(),
      data: response
    };
    
    res.json(response);

  } catch (err) {
    console.error('RESTAURANT FETCH ERROR:', err);
    return res.status(500).json({
      error: 'Failed to fetch restaurants',
      message: err.message,
      stack: err.stack
    });
  }
});

/**
 * POST /api/restaurants
 * Production-ready restaurant discovery using OpenStreetMap
 * Body: { lat: number, lng: number, radius: number (in meters) }
 */
router.post('/restaurants', async (req, res) => {
  try {
    const { lat, lng, radius } = req.body

    // Validate input
    if (!lat || !lng || !radius) {
      return res.status(400).json({ error: 'Missing lat, lng, or radius' })
    }

    // Check cache first (prevents rate limiting)
    const key = `${lat}-${lng}-${radius}`
    if (cache[key] && Date.now() - cache[key].timestamp < CACHE_TIME) {
      console.log(`✅ Cache hit: ${key}`)
      return res.json(cache[key].data)
    }

    // Build Overpass query - restaurants only, no fast food
    const overpassQuery = `
    [out:json];
    (
      node["amenity"="restaurant"](around:${radius},${lat},${lng});
      way["amenity"="restaurant"](around:${radius},${lat},${lng});
      relation["amenity"="restaurant"](around:${radius},${lat},${lng});
    );
    out center;
    `

    console.log(`🔍 Discovery: (${lat}, ${lng}) radius ${radius}m`)

    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      { headers: { 'Content-Type': 'text/plain' }, timeout: 30000 }
    )

    // Clean the garbage - CRITICAL step
    const restaurants = response.data.elements
      .filter(place => place.tags?.name) // MUST have name
      .map(place => ({
        id: place.id,
        name: place.tags.name,
        lat: place.lat || place.center?.lat,
        lng: place.lon || place.center?.lon,
        cuisine: place.tags?.cuisine || null,
        phone: place.tags?.phone || null,
        website: place.tags?.website || null,
        address: place.tags?.['addr:street'] || null,
        city: place.tags?.['addr:city'] || null
      }))
      // Remove duplicates (case-insensitive)
      .filter((place, index, self) =>
        index === self.findIndex(p =>
          p.name.toLowerCase() === place.name.toLowerCase()
        )
      )

    console.log(`✅ Found ${restaurants.length} restaurants`)

    // Cache it
    cache[key] = {
      timestamp: Date.now(),
      data: restaurants
    }

    res.json(restaurants)
  } catch (error) {
    console.error('❌ Discovery failed:', error.message)
    res.status(500).json({ error: 'Overpass query failed' })
  }
})

/**
 * GET /api/discover-restaurants/test
 * Test endpoint using Charlotte, NC coordinates
 */
router.get('/discover-restaurants/test', async (req, res) => {
  try {
    // Charlotte, NC - 1000m radius
    const lat = 35.2271
    const lng = -80.8431
    const radius = 1000

    console.log(`🧪 Test: Charlotte, NC (${lat}, ${lng}) ${radius}m`)

    const key = `${lat}-${lng}-${radius}`
    if (cache[key] && Date.now() - cache[key].timestamp < CACHE_TIME) {
      return res.json({ cached: true, ...cache[key].data })
    }

    const overpassQuery = `
    [out:json];
    (
      node["amenity"="restaurant"](around:${radius},${lat},${lng});
      way["amenity"="restaurant"](around:${radius},${lat},${lng});
    );
    out center;
    `

    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      { headers: { 'Content-Type': 'text/plain' }, timeout: 30000 }
    )

    const restaurants = response.data.elements
      .filter(place => place.tags?.name)
      .map(place => ({
        id: place.id,
        name: place.tags.name,
        lat: place.lat || place.center?.lat,
        lng: place.lon || place.center?.lon,
        cuisine: place.tags?.cuisine || null
      }))
      .slice(0, 20) // First 20 for testing

    cache[key] = { timestamp: Date.now(), data: restaurants }

    res.json({ test: true, count: restaurants.length, restaurants })
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    res.status(500).json({ error: error.message })
  }
})

export default router
