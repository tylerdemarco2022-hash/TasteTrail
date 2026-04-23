/**
 * Charlotte Metro Bounding Box
 * Defines geographic boundaries for metro coverage
 * 
 * Coverage includes:
 * - Charlotte (downtown core)
 * - Huntersville (north)
 * - Matthews (southeast)
 * - Pineville (southwest)
 * - Concord (northeast)
 * - Gastonia edge (west)
 */

export const CHARLOTTE_METRO_BOUNDS = {
  minLat: 34.95,
  maxLat: 35.45,
  minLng: -81.10,
  maxLng: -80.60
}

/**
 * Get bounding box info (for debugging)
 */
export function getBoundsInfo() {
  const { minLat, maxLat, minLng, maxLng } = CHARLOTTE_METRO_BOUNDS
  
  const latDelta = maxLat - minLat
  const lngDelta = Math.abs(maxLng - minLng)
  
  // Rough estimation: 1 degree latitude ≈ 69 miles
  // At Charlotte's latitude (~35°), 1 degree longitude ≈ 56 miles
  const latMiles = latDelta * 69
  const lngMiles = lngDelta * 56
  
  return {
    bounds: CHARLOTTE_METRO_BOUNDS,
    size: {
      latMiles: latMiles.toFixed(1),
      lngMiles: lngMiles.toFixed(1)
    },
    center: {
      lat: ((minLat + maxLat) / 2).toFixed(4),
      lng: ((minLng + maxLng) / 2).toFixed(4)
    }
  }
}
