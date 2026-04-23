/**
 * Normalize restaurant names for deduplication
 * @param {string} name - Restaurant name
 * @returns {string} Normalized name
 */
export function normalizeName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
}

/**
 * Normalize cuisine field
 * @param {string} cuisine - Raw cuisine string (may contain semicolon/comma separated values)
 * @returns {string|null} Primary normalized cuisine or null
 */
export function normalizeCuisine(cuisine) {
  if (!cuisine) return null

  // Split by semicolon or comma, take first, lowercase
  const primary = cuisine
    .split(/[;,]/)
    .map(c => c.trim().toLowerCase())
    .filter(c => c.length > 0)[0]

  return primary || null
}

/**
 * Create a location key for local deduplication (rounds to 4 decimals)
 * Approximately 10m precision at equator
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function getLocationKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}
