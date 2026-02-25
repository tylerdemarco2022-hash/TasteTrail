import { normalizeName, getLocationKey } from './normalize.js'

/**
 * Dedupe restaurants within a batch using name + location key
 * @param {Array} restaurants - Array of restaurant objects
 * @returns {Array} Deduped restaurants
 */
export function dedupeWithinBatch(restaurants) {
  const seen = new Map() // key = "normalized_name|location_key"

  const deduped = []
  for (const rest of restaurants) {
    const normalized = normalizeName(rest.name)
    const locKey = getLocationKey(rest.lat, rest.lng)
    const key = `${normalized}|${locKey}`

    if (!seen.has(key)) {
      seen.set(key, true)
      deduped.push(rest)
    }
  }

  console.log(`   Deduped batch: ${restaurants.length} -> ${deduped.length}`)
  return deduped
}

/**
 * Calculate Haversine distance between two points (in meters)
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Check if a potential new restaurant is a duplicate of an existing one
 * Looks for same normalized name within 50m bounding box
 * @param {Object} supabase - Supabase client
 * @param {Object} restaurant - New restaurant to check
 * @param {number} proximityM - Proximity threshold (default 50m)
 * @returns {Promise<boolean>} True if duplicate found
 */
export async function isDuplicate(supabase, restaurant, proximityM = 50) {
  if (!supabase || !supabase.from) {
    return false // No DB check available
  }

  const normalized = normalizeName(restaurant.name)
  const bboxDelta = 0.01 // ~1.1km at equator, allows quick filtering

  try {
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id, name, lat, lng')
      .eq('source', 'osm')
      .gte('lat', restaurant.lat - bboxDelta)
      .lte('lat', restaurant.lat + bboxDelta)
      .gte('lng', restaurant.lng - bboxDelta)
      .lte('lng', restaurant.lng + bboxDelta)

    if (!existing || existing.length === 0) {
      return false
    }

    // Check if any existing restaurant in bbox matches
    for (const ex of existing) {
      const exNormalized = normalizeName(ex.name)
      if (exNormalized === normalized) {
        const dist = haversineDistance(restaurant.lat, restaurant.lng, ex.lat, ex.lng)
        if (dist < proximityM) {
          console.log(
            `   ⏭️  Skipping duplicate: "${restaurant.name}" (${dist.toFixed(0)}m away)`
          )
          return true
        }
      }
    }

    return false
  } catch (err) {
    console.warn('Dedupe check failed:', err.message)
    return false // If check fails, don't block insertion
  }
}
