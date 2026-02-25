import axios from 'axios'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const TIMEOUT = 30000 // 30 seconds
const MAX_RETRIES = 2
const RETRY_DELAYS = [1000, 3000] // 1s, 3s

/**
 * Query Overpass API for restaurants in a circular area
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusM - Search radius in meters
 * @returns {Promise<Array>} OSM elements with tags
 */
export async function queryOverpass(lat, lng, radiusM) {
  const radiusKm = Math.ceil(radiusM / 1000)

  const query = `
[out:json][timeout:25];
(
 node["amenity"="restaurant"](around:${radiusM},${lat},${lng});
 way["amenity"="restaurant"](around:${radiusM},${lat},${lng});
 relation["amenity"="restaurant"](around:${radiusM},${lat},${lng});
);
out center tags;
  `.trim()

  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `🔍 Overpass query (${lat.toFixed(4)}, ${lng.toFixed(4)}) radius ${radiusM}m [attempt ${attempt + 1}]`
      )

      const response = await axios.post(OVERPASS_URL, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: TIMEOUT
      })

      if (!response.data || !response.data.elements) {
        throw new Error('Invalid Overpass response structure')
      }

      console.log(`✅ Overpass: found ${response.data.elements.length} elements`)
      return response.data.elements
    } catch (error) {
      lastError = error
      const status = error.response?.status
      const isRetryable = status === 429 || status >= 500 || error.code === 'ECONNABORTED'

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt]
        console.warn(
          `⚠️  Overpass error (${status || error.code}), retrying in ${delay}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      console.error(`❌ Overpass failed after ${attempt + 1} attempts:`, error.message)
      return []
    }
  }

  throw lastError
}

/**
 * Parse raw OSM elements into restaurant objects
 * @param {Array} elements - OSM node/way/relation elements
 * @returns {Array} Normalized restaurant objects
 */
export function parseElements(elements) {
  return elements
    .filter(el => el.tags?.name && (el.lat || el.center?.lat))
    .map(el => ({
      source: 'osm',
      source_id: String(el.id),
      name: el.tags.name,
      lat: el.lat || el.center.lat,
      lng: el.lon || el.center.lon,
      cuisine: el.tags.cuisine || null,
      phone: el.tags.phone || null,
      website: el.tags.website || null,
      address: el.tags['addr:street'] || null,
      amenity: el.tags.amenity || 'restaurant',
      opening_hours: el.tags.opening_hours || null
    }))
}
