import { queryOverpass, parseElements } from './overpassClient.js'
import { computeConfidence } from './confidence.js'
import { dedupeWithinBatch, isDuplicate } from './dedupe.js'
import { updateTileAfterScan } from './tilePicker.js'

/**
 * Scan a single tile and upsert results
 * @param {Object} supabase - Supabase client
 * @param {Object} tile - {id, center_lat, center_lng, radius_m, ...}
 * @returns {Promise<Object>} {success, discovered, upserted, errors}
 */
export async function scanTile(supabase, tile) {
  const result = {
    success: false,
    tileId: tile.id,
    discovered: 0,
    upserted: 0,
    errors: []
  }

  try {
    console.log(`\n🚀 Scanning tile [${tile.id}]: (${tile.center_lat}, ${tile.center_lng})`)

    // 1. Query Overpass
    const elements = await queryOverpass(tile.center_lat, tile.center_lng, tile.radius_m)
    result.discovered = elements.length

    if (elements.length === 0) {
      console.log('   ℹ️  No restaurants found')
      result.success = true
      return result
    }

    // 2. Parse elements
    let restaurants = parseElements(elements)
    console.log(`   Parsed: ${restaurants.length} restaurants`)
    
    // DEBUG: Log first element and first restaurant
    if (elements.length > 0) {
      console.log(`   [DEBUG] First element:`, {
        id: elements[0].id,
        name: elements[0].tags?.name,
        lat: elements[0].lat,
        lon: elements[0].lon,
        center_lat: elements[0].center?.lat,
        center_lon: elements[0].center?.lon
      })
    }
    if (restaurants.length > 0) {
      console.log(`   [DEBUG] First parsed restaurant:`, {
        name: restaurants[0].name,
        lat: restaurants[0].lat,
        lng: restaurants[0].lng,
        source: restaurants[0].source,
        source_id: restaurants[0].source_id
      })
    }

    // 3. Local deduplication
    restaurants = dedupeWithinBatch(restaurants)

    // 4. Compute confidence + add metadata
    restaurants = restaurants.map(r => ({
      ...r,
      confidence: computeConfidence(r)
    }))

    // 5. Check DB for duplicates and upsert
    let upserted = 0
    for (const restaurant of restaurants) {
      const isDup = await isDuplicate(supabase, restaurant, 50)
      if (isDup) continue

      try {
        // DEBUG: Log restaurant before upsert
        if (upserted === 0) {
          console.log(`   [DEBUG] Upserting restaurant:`, {
            name: restaurant.name,
            lat: restaurant.lat,
            lng: restaurant.lng,
            source: restaurant.source,
            source_id: restaurant.source_id,
            confidence: restaurant.confidence,
            all_keys: Object.keys(restaurant)
          })
        }

        // Try full upsert first with source-based conflict resolution
        let { error: upsertError } = await supabase
          .from('restaurants')
          .upsert(restaurant, { onConflict: 'source,source_id' })

        // If conflict column doesn't exist, try without conflict strategy
        if (upsertError && upsertError.message.includes('Could not find the')) {
          console.log(`   ⚠️  Upsert with conflict strategy failed. Trying without...`)
          const { error: retryError } = await supabase
            .from('restaurants')
            .insert(restaurant)
          
          upsertError = retryError;
        }

        // If still fails due to missing columns, try with core columns only
        if (upsertError && upsertError.message.includes('Could not find')) {
          console.log(`   ⚠️  Full upsert failed due to schema mismatch. Trying with core columns only...`)
          console.log(`   Error: ${upsertError.message}`)
          
          // Retry with only columns that definitely exist (based on test results)
          const coreRestaurant = {
            name: restaurant.name,
            lat: restaurant.lat,
            lng: restaurant.lng,
            // Include optional columns that we know might exist
            ...(restaurant.cuisine && { cuisine: restaurant.cuisine }),
            ...(restaurant.website && { website: restaurant.website }),
            ...(restaurant.address && { address: restaurant.address }),
            ...(restaurant.confidence !== undefined && { confidence: restaurant.confidence }),
            ...(restaurant.created_at && { created_at: restaurant.created_at })
          };
          
          // Try insert with core columns (not upsert since we don't have source/source_id)
          const result2 = await supabase
            .from('restaurants')
            .insert([coreRestaurant]);
          
          if (result2.error) {
            result.errors.push(`Core columns insert failed for ${restaurant.name}: ${result2.error.message}`);
            console.log(`   ❌ Even core columns failed: ${result2.error.message}`)
          } else {
            upserted++;
            console.log(`   ✅ Inserted with core columns: ${restaurant.name} (lat: ${restaurant.lat}, lng: ${restaurant.lng})`)
          }
        } else if (upsertError) {
          result.errors.push(`Upsert failed for ${restaurant.name}: ${upsertError.message}`)
        } else {
          upserted++;
          console.log(`   ✅ Inserted: ${restaurant.name} (lat: ${restaurant.lat}, lng: ${restaurant.lng})`)
        }
      } catch (err) {
        result.errors.push(`Exception upserting ${restaurant.name}: ${err.message}`)
      }
    }

    result.upserted = upserted
    result.success = true

    console.log(`   ✅ Upserted: ${upserted} restaurants`)

  } catch (err) {
    console.error(`   ❌ Scan failed:`, err.message)
    result.errors.push(err.message)
  }

  // Update tile status in DB
  await updateTileAfterScan(supabase, tile.id, result.success)

  return result
}

/**
 * Log discovery run to DB
 * @param {Object} supabase
 * @param {Object} stats - {city, tiles_processed, restaurants_discovered, restaurants_upserted, errors}
 */
export async function logDiscoveryRun(supabase, stats) {
  try {
    await supabase.from('discovery_runs').insert({
      city: stats.city || 'unknown',
      tiles_processed: stats.tiles_processed || 0,
      restaurants_discovered: stats.restaurants_discovered || 0,
      restaurants_upserted: stats.restaurants_upserted || 0,
      errors: stats.errors?.length > 0 ? JSON.stringify(stats.errors) : null,
      finished_at: new Date().toISOString()
    })

    console.log('📊 Discovery run logged')
  } catch (err) {
    console.error('Failed to log discovery run:', err.message)
  }
}
