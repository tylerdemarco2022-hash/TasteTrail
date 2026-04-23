/**
 * Compute confidence score (0-5) for a restaurant based on data completeness
 * @param {Object} restaurant - Restaurant object with various fields
 * @returns {number} Confidence score 0-5
 */
export function computeConfidence(restaurant) {
  let score = 0

  if (restaurant.name) score++ // +1 for name (required anyway)
  if (restaurant.cuisine) score++ // +1 for cuisine
  if (restaurant.phone) score++ // +1 for phone
  if (restaurant.website) score++ // +1 for website
  if (restaurant.address || restaurant.opening_hours) score++ // +1 for address or hours

  return Math.min(score, 5)
}
