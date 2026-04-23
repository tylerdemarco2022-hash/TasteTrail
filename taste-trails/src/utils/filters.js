/**
 * Shared filter and rating utility functions
 * Extracted for testability and reuse
 */

const BLOCKED_RESTAURANT_TOKENS = new Set([
  'chickfila',
  'cookout',
  'starbucks',
  'quicktrip',
  'quiktrip',
  'crackerbarrel'
])

export const normalizeRestaurantName = (name = '') =>
  String(name).toLowerCase().replace(/[^a-z0-9]+/g, '')

export const isBlockedRestaurant = (name = '') => {
  const normalized = normalizeRestaurantName(name)
  if (!normalized) return false
  for (const token of BLOCKED_RESTAURANT_TOKENS) {
    if (normalized.includes(token)) return true
  }
  return false
}

export const filterBlockedRestaurants = (list = []) =>
  list.filter((r) => !isBlockedRestaurant(r?.name || r?.restaurant || ''))

/**
 * Generate a deterministic fake rating from an item name.
 * Used as fallback when no real ratings exist.
 */
export function getFakeItemRating(itemName) {
  const seed = String(itemName || 'item').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const rating = 6.8 + (seed % 28) / 10
  const count = 3 + (seed % 37)
  return { rating: rating.toFixed(1), count }
}

/**
 * Check if a restaurant matches the user's dietary preferences
 */
export function restaurantMatchesDietaryPreferences(restaurant, preferences) {
  if (!preferences || preferences.length === 0 || preferences.includes('none')) {
    return true
  }

  const text = `${restaurant.name || ''} ${restaurant.cuisine || ''} ${restaurant.description || ''}`.toLowerCase()

  const vegetarianKeywords = [
    'vegetarian', 'vegan', 'salad', 'bowl', 'pasta', 'pizza', 'mexican', 'asian',
    'thai', 'indian', 'mediterranean', 'italian', 'cafe', 'kitchen', 'grill',
    'bar', 'taphouse', 'cuisine', 'greek', 'bistro', 'house', 'postino'
  ]

  const veganKeywords = [
    'vegan', 'plant-based', 'plant based', 'vegetarian', 'salad', 'bowl'
  ]

  const ketoKeywords = [
    'steak', 'steakhouse', 'burger', 'bbq', 'grilled', 'seafood', 'meat', 'keto',
    'smokehouse', 'grill', 'firegrill', 'grille', 'fish', 'sea level', 'captain'
  ]

  const healthyKeywords = [
    'healthy', 'fresh', 'organic', 'salad', 'bowl', 'grain', 'wellness',
    'kitchen', 'cafe', 'botanical', 'verde'
  ]

  const halalKeywords = ['halal', 'middle eastern', 'mediterranean', 'persian', 'turkish']
  const kosherKeywords = ['kosher', 'jewish']

  for (const pref of preferences) {
    let hasMatch = false

    if (pref === 'vegetarian') {
      const meatOnlyKeywords = ['steakhouse', 'smokehouse', 'bbq joint', 'seafood']
      const isMeatOnly = meatOnlyKeywords.some(keyword => text.includes(keyword))
      hasMatch = vegetarianKeywords.some(keyword => text.includes(keyword)) && !isMeatOnly
    }
    else if (pref === 'vegan') {
      hasMatch = veganKeywords.some(keyword => text.includes(keyword))
    }
    else if (pref === 'keto') {
      hasMatch = ketoKeywords.some(keyword => text.includes(keyword))
    }
    else if (pref === 'dairy_free') {
      const dairyHeavy = ['pizza', 'pizzeria'].some(kw => text.includes(kw))
      hasMatch = !dairyHeavy || text.includes('asian') || text.includes('mexican') || text.includes('grilled')
    }
    else if (pref === 'gluten_free') {
      hasMatch = true
    }
    else if (pref === 'halal') {
      hasMatch = halalKeywords.some(keyword => text.includes(keyword))
    }
    else if (pref === 'kosher') {
      hasMatch = kosherKeywords.some(keyword => text.includes(keyword))
    }

    if (!hasMatch) {
      return false
    }
  }

  return true
}
