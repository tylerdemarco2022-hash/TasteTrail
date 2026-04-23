/**
 * Select next tiles to scan based on schedule
 * @param {Object} supabase - Supabase client
 * @param {number} limit - How many tiles to pick (default 1)
 * @returns {Promise<Array>} Tiles ready for scanning
 */
export async function pickNextTiles(supabase, limit = 1) {
  try {
    const { data: tiles, error } = await supabase
      .from('discovery_tiles')
      .select('*')
      .lt('next_run_at', 'now()')
      .order('priority', { ascending: false })
      .order('last_scanned_at', { ascending: true, nullsFirst: true })
      .limit(limit)

    if (error) {
      console.error('Error picking tiles:', error.message)
      return []
    }

    return tiles || []
  } catch (err) {
    console.error('Tile picker error:', err.message)
    return []
  }
}

/**
 * Update tile after successful scan
 * @param {Object} supabase
 * @param {number} tileId
 * @param {boolean} success - Whether scan succeeded
 * @returns {Promise<boolean>}
 */
export async function updateTileAfterScan(supabase, tileId, success = true) {
  try {
    const nextRunAt = new Date()

    if (success) {
      // Successful scan: schedule for 7 days if priority >= 5, else 30 days
      const tile = await supabase
        .from('discovery_tiles')
        .select('priority')
        .eq('id', tileId)
        .single()

      const daysToAdd = tile.data?.priority >= 5 ? 7 : 30
      nextRunAt.setDate(nextRunAt.getDate() + daysToAdd)

      await supabase
        .from('discovery_tiles')
        .update({
          last_scanned_at: new Date().toISOString(),
          next_run_at: nextRunAt.toISOString(),
          fail_count: 0
        })
        .eq('id', tileId)

      console.log(`✅ Tile ${tileId} updated: next scan in ${daysToAdd} days`)
    } else {
      // Failed: retry in 6 hours, increment fail counter
      nextRunAt.setHours(nextRunAt.getHours() + 6)

      await supabase
        .from('discovery_tiles')
        .update({
          next_run_at: nextRunAt.toISOString(),
          fail_count: supabase.raw('fail_count + 1')
        })
        .eq('id', tileId)

      console.log(`⚠️  Tile ${tileId} failed: next retry in 6 hours`)
    }

    return true
  } catch (err) {
    console.error('Error updating tile:', err.message)
    return false
  }
}

/**
 * Generate tiles for a city (admin function)
 * Creates a grid of discovery tiles
 * @param {Object} supabase
 * @param {Object} params - {city, minLat, minLng, maxLat, maxLng, spacingKm, radiusM, priority}
 * @returns {Promise<number>} Number of tiles created
 */
export async function generateTilesForCity(supabase, params) {
  const {
    city,
    minLat,
    minLng,
    maxLat,
    maxLng,
    spacingKm = 2.5,
    radiusM = 1500,
    priority = 0
  } = params

  const spacingDeg = spacingKm / 111.0 // Rough conversion (1 degree ~ 111 km)

  const tiles = []
  for (let lat = minLat; lat < maxLat; lat += spacingDeg) {
    for (let lng = minLng; lng < maxLng; lng += spacingDeg) {
      tiles.push({
        city,
        center_lat: lat,
        center_lng: lng,
        radius_m: radiusM,
        priority,
        next_run_at: new Date().toISOString()
      })
    }
  }

  console.log(`📍 Generated ${tiles.length} tiles for ${city}`)

  try {
    const { error } = await supabase.from('discovery_tiles').insert(tiles)

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation - some tiles already exist
        console.log('(Some tiles already exist, ignoring duplicates)')
        return tiles.length
      }
      throw error
    }

    return tiles.length
  } catch (err) {
    console.error('Error generating tiles:', err.message)
    throw err
  }
}
