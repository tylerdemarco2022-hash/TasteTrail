import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../../backend/data')

/**
 * Restaurant Discovery Agent
 * Proactively finds nearby restaurants using Overpass API (OpenStreetMap)
 * No API key required - completely free
 */

class RestaurantDiscoveryAgent {
  constructor() {
    this.overpassUrl = 'https://overpass-api.de/api/interpreter'
    this.nominatimUrl = 'https://nominatim.openstreetmap.org/search'
    this.maxResults = 50
    this.timeout = 30000
  }

  /**
   * Query Overpass API for nearby restaurants
   * @param {number} lat - User latitude
   * @param {number} lng - User longitude
   * @param {number} radiusKm - Search radius in kilometers (default 5km)
   * @returns {Promise<Array>} List of discovered restaurants
   */
  async discoverRestaurants(lat, lng, radiusKm = 5) {
    console.log(`\n🔍 Restaurant Discovery Agent Started`)
    console.log(`📍 Location: ${lat}, ${lng} | Radius: ${radiusKm}km`)

    try {
      // Build Overpass query - searches for restaurants and cafes
      const query = `
        [bbox:${lat - radiusKm/111},${lng - radiusKm/111},${lat + radiusKm/111},${lng + radiusKm/111}];
        (
          node["amenity"="restaurant"];
          node["amenity"="cafe"];
          node["amenity"="fast_food"];
          node["amenity"="bar"];
          way["amenity"="restaurant"];
          way["amenity"="cafe"];
          way["amenity"="fast_food"];
          way["amenity"="bar"];
        );
        out body center ${this.maxResults};
      `

      console.log('⏳ Querying Overpass API...')

      const response = await fetch(this.overpassUrl, {
        method: 'POST',
        body: query,
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/osm3s' }
      })

      if (!response.ok) {
        console.warn(`⚠️  Overpass API error: ${response.status}`)
        return []
      }

      const data = await response.json()
      const restaurants = this.parseOverpassResponse(data, lat, lng)

      console.log(`✅ Discovered ${restaurants.length} restaurants`)
      return restaurants
    } catch (error) {
      console.error(`❌ Discovery error: ${error.message}`)
      return []
    }
  }

  /**
   * Parse Overpass API response
   */
  parseOverpassResponse(data, userLat, userLng) {
    if (!data.elements || data.elements.length === 0) {
      return []
    }

    return data.elements
      .filter(el => el.tags && el.tags.name)
      .map(el => {
        const lat = el.center?.lat || el.lat
        const lng = el.center?.lon || el.lon
        const distance = this.calculateDistance(userLat, userLng, lat, lng)

        return {
          id: `osm-${el.id}`,
          name: el.tags.name,
          cuisine: el.tags.cuisine || 'Various',
          amenity: el.tags.amenity,
          address: el.tags['addr:street'] || '',
          city: el.tags['addr:city'] || 'Charlotte',
          latitude: lat,
          longitude: lng,
          distance: distance,
          phone: el.tags.phone || '',
          website: el.tags.website || '',
          openingHours: el.tags.opening_hours || '',
          source: 'OpenStreetMap',
          discoveredAt: new Date().toISOString()
        }
      })
      .sort((a, b) => a.distance - b.distance) // Sort by distance
      .slice(0, this.maxResults)
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Merge discovered restaurants with existing database
   */
  mergeWithDatabase(discoveredRestaurants) {
    try {
      const imagePath = path.join(dataDir, 'restaurant-images.json')
      let existingRestaurants = []

      if (fs.existsSync(imagePath)) {
        existingRestaurants = JSON.parse(fs.readFileSync(imagePath, 'utf8'))
      }

      // Check for duplicates (case-insensitive name matching)
      const existingNames = new Set(existingRestaurants.map(r => r.name.toLowerCase()))
      const newRestaurants = discoveredRestaurants.filter(
        r => !existingNames.has(r.name.toLowerCase())
      )

      console.log(`\n📊 Database Merge:`)
      console.log(`   Existing: ${existingRestaurants.length}`)
      console.log(`   New: ${newRestaurants.length}`)
      console.log(`   Total: ${existingRestaurants.length + newRestaurants.length}`)

      // Add images to new restaurants
      const enriched = newRestaurants.map((rest, idx) => ({
        ...rest,
        image: this.getPlaceholderImage(rest.name),
        imageThumb: this.getPlaceholderImage(rest.name),
        photographer: 'OpenStreetMap Contributors'
      }))

      const merged = [...existingRestaurants, ...enriched]
      fs.writeFileSync(imagePath, JSON.stringify(merged, null, 2))

      return { existingRestaurants, newRestaurants: enriched, merged }
    } catch (error) {
      console.error(`❌ Merge error: ${error.message}`)
      return { existingRestaurants: [], newRestaurants: [], merged: [] }
    }
  }

  /**
   * Get random image URL for restaurant
   */
  getPlaceholderImage(restaurantName) {
    const images = [
      'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800&q=80',
      'https://images.unsplash.com/photo-1504674900968-8873f208e0f0?w=800&q=80',
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
      'https://images.unsplash.com/photo-1517248135467-4ee464c27716?w=800&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    ]
    const hash = restaurantName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return images[hash % images.length]
  }

  /**
   * Full discovery workflow
   */
  async discover(lat, lng, radiusKm = 5) {
    const discovered = await this.discoverRestaurants(lat, lng, radiusKm)
    const merged = this.mergeWithDatabase(discovered)
    return merged
  }
}

export default RestaurantDiscoveryAgent
