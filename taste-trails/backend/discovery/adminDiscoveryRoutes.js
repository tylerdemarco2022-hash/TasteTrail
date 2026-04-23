import express from 'express'
import { generateTilesForCity } from './tilePicker.js'
import { runScanCycle, getSchedulerStatus, resetFailureCounter } from './scheduler.js'
import { supabase } from '../supabase.js'

const router = express.Router()

/**
 * Middleware: Verify admin token
 */
function verifyAdminToken(req, res, next) {
  const incoming = req.headers['x-admin-token']

  console.log('Incoming x-admin-token:', incoming)
  console.log('Expected ADMIN_TOKEN:', process.env.ADMIN_TOKEN)

  if (!incoming || incoming !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' })
  }

  next()
}

router.use(verifyAdminToken)

/**
 * POST /admin/discovery/generate-tiles
 * Generate discovery tiles for a city
 * Body: {city, minLat, minLng, maxLat, maxLng, spacingKm, radiusM, priority}
 * Example: Charlotte, NC
 *   { "city": "Charlotte, NC", "minLat": 35.1, "minLng": -80.95, "maxLat": 35.35, "maxLng": -80.7, "spacingKm": 2.5, "radiusM": 1500, "priority": 5 }
 */
router.post('/generate-tiles', async (req, res) => {
  try {
    const { city, minLat, minLng, maxLat, maxLng, spacingKm = 2.5, radiusM = 1500, priority = 0 } =
      req.body

    if (!city || minLat === undefined || minLng === undefined || maxLat === undefined || maxLng === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: city, minLat, minLng, maxLat, maxLng'
      })
    }

    const count = await generateTilesForCity(supabase, {
      city,
      minLat,
      minLng,
      maxLat,
      maxLng,
      spacingKm,
      radiusM,
      priority
    })

    res.json({
      success: true,
      message: `Generated ${count} tiles for ${city}`,
      tileCou: count
    })
  } catch (err) {
    console.error('Error generating tiles:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /admin/discovery/run-once
 * Manually trigger a scan cycle
 * Body: {tilesCount: 1}
 */
router.post('/run-once', async (req, res) => {
  try {
    const tilesCount = req.body.tilesCount || 1

    res.json({
      message: `Scan cycle started (${tilesCount} tile(s))`,
      info: 'Check logs for progress'
    })

    // Run in background without awaiting
    runScanCycle(supabase, tilesCount).catch(err => {
      console.error('Background scan failed:', err)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /admin/discovery/status
 * Get scheduler status and pending tiles
 */
router.get('/status', async (req, res) => {
  try {
    const schedulerStatus = getSchedulerStatus()

    // Get pending tiles
    const { data: pendingTiles } = await supabase
      .from('discovery_tiles')
      .select('*')
      .lt('next_run_at', 'now()')
      .order('priority', { ascending: false })
      .limit(5)

    // Get last run
    const { data: lastRun } = await supabase
      .from('discovery_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get tile counts by city
    const { data: tileCounts } = await supabase
      .from('discovery_tiles')
      .select('city')

    const cityStats = {}
    if (tileCounts) {
      for (const tile of tileCounts) {
        cityStats[tile.city] = (cityStats[tile.city] || 0) + 1
      }
    }

    // Get restaurant counts
    const { count: totalRestaurants } = await supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })

    const { count: osmRestaurants } = await supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'osm')

    res.json({
      scheduler: schedulerStatus,
      pendingTiles: pendingTiles || [],
      lastRun: lastRun || null,
      statistics: {
        totalRestaurants,
        osmRestaurants,
        cities: cityStats
      }
    })
  } catch (err) {
    console.error('Error getting status:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /admin/discovery/tiles?city=...
 * List tiles for a specific city (or all)
 */
router.get('/tiles', async (req, res) => {
  try {
    const city = req.query.city

    let query = supabase.from('discovery_tiles').select('*')

    if (city) {
      query = query.eq('city', city)
    }

    const { data: tiles, error } = await query.order('priority', { ascending: false })

    if (error) throw error

    res.json({
      tiles: tiles || [],
      count: tiles?.length || 0
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /admin/discovery/restaurants?source=osm&limit=10
 * View discovered restaurants
 */
router.get('/restaurants', async (req, res) => {
  try {
    const source = req.query.source || 'osm'
    const limit = parseInt(req.query.limit) || 20

    let query = supabase.from('restaurants').select('*')

    if (source !== 'all') {
      query = query.eq('source', source)
    }

    const { data: restaurants, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    res.json({
      restaurants: restaurants || [],
      count: restaurants?.length || 0,
      source
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /admin/discovery/reset-failures
 * Reset the failure counter to resume scheduling after max failures
 */
router.post('/reset-failures', verifyAdminToken, (req, res) => {
  try {
    resetFailureCounter()
    res.json({
      success: true,
      message: 'Failure counter reset. Scheduler will resume on next scheduled run.',
      status: getSchedulerStatus()
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /admin/discovery/fix-schema
 * Add missing columns to restaurants table for discovery ingestion
 */
router.post('/fix-schema', verifyAdminToken, async (req, res) => {
  try {
    // SQL migration commands to update restaurants table schema
    const sqlCommands = [
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'osm'`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS amenity TEXT DEFAULT 'restaurant'`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT NULL`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
      `ALTER TABLE restaurants ADD UNIQUE(source, source_id)`
    ];

    console.log('Schema Migration Request Received');
    console.log('SQL Commands:');
    sqlCommands.forEach(cmd => console.log('  ' + cmd));

    // Try to execute via Supabase admin client
    // Since postgREST doesn't support DDL, we'll provide the commands and status
    const results = {
      success: true,
      message: 'Schema migration required. Run the following SQL commands in Supabase SQL Editor.',
      commands: sqlCommands,
      steps: [
        '1. Go to Supabase Dashboard > Project > SQL Editor',
        '2. Create a new query',
        '3. Copy and paste the SQL commands below',
        '4. Click "Run" to execute all migrations',
        '5. Return here and call this endpoint again to verify'
      ]
    };

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /admin/discovery/progress
 * Show Metro expansion progress
 * Returns: total tiles, scanned tiles, and percentage complete
 */
router.get('/progress', async (req, res) => {
  try {
    // Get total tiles
    const { count: totalCount, error: totalError } = await supabase
      .from('discovery_tiles')
      .select('*', { count: 'exact', head: true })

    if (totalError) throw totalError

    // Get scanned tiles (those with last_scanned_at set)
    const { count: scannedCount, error: scannedError } = await supabase
      .from('discovery_tiles')
      .select('*', { count: 'exact', head: true })
      .not('last_scanned_at', 'is', null)

    if (scannedError) throw scannedError

    const totalTiles = totalCount || 0
    const scannedTiles = scannedCount || 0
    const percentComplete = totalTiles > 0 ? ((scannedTiles / totalTiles) * 100).toFixed(2) : 0

    res.json({
      totalTiles,
      scannedTiles,
      remainingTiles: totalTiles - scannedTiles,
      percentComplete: parseFloat(percentComplete),
      estimatedCompletion: {
        note: 'Based on ~5 tiles per hour processing rate',
        hoursRemaining: ((totalTiles - scannedTiles) / 5).toFixed(1),
        daysRemaining: ((totalTiles - scannedTiles) / (5 * 24)).toFixed(1)
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
