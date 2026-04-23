import cron from 'node-cron'
import pLimit from 'p-limit'
import { pickNextTiles } from './tilePicker.js'
import { scanTile, logDiscoveryRun } from './scanner.js'

let isRunning = false
let lastRunStats = null
let consecutiveFailures = 0
const MAX_CONSECUTIVE_FAILURES = 3

/**
 * Run one discovery scan cycle
 * Pick up to N tiles and scan them sequentially
 * @param {Object} supabase - Supabase client
 * @param {number} tilesPerRun - How many tiles to process (default 1)
 * @returns {Promise<Object>} Statistics from the run
 */
export async function runScanCycle(supabase, tilesPerRun = 1) {
  if (isRunning) {
    console.log('⏭️  Scan already in progress, skipping...')
    return lastRunStats
  }

  // Guard: Skip if too many consecutive failures
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.log(`⚠️  Discovery paused: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} failures`)
    console.log('    Use POST /admin/discovery/reset-failures to resume')
    return { skipped: true, reason: 'Too many consecutive failures' }
  }

  isRunning = true
  const startTime = Date.now()

  const stats = {
    tiles_processed: 0,
    restaurants_discovered: 0,
    restaurants_upserted: 0,
    errors: []
  }

  try {
    console.log('\n' + '='.repeat(60))
    console.log('🔄 Discovery Scan Cycle Started')
    console.log('='.repeat(60))

    const tiles = await pickNextTiles(supabase, tilesPerRun)

    if (tiles.length === 0) {
      console.log('✨ No tiles pending. All caught up!')
      consecutiveFailures = 0 // Reset on success
      return stats
    }

    console.log(`📋 Processing ${tiles.length} tiles...\n`)

    // Use p-limit for concurrency control (1 = sequential)
    const limit = pLimit(1)
    const scanPromises = tiles.map(tile => limit(() => scanTile(supabase, tile)))

    const results = await Promise.all(scanPromises)

    // Aggregate stats
    for (const result of results) {
      stats.tiles_processed++
      stats.restaurants_discovered += result.discovered
      stats.restaurants_upserted += result.upserted
      if (result.errors.length > 0) {
        stats.errors.push(...result.errors)
      }
    }

    // Log to DB
    await logDiscoveryRun(supabase, stats)

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\n' + '='.repeat(60))
    console.log('✅ Discovery Scan Cycle Complete')
    console.log(`   Tiles processed: ${stats.tiles_processed}`)
    console.log(`   Restaurants discovered: ${stats.restaurants_discovered}`)
    console.log(`   Restaurants upserted: ${stats.restaurants_upserted}`)
    console.log(`   Duration: ${duration}s`)
    if (stats.errors.length > 0) {
      console.log(`   Errors: ${stats.errors.length}`)
    }
    console.log('='.repeat(60) + '\n')

    consecutiveFailures = 0 // Reset on success
    lastRunStats = stats
    return stats
  } catch (err) {
    console.error('❌ Scan cycle failed:', err)
    stats.errors.push(err.message)
    consecutiveFailures++
    console.log(`⚠️  Failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`)
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log('❌ Max failures reached. Discovery scheduler paused.')
    }
    return stats
  } finally {
    isRunning = false
  }
}

/**
 * Reset failure counter and resume scheduler
 */
export function resetFailureCounter() {
  consecutiveFailures = 0
  console.log('✅ Failure counter reset. Scheduler resumed.')
}

/**
 * Start the discovery scheduler
 * Runs every 6 hours by default
 * @param {Object} supabase - Supabase client
 * @param {string} schedule - Cron expression (default: every 6 hours)
 * @param {number} tilesPerRun - Tiles to process per cycle
 */
export function startScheduler(supabase, schedule = '0 */6 * * *', tilesPerRun = 1) {
  console.log('Scheduler init reached')
  console.log('📅 Starting Discovery Scheduler...')
  console.log(`   Schedule: ${schedule} (every 6 hours)`)
  console.log(`   Tiles per run: ${tilesPerRun}`)

  const task = cron.schedule(schedule, async () => {
    try {
      await runScanCycle(supabase, tilesPerRun)
    } catch (err) {
      console.error('Unhandled scheduler error:', err)
    }
  })

  console.log('✅ Discovery Scheduler started\n')

  return task
}

/**
 * Get scheduler status
 * @returns {Object} {isRunning, lastRunStats, consecutiveFailures}
 */
export function getSchedulerStatus() {
  return {
    isRunning,
    lastRunStats,
    consecutiveFailures,
    maxConsecutiveFailures: MAX_CONSECUTIVE_FAILURES,
    paused: consecutiveFailures >= MAX_CONSECUTIVE_FAILURES,
    lastRunAt: lastRunStats ? new Date().toISOString() : null
  }
}
