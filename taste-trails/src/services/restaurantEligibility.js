const CHAINS = [
  'subway', 'mcdonalds', 'burger king', 'wendys', 'taco bell', 'chick fil a', 'chickfila',
  'kfc', 'popeyes', 'arbys', 'sonic', 'dominos', 'pizza hut', 'little caesars',
  'jimmy johns', 'jersey mikes', 'firehouse subs', 'hardees', 'bojangles', 'zaxbys',
  'golden corral', 'chipotle', 'qdoba', 'moes', 'panda express', 'five guys',
  'raising canes', 'whataburger', 'dairy queen', 'dunkin', 'starbucks', 'wingstop',
  'taco cabana', 'del taco', 'carls jr', 'jack in the box', 'white castle', 'in n out',
  'papa johns', 'hungry howies', 'cicis', 'blaze pizza', 'mod pizza', 'sweetgreen',
  'cava', 'panera', 'cookout', 'checkers', 'rallys', 'long john silvers', 'auntie annes',
  'krispy kreme', 'jamba', 'el pollo loco', 'churchs chicken', 'boston market'
]

function fold(value) {
  return String(value || '').toLowerCase().replace(/['’]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchesChain(value) {
  const name = fold(value)
  if (!name) return false
  return CHAINS.some((chain) => {
    const token = fold(chain)
    return token && (name === token || name.startsWith(`${token} `))
  })
}

export function isQuickService(place = {}) {
  const amenity = String(place.amenity || '').toLowerCase()
  if (amenity === 'fast_food') return true
  const cuisine = String(place.cuisine || '').toLowerCase()
  if (/(^|[;,\s])buffet($|[;,\s])/.test(cuisine) || /\bbuffet\b/i.test(place.name || '')) return true
  const primary = String(place.primaryType || '').toLowerCase()
  const types = [...(place.types || []), primary].map((type) => String(type).toLowerCase())
  if (types.includes('fast_food_restaurant') || types.includes('fast_food')) return true
  if (primary === 'meal_takeaway') return true
  if (!types.includes('restaurant') && types.includes('meal_takeaway')) return true
  return matchesChain(place.name) || matchesChain(place.brand)
}

export function hasPublishedMenu(place, { savedCount = 0, liveCount = 0 } = {}) {
  return savedCount > 0 || liveCount > 0
}
