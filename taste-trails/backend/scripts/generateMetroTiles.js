#!/usr/bin/env node

/**
 * Charlotte Metro Tile Grid Generator
 * 
 * Creates a grid of discovery tiles covering Charlotte metro area
 * Tiles are ~1.3 miles (0.02 degrees) each
 * Prevents duplicates via unique constraint
 * 
 * Usage: node backend/scripts/generateMetroTiles.js
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { CHARLOTTE_METRO_BOUNDS, getBoundsInfo } from '../discovery/metroBounds.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const TILE_SIZE_DEGREES = 0.02 // ~1.3 miles at Charlotte's latitude

async function generateTiles() {
  try {
    console.log('\n📊 Charlotte Metro Tile Generation')
    console.log('='.repeat(60))

    const boundsInfo = getBoundsInfo()
    console.log('\n📍 Coverage Area:')
    console.log(`   Center: (${boundsInfo.center.lat}, ${boundsInfo.center.lng})`)
    console.log(`   Size: ${boundsInfo.size.latMiles} mi (N-S) × ${boundsInfo.size.lngMiles} mi (E-W)`)

    const { minLat, maxLat, minLng, maxLng } = CHARLOTTE_METRO_BOUNDS

    let created = 0
    let skipped = 0
    const errors = []

    console.log(`\n🔄 Generating tiles (${TILE_SIZE_DEGREES}° spacing)...`)

    for (let lat = minLat; lat < maxLat; lat += TILE_SIZE_DEGREES) {
      for (let lng = minLng; lng < maxLng; lng += TILE_SIZE_DEGREES) {
        const centerLat = parseFloat((lat + TILE_SIZE_DEGREES / 2).toFixed(4))
        const centerLng = parseFloat((lng + TILE_SIZE_DEGREES / 2).toFixed(4))

        try {
          const { error } = await supabase.from('discovery_tiles').insert({
            center_lat: centerLat,
            center_lng: centerLng,
            radius_m: 1500, // Default search radius in meters
            priority: 1,
            fail_count: 0,
            city: 'Charlotte, NC'
          })

          if (error) {
            // Unique constraint violation is expected for duplicates
            if (error.code === '23505') {
              skipped++
            } else {
              errors.push(`(${centerLat}, ${centerLng}): ${error.message}`)
              console.error(`  ❌ (${centerLat}, ${centerLng}): ${error.message}`)
            }
          } else {
            created++
            // Progress indicator every 50 tiles
            if ((created + skipped) % 50 === 0) {
              process.stdout.write('.')
            }
          }
        } catch (err) {
          errors.push(`(${centerLat}, ${centerLng}): ${err.message}`)
        }
      }
    }

    console.log('\n')
    console.log('='.repeat(60))
    console.log('✅ Tile Generation Complete')
    console.log(`   Created: ${created} new tiles`)
    console.log(`   Skipped: ${skipped} duplicates`)
    console.log(`   Total: ${created + skipped} processed`)
    if (errors.length > 0) {
      console.log(`   Errors: ${errors.length}`)
      errors.slice(0, 5).forEach(e => console.log(`     - ${e}`))
      if (errors.length > 5) console.log(`     ... and ${errors.length - 5} more`)
    }
    console.log('='.repeat(60) + '\n')

    process.exit(0)
  } catch (err) {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
  }
}

generateTiles()
