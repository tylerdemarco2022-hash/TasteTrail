import { API_BASE_URL } from '../config/api'
import React, { useEffect, useState } from 'react'
import { restaurants, posts as communityPosts } from '../data'
import SearchBar from './SearchBar'
import StarRating from './StarRating'
import {
  isBlockedRestaurant,
  filterBlockedRestaurants,
  restaurantMatchesDietaryPreferences
} from '../utils/filters'

console.log('Feed.jsx LOADED')

// Restaurant type categories (user-defined)
const RESTAURANT_CATEGORIES = [
  'Fast Food',
  'Fast Casual',
  'Casual Dining',
  'Fine Dining',
  'Buffet',
  'Food Truck',
  'Cafe',
  'Deli',
  'Bakery',
  'Bar & Grill',
  'Steakhouse',
  'Seafood House',
]

const CATEGORY_ICONS = {
  'Fast Food': '🍟',
  'Fast Casual': '🌯',
  'Casual Dining': '🍽️',
  'Fine Dining': '🍷',
  'Buffet': '🥘',
  'Food Truck': '🚚',
  'Cafe': '☕',
  'Deli': '🥪',
  'Bakery': '🧁',
  'Bar & Grill': '🍺',
  'Steakhouse': '🥩',
  'Seafood House': '🦞',
}

// Map every cuisine string from the dataset to one or more categories.
// A restaurant can appear in multiple categories.
const CUISINE_TO_CATEGORIES = {
  // Fast Food
  'classic burgers': ['Fast Food'],
  'bowling alley food': ['Fast Food'],
  'donuts': ['Fast Food', 'Bakery'],
  // Fast Casual
  'burgers': ['Fast Casual'],
  'sushi/burgers': ['Fast Casual'],
  'mexican': ['Fast Casual', 'Casual Dining'],
  'latin': ['Fast Casual', 'Casual Dining'],
  'vietnamese': ['Fast Casual', 'Casual Dining'],
  'thai': ['Fast Casual', 'Casual Dining'],
  'indian': ['Fast Casual', 'Casual Dining'],
  'asian fusion': ['Fast Casual', 'Casual Dining'],
  // Casual Dining
  'american': ['Casual Dining'],
  'american casual': ['Casual Dining'],
  'american diner': ['Casual Dining'],
  'italian': ['Casual Dining'],
  'contemporary american': ['Casual Dining'],
  'new american': ['Casual Dining'],
  'american grill': ['Casual Dining', 'Bar & Grill'],
  'american pub': ['Casual Dining', 'Bar & Grill'],
  'southern': ['Casual Dining'],
  'new southern': ['Casual Dining'],
  'greek': ['Casual Dining'],
  'mediterranean': ['Casual Dining'],
  'spanish': ['Casual Dining'],
  'spanish tapas': ['Casual Dining'],
  'japanese': ['Casual Dining'],
  'chinese': ['Casual Dining'],
  'korean': ['Casual Dining'],
  'asian': ['Casual Dining'],
  'sushi': ['Casual Dining'],
  'wood fired': ['Casual Dining', 'Food Truck'],
  // Fine Dining
  'fine dining': ['Fine Dining'],
  'contemporary': ['Fine Dining'],
  'french': ['Fine Dining'],
  'wine bar': ['Fine Dining', 'Bar & Grill'],
  'organic': ['Fine Dining', 'Casual Dining'],
  'farm to table': ['Fine Dining', 'Casual Dining'],
  // Buffet
  'brazilian': ['Buffet', 'Casual Dining'],
  // Cafe
  'cafe': ['Cafe'],
  'coffee': ['Cafe'],
  // Bakery
  'bakery': ['Bakery'],
  'french bakery': ['Bakery', 'Cafe'],
  // Deli
  'deli': ['Deli'],
  'sandwich': ['Deli'],
  // Bar & Grill
  'pub food': ['Bar & Grill'],
  'brewery': ['Bar & Grill'],
  'craft brewery': ['Bar & Grill'],
  'bbq': ['Bar & Grill'],
  'southern bbq': ['Bar & Grill'],
  // Steakhouse
  'steakhouse': ['Steakhouse'],
  'brazilian steakhouse': ['Steakhouse'],
  // Seafood House
  'seafood': ['Seafood House'],
}

// Name keywords → categories
const NAME_KEYWORDS = [
  { patterns: ['steakhouse', 'steak house'], cat: 'Steakhouse' },
  { patterns: ['seafood'], cat: 'Seafood House' },
  { patterns: ['bar & grill', 'bar and grill', 'taproom', 'tap house', 'ale house', 'brewing', 'brewhouse', 'brew pub', 'brewpub', 'sports bar'], cat: 'Bar & Grill' },
  { patterns: ['buffet'], cat: 'Buffet' },
  { patterns: ['food truck'], cat: 'Food Truck' },
  { patterns: ['cafe', 'café', 'coffee'], cat: 'Cafe' },
  { patterns: ['bakery', 'bake shop', 'donut', 'doughnut'], cat: 'Bakery' },
  { patterns: ['deli', 'delicatessen'], cat: 'Deli' },
  { patterns: ['bistro', 'brasserie', 'trattoria', 'osteria', 'ristorante', 'maison', 'omakase'], cat: 'Fine Dining' },
]

// Known chain names
const CHAIN_CATEGORIES = [
  { names: ["mcdonald", 'burger king', "wendy", 'taco bell', 'kfc', 'chick-fil-a', "popeye", "arby", 'sonic', "jack in the box", "carl's jr", "hardee", 'white castle', "five guys", 'in-n-out', "whataburger", "wingstop", "zaxby", "raising cane", "cook out", 'cookout', 'checkers', "del taco", "el pollo loco", "long john silver", "church's chicken", 'domino', 'pizza hut', "papa john", "little caesar", 'subway', 'jersey mike', 'jimmy john', 'firehouse sub', 'starbucks', 'dunkin'], cat: 'Fast Food' },
  { names: ['chipotle', 'panera', 'shake shack', 'noodles & company', 'qdoba', "moe's", 'panda express', 'sweetgreen', 'cava', 'blaze pizza', 'mod pizza', 'tropical smoothie', "mcalister", 'potbelly', 'smashburger'], cat: 'Fast Casual' },
]

// Returns an array of categories for a restaurant
function getCategories(restaurant) {
  const name = (restaurant.name || '').toLowerCase()
  const cuisine = (restaurant.cuisine || '').toLowerCase().trim()
  const types = (restaurant.types || []).map(t => t.toLowerCase())
  const price = restaurant.price_level || 0
  const cats = new Set()

  // 1. Direct cuisine string match
  if (cuisine && CUISINE_TO_CATEGORIES[cuisine]) {
    CUISINE_TO_CATEGORIES[cuisine].forEach(c => cats.add(c))
  }
  // Partial cuisine match
  if (cuisine && cats.size === 0) {
    for (const [key, values] of Object.entries(CUISINE_TO_CATEGORIES)) {
      if (cuisine.includes(key) || key.includes(cuisine)) {
        values.forEach(c => cats.add(c))
        break
      }
    }
  }

  // 2. Name keyword check
  for (const { patterns, cat } of NAME_KEYWORDS) {
    if (patterns.some(p => name.includes(p))) cats.add(cat)
  }

  // 3. Known chain names
  for (const { names, cat } of CHAIN_CATEGORIES) {
    if (names.some(n => name.includes(n))) cats.add(cat)
  }

  // 4. Google Places types
  if (types.includes('cafe') || types.includes('coffee_shop')) cats.add('Cafe')
  if (types.includes('bakery')) cats.add('Bakery')
  if (types.includes('bar') || types.includes('barbecue_restaurant')) cats.add('Bar & Grill')
  if (types.includes('steak_house')) cats.add('Steakhouse')
  if (types.includes('seafood_restaurant')) cats.add('Seafood House')
  if (types.includes('meal_delivery') || types.includes('meal_takeaway')) cats.add('Fast Food')

  // 5. Price level signal (adds to, not replaces)
  if (price === 1) cats.add('Fast Food')
  if (price === 2) cats.add('Fast Casual')
  if (price === 3) cats.add('Casual Dining')
  if (price >= 4) cats.add('Fine Dining')

  // 6. If still nothing, default to Casual Dining
  if (cats.size === 0) cats.add('Casual Dining')

  return [...cats]
}

// Get top 3 most liked dishes from user ratings OR from menu item data
function getTopDishes(nearbyRestaurants) {
  const dishes = []

  // 1. Pull from localStorage user ratings
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('dishRatings-')) {
        const restaurantName = key.replace('dishRatings-', '')
        const ratings = JSON.parse(localStorage.getItem(key) || '{}')
        for (const [dishName, data] of Object.entries(ratings)) {
          if (data && data.total && data.count) {
            dishes.push({
              name: dishName,
              restaurant: restaurantName,
              avgRating: data.total / data.count,
              reviewCount: data.count,
              source: 'user',
            })
          }
        }
      }
    })
  } catch { /* ignore */ }

  // 2. If we don't have enough user-rated dishes, pull from menu item ratings
  if (dishes.length < 3 && Array.isArray(nearbyRestaurants)) {
    for (const r of nearbyRestaurants) {
      if (r.loading) continue
      for (const item of (r.menu || [])) {
        const itemRating = item.rating
        if (itemRating && itemRating > 0) {
          const itemName = item.dish_name || item.name || item.title || ''
          if (!itemName) continue
          // Skip if we already have a user rating for this dish
          if (dishes.some(d => d.name === itemName && d.restaurant === r.name)) continue
          dishes.push({
            name: itemName,
            restaurant: r.name,
            avgRating: itemRating,
            reviewCount: 1,
            source: 'menu',
          })
        }
      }
    }
  }

  // Sort: user-rated first, then by avg rating desc, then review count desc
  dishes.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'user' ? -1 : 1
    if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating
    return b.reviewCount - a.reviewCount
  })
  return dishes.slice(0, 3)
}

function groupByCategory(restaurants) {
  const groups = {}
  for (const r of restaurants) {
    const cats = getCategories(r)
    for (const cat of cats) {
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(r)
    }
  }
  // Sort each group by rating desc (keep all for "View All")
  for (const [cat, list] of Object.entries(groups)) {
    groups[cat] = list.sort((a, b) => (b.avgRating || b.rating || 0) - (a.avgRating || a.rating || 0))
  }
  return groups
}

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180
  const R = 6371 // km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function calculateWaitTime(restaurant) {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay() // 0 = Sunday, 6 = Saturday
  
  // Check if restaurant is closed (typical hours 7am - 11pm)
  if (hour < 7 || hour >= 23) {
    return 'Closed'
  }
  
  // Base wait time (in minutes)
  let baseWait = 15
  
  // Adjust based on time of day
  if (hour >= 11 && hour <= 13) {
    // Lunch rush
    baseWait = 30
  } else if (hour >= 18 && hour <= 20) {
    // Dinner rush
    baseWait = 40
  } else if (hour >= 7 && hour <= 9) {
    // Breakfast rush
    baseWait = 20
  }
  
  // Weekend adjustment
  if (day === 0 || day === 6) {
    baseWait += 10
  }
  
  // Adjust based on rating (popular places have longer waits)
  if (restaurant.avgRating) {
    const popularityFactor = Math.max(0, (restaurant.avgRating - 5) / 5)
    baseWait += Math.floor(popularityFactor * 15)
  }
  
  // Add some randomness (-5 to +5 minutes)
  const randomOffset = Math.floor(Math.random() * 11) - 5
  baseWait += randomOffset
  
  // Ensure minimum wait time
  return Math.max(5, baseWait)
}

const filterRestaurantsByDietaryPreferences = (list = [], preferences) => {
  return list.filter((r) => restaurantMatchesDietaryPreferences(r, preferences))
}

const filterAllRestaurants = (list = [], preferences) => {
  let filtered = filterBlockedRestaurants(list)
  filtered = filterRestaurantsByDietaryPreferences(filtered, preferences)
  return filtered
}


export default function Feed({ onOpen }) {
  const [pos, setPos] = useState({ lat: 35.2271, lon: -80.8431 })
  const [nearby, setNearby] = useState([])
  const [showAIRecommendation, setShowAIRecommendation] = useState(false)
  const [aiPick, setAiPick] = useState(null)
  const [locationInput, setLocationInput] = useState('')
  const [searchingLocation, setSearchingLocation] = useState(false)
  const [opening, setOpening] = useState(false)
  const [topPicks, setTopPicks] = useState([])
  const [activeCuisine, setActiveCuisine] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [communityTopDishes, setCommunityTopDishes] = useState([])
  const [loadingTopDishes, setLoadingTopDishes] = useState(false)

  const toggleExpand = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  // Compute category groups from nearby restaurants
  const categoryGroups = React.useMemo(() => {
    const valid = nearby.filter(r => !r.loading)
    if (!valid.length) return {}
    return groupByCategory(valid)
  }, [nearby])

  // Always show all 12 categories in fixed order
  const categoryOrder = RESTAURANT_CATEGORIES

  // Top 3 dishes of the week
  const topDishes = React.useMemo(() => getTopDishes(nearby), [nearby])
  const [dietaryPreferences, setDietaryPreferences] = useState(() => {
    try {
      const prefs = localStorage.getItem('dietary_preferences')
      return prefs ? JSON.parse(prefs) : []
    } catch {
      return []
    }
  })

  // Calculate top picks based on user ratings
  const calculateTopPicks = () => {
    const restaurantScores = {}
    
    // Get all ratings from localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('dishRatings-')) {
        const restaurantName = key.replace('dishRatings-', '')
        try {
          const ratings = JSON.parse(localStorage.getItem(key) || '{}')
          const ratingValues = Object.values(ratings)
            .filter(r => r && r.total && r.count)
            .map(r => r.total / r.count)
          
          if (ratingValues.length > 0) {
            const avgRating = ratingValues.reduce((sum, val) => sum + val, 0) / ratingValues.length
            const totalReviews = ratingValues.length
            
            // Score = average rating * weight based on number of reviews
            // Restaurants with more reviews and higher ratings score better
            const score = avgRating * (1 + Math.log(totalReviews + 1))
            
            restaurantScores[restaurantName] = {
              score,
              avgRating,
              reviewCount: totalReviews
            }
          }
        } catch (e) {
          console.error('Error parsing ratings for', restaurantName, e)
        }
      }
    })
    
    // Match scored restaurants with nearby restaurants
    const scoredRestaurants = nearby
      .map(r => {
        const score = restaurantScores[r.name]
        return score ? { ...r, userScore: score.score, userAvgRating: score.avgRating, userReviewCount: score.reviewCount } : null
      })
      .filter(r => r !== null)
      .sort((a, b) => b.userScore - a.userScore)
      .slice(0, 4)
    
    setTopPicks(scoredRestaurants)
  }

  useEffect(() => {
    if (nearby.length > 0) {
      calculateTopPicks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearby])

  // Fetch community-wide top dishes from backend
  useEffect(() => {
    const fetchCommunityTopDishes = async () => {
      setLoadingTopDishes(true)
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/top-dishes?days=7&limit=3&minRatings=1`
        )
        if (!response.ok) throw new Error('Failed to fetch top dishes')
        const data = await response.json()
        console.log('📊 Community top 3 dishes loaded:', data)
        setCommunityTopDishes(data.topDishes || [])
      } catch (err) {
        console.error('Error fetching community top dishes:', err)
        setCommunityTopDishes([])
      } finally {
        setLoadingTopDishes(false)
      }
    }

    fetchCommunityTopDishes()
    // Refresh every 2 minutes to see new ratings
    const interval = setInterval(fetchCommunityTopDishes, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const resolveImage = (r, idx = 0) => {
    const existing = (r.image_url || r.image || '').trim()
    if (existing) return existing
    const nameToken = encodeURIComponent(r.name || 'restaurant')
    return `https://source.unsplash.com/600x400/?restaurant,food,${nameToken}&sig=${idx}`
  }

  // Generate responsive image srcset for Unsplash images
  const generateImageSrcSet = (baseUrl) => {
    if (!baseUrl.includes('unsplash.com')) return ''
    return `${baseUrl.replace(/(\?|&)w=\d+/, '')}?w=300&auto=format&fit=crop&q=80 300w, ${baseUrl.replace(/(\?|&)w=\d+/, '')}?w=600&auto=format&fit=crop&q=80 600w, ${baseUrl.replace(/(\?|&)w=\d+/, '')}?w=900&auto=format&fit=crop&q=80 900w`
  }

  async function openWithMenu(r) {
    if (!r) return;
    setOpening(true);
    const restaurantId = r.id || r.restaurantId || r.yelpId;
    const isUuidLike = (value) => typeof value === 'string' && value.length === 36;
    const debugMenuItemsUrl = import.meta.env.VITE_DEBUG_MENU_ITEMS_URL || '';
    let menu = [];
    try {
      // Try backend menu lookup by id (preferred)
      if (restaurantId) {
        try {
          const idText = String(restaurantId || '');
          if (isUuidLike(idText)) {
            console.log('API_BASE_URL VALUE:', API_BASE_URL);
            const finalUrl = debugMenuItemsUrl || `${API_BASE_URL}/api/restaurants/${restaurantId}/full-menu`;
            console.log('MENU FETCH URL:', finalUrl);
            console.log('FETCH BLOCK ENTERED');
            try {
              const res = await fetch(finalUrl);
              console.log('MENU RESPONSE STATUS:', res.status);
              const text = await res.text();
              console.log('MENU RAW RESPONSE:', text.slice(0, 200));
              let data = null;
              try {
                data = JSON.parse(text);
              } catch (err) {
                console.error('MENU FETCH ERROR:', err);
              }
              if (Array.isArray(data) && data.length) {
                menu = data;
              }
            } catch (err) {
              console.error('MENU FETCH ERROR:', err);
              throw err;
            }
          }
        } catch (e) {
          console.error('FETCH ERROR:', e);
        }
      }
      // Pass the fetched menu data to the onOpen prop
      const updatedRestaurant = { ...r, menu };
      onOpen(updatedRestaurant);
    } catch (error) {
      console.error('Error in openWithMenu:', error);
    } finally {
      setOpening(false);
    }
  }
// DEV ONLY: If feed is empty, add a seed restaurant for testing
// Remove or comment for production
if (typeof window !== 'undefined' && window.DEV_SEED && restaurants && restaurants.length > 0) {
  // Add a seed restaurant to nearby/topPicks for testing
  // Example: restaurants[0] (Bao & Co)
  // Usage: setNearby([restaurants[0]])
}

  useEffect(() => {
    // Default to Charlotte unless the user explicitly changes location in the UI.
    setPos({ lat: 35.2271, lon: -80.8431 })
  }, [])

  useEffect(() => {
    if (pos) {
      fetchNearbyYelp()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos])

  // Listen for dietary preference changes from Settings
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dietary_preferences') {
        try {
          const updated = e.newValue ? JSON.parse(e.newValue) : []
          setDietaryPreferences(updated)
        } catch {
          setDietaryPreferences([])
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  async function searchLocation(address) {
    if (!address.trim()) return
    
    setSearchingLocation(true)
    try {
      // Use Nominatim (OpenStreetMap) geocoding service
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TasteTrails-App' }
      })
      const data = await res.json()
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        const newPos = { lat: parseFloat(lat), lon: parseFloat(lon) }
        setPos(newPos)
        setLocationInput('')
        
        // Fetch restaurants in the searched area
        await fetchRestaurantsNearLocation(newPos)
      } else {
        alert('Location not found. Try a different address or city name.')
      }
    } catch (e) {
      console.error('Geocoding error:', e)
      alert('Failed to search location. Please try again.')
    } finally {
      setSearchingLocation(false)
    }
  }

  async function fetchRestaurantsNearLocation(location) {
    try {
      setNearby([{ name: 'Loading nearby restaurants...', loading: true, lat: location.lat, lon: location.lon }])

      // Fetch nearby restaurants from backend
      const res = await fetch(`${API_BASE_URL}/api/nearby-restaurants?lat=${location.lat}&lon=${location.lon}&radius=25`)
      if (!res.ok) {
        const errorData = await res.json()
        console.warn('API error:', errorData)
        throw new Error(errorData.error || 'Failed to fetch nearby restaurants')
      }

      const data = await res.json()
      let foundRestaurants = data.restaurants || []

      // Fetch menu for each restaurant
      const restaurantsWithMenus = await Promise.all(
        foundRestaurants.slice(0, 30).map(async (r) => {
          try {
            // Use Google Place Details if we have a place_id
            const menuRes = await fetch(`${API_BASE_URL}/api/google/place/${r.id}`)
            const menuData = await menuRes.json()
            
            // Generate menu items with AI
            let menu = []
            try {
              const aiMenuRes = await fetch(`${API_BASE_URL}/api/generate-menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  restaurantName: r.name,
                  address: r.address || 'unknown',
                  primaryType: r.primaryType,
                  priceLevel: r.price_level,
                  rating: r.rating,
                  types: r.types || []
                })
              })
              const aiMenuData = await aiMenuRes.json()
              menu = aiMenuData.menu || []
            } catch (aiError) {
              console.warn('Failed to generate menu with AI for', r.name)
            }
            
            return {
              ...r,
              menu,
              googlePlaceId: r.id,
              menu_url: menuData.menu,
              photos: menuData.photos || [r.image].filter(Boolean),
              review_count: menuData.review_count || r.review_count || 0,
              url: menuData.url
            }
          } catch (e) {
            console.error('Failed to fetch details for', r.name, e)
            return {
              ...r,
              menu: [],
              googlePlaceId: r.id,
              photos: [r.image].filter(Boolean)
            }
          }
        })
      )

      // Calculate ratings and wait times
      const withDist = restaurantsWithMenus.map((r) => {
        const distance = haversine(location.lat, location.lon, r.lat, r.lon)
        const itemRatings = (r.menu || []).map((i) => i.rating).filter(Boolean)
        const postRatings = (communityPosts || []).filter(p => (p.restaurant || '').toLowerCase() === (r.name || '').toLowerCase()).map(p => p.rating).filter(Boolean)
        const all = [...itemRatings, ...postRatings]
        const avgRating = all.length ? (all.reduce((s, v) => s + v, 0) / all.length) : (r.rating || 0)
        const waitTime = calculateWaitTime({ ...r, avgRating })
        return { ...r, distance, avgRating, waitTime }
      })

      withDist.sort((a, b) => a.distance - b.distance)
      const filtered = filterAllRestaurants(withDist, dietaryPreferences)
      setNearby(filtered)

      // Cache results
      localStorage.setItem('nearby-restaurants-cache', JSON.stringify(filtered))
    } catch (e) {
      console.error('Failed to fetch nearby restaurants:', e)
      alert('Error fetching restaurants: ' + e.message)
      // Fall back to seed data
      const withDist = restaurants.map((r) => {
        const distance = haversine(location.lat, location.lon, r.lat, r.lon)
        const itemRatings = (r.menu || []).map((i) => i.rating).filter(Boolean)
        const postRatings = (communityPosts || []).filter(p => (p.restaurant || '').toLowerCase() === (r.name || r.restaurant || '').toLowerCase()).map(p => p.rating).filter(Boolean)
        const all = [...itemRatings, ...postRatings]
        const avgRating = all.length ? (all.reduce((s, v) => s + v, 0) / all.length) : null
        const waitTime = calculateWaitTime({ ...r, avgRating })
        return ({ ...r, distance, avgRating, waitTime })
      })
      withDist.sort((a, b) => a.distance - b.distance)
      const filtered = filterAllRestaurants(withDist, dietaryPreferences)
      setNearby(filtered)
    }
  }

  useEffect(() => {
    if (!pos) return
    const withDist = restaurants.map((r) => {
      const distance = haversine(pos.lat, pos.lon, r.lat, r.lon)
      // collect ratings from menu items and community posts
      const itemRatings = (r.menu || []).map((i) => i.rating).filter(Boolean)
      const postRatings = (communityPosts || []).filter(p => (p.restaurant || '').toLowerCase() === (r.name || r.restaurant || '').toLowerCase()).map(p => p.rating).filter(Boolean)
      const all = [...itemRatings, ...postRatings]
      const avgRating = all.length ? (all.reduce((s, v) => s + v, 0) / all.length) : null
      const waitTime = calculateWaitTime({ ...r, avgRating })
      return ({ ...r, distance, avgRating, waitTime })
    })
    withDist.sort((a, b) => a.distance - b.distance)
    const filtered = filterAllRestaurants(withDist, dietaryPreferences)
    setNearby(filtered)
  }, [pos, dietaryPreferences])

  // Load OSM restaurants for Charlotte (cached)
  async function fetchCharlotte() {
    try {
      const cached = localStorage.getItem('osm-charlotte')
      if (cached) {
        const parsed = JSON.parse(cached)
        setNearby(parsed)
        return
      }

      const query = `[out:json][timeout:25];area["name"="Charlotte"]["boundary"="administrative"]->.a;(node["amenity"="restaurant"](area.a);way["amenity"="restaurant"](area.a);relation["amenity"="restaurant"](area.a););out center 200;`;
      const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query)
      const res = await fetch(url)
      if (!res.ok) throw new Error('Overpass query failed')
      const data = await res.json()
      const items = (data.elements || []).map((el) => {
        const lat = el.lat || (el.center && el.center.lat) || 0
        const lon = el.lon || (el.center && el.center.lon) || 0
        return {
          id: el.id,
          name: (el.tags && (el.tags.name || el.tags.brand)) || 'Unnamed',
          lat,
          lon,
          image: `https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=${el.id}`,
          menu: []
        }
      })
      // store and set
      const filtered = filterAllRestaurants(items, dietaryPreferences)
      localStorage.setItem('osm-charlotte', JSON.stringify(filtered))
      setNearby(filtered)
    } catch (e) {
      console.error('Failed to fetch Charlotte restaurants', e)
    }
  }

  // Fetch nearby restaurants from Yelp within 25 miles and get their menus
  async function fetchNearbyYelp() {
    if (!pos) {
      alert('Getting your location...')
      return
    }

    try {
      // Show loading state
      setNearby([{ name: 'Loading nearby restaurants...', loading: true }])

      // Fetch nearby restaurants from backend
      const res = await fetch(`${API_BASE_URL}/api/nearby-restaurants?lat=${pos.lat}&lon=${pos.lon}&radius=25`)
      if (!res.ok) throw new Error('Failed to fetch nearby restaurants')

      const data = await res.json()
      let restaurants = data.restaurants || []

      const cachedMenus = (() => {
        try {
          return JSON.parse(localStorage.getItem('foundMenusByPlace') || '{}')
        } catch (e) {
          return {}
        }
      })()

      // Defer menu fetching until a user opens a restaurant.
      const restaurantsWithMenus = restaurants.slice(0, 30).map((r) => {
        const keyCandidates = [
          String(r.place_id || r.id || '').toLowerCase(),
          String(r.name || '').toLowerCase()
        ]
        let menuItems = []
        for (const key of keyCandidates) {
          if (!key) continue
          const items = cachedMenus[key]
          if (Array.isArray(items) && items.length) {
            menuItems = items.map((it) => ({
              dish_name: it.dish_name || it.name || '',
              description: it.description || '',
              price: it.price || ''
            }))
            break
          }
        }
        return {
          ...r,
          name: r.name,
          image: r.image,
          menu: menuItems,
          yelpId: r.id,
          menu_url: null,
          photos: r.photos || [],
          review_count: r.review_count || 0
        }
      })

      // Calculate ratings and wait times
      const withDist = restaurantsWithMenus.map((r) => {
        const distance = haversine(pos.lat, pos.lon, r.lat, r.lon)
        const itemRatings = (r.menu || []).map((i) => i.rating).filter(Boolean)
        const postRatings = (communityPosts || []).filter(p => (p.restaurant || '').toLowerCase() === (r.name || '').toLowerCase()).map(p => p.rating).filter(Boolean)
        const all = [...itemRatings, ...postRatings]
        const avgRating = all.length ? (all.reduce((s, v) => s + v, 0) / all.length) : (r.rating || 0)
        const waitTime = calculateWaitTime({ ...r, avgRating })
        return { ...r, distance, avgRating, waitTime }
      })

      withDist.sort((a, b) => a.distance - b.distance)
      const filtered = filterAllRestaurants(withDist, dietaryPreferences)
      setNearby(filtered)

      // Cache results
      localStorage.setItem('nearby-yelp-restaurants', JSON.stringify(filtered))
    } catch (e) {
      console.error('Failed to fetch nearby restaurants from Yelp', e)
      alert('Error: ' + e.message)
      setNearby([])
    }
  }

  // Load OSM restaurants for Charlotte (cached)

  function getAIRecommendation() {
    // Analyze user preferences based on saved items and ratings
    const savedItems = JSON.parse(localStorage.getItem('savedItems')) || []
    const userPosts = communityPosts.filter(p => p.user.name === 'You')
    
    // Calculate preferences
    const preferences = {}
    
    // From saved items with high user ratings
    savedItems.forEach(item => {
      if (item.user_rating && item.user_rating >= 7) {
        const restaurant = item.restaurant.toLowerCase()
        preferences[restaurant] = (preferences[restaurant] || 0) + item.user_rating
      }
    })
    
    // From user posts with high ratings
    userPosts.forEach(post => {
      if (post.rating >= 7) {
        const restaurant = post.restaurant.toLowerCase()
        preferences[restaurant] = (preferences[restaurant] || 0) + post.rating
      }
    })
    
    // Find similar restaurants or highly rated ones
    const recommended = nearby.filter(r => {
      // Skip if already in preferences (already visited)
      if (preferences[r.name.toLowerCase()]) return false
      
      // Recommend highly rated restaurants nearby
      return r.avgRating && r.avgRating >= 7 && r.distance < 5
    }).sort((a, b) => {
      // Sort by rating first, then distance
      if (b.avgRating !== a.avgRating) {
        return b.avgRating - a.avgRating
      }
      return a.distance - b.distance
    })
    
    if (recommended.length > 0) {
      const pick = recommended[0]
      setAiPick(pick)
      setShowAIRecommendation(true)
    } else {
      // Fallback: pick highest rated nearby
      const fallback = nearby.filter(r => r.avgRating).sort((a, b) => b.avgRating - a.avgRating)[0]
      setAiPick(fallback || nearby[0])
      setShowAIRecommendation(true)
    }
  }


  return (
    <main className="max-w-3xl w-full mx-auto p-4 pb-24 space-y-6">

      {/* Top 3 Dishes of the Week - Community-wide Highest Rated */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border border-blue-200/60 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🔥</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Top 3 This Week</h3>
              <p className="text-xs text-gray-500">Highest-rated by the community</p>
            </div>
          </div>
          {loadingTopDishes && <span className="text-xs text-gray-400 animate-pulse">Loading...</span>}
        </div>

        {communityTopDishes && communityTopDishes.length > 0 ? (
          <div className="space-y-2.5">
            {communityTopDishes.map((dish, idx) => (
              <div
                key={`${dish.id}-${idx}`}
                className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border border-blue-100/50"
              >
                {/* Medal */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white ${
                  idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                  idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                  'bg-gradient-to-br from-orange-400 to-orange-600'
                }`}>
                  {['🥇', '🥈', '🥉'][idx]}
                </div>

                {/* Dish Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">{dish.name}</div>
                  <div className="text-xs text-gray-500 truncate">at {dish.restaurant?.name || 'Unknown'}</div>
                </div>

                {/* Rating and Count */}
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-blue-600">{dish.rating}</span>
                    <span className="text-yellow-400">⭐</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">{dish.ratingCount} {dish.ratingCount === 1 ? 'rating' : 'ratings'}</div>
                </div>
              </div>
            ))}
          </div>
        ) : loadingTopDishes ? (
          <div className="text-center py-6">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <p className="text-sm text-gray-400 mt-2">Finding the best dishes...</p>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-gray-400">
            Be the first to rate a dish! ⭐ See it on the leaderboard.
          </div>
        )}
      </div>

      {/* AI Recommendation Button */}
      <div className="flex justify-end items-center">
        <button onClick={getAIRecommendation} aria-label="Get AI restaurant recommendation" className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center text-2xl">
          ✨
        </button>
      </div>

      {/* AI Recommendation Modal */}
      {showAIRecommendation && aiPick && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="AI Restaurant Recommendation">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">✨🍽️✨</div>
              <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
                AI Recommends
              </h3>
              <p className="text-sm text-gray-500 mt-1">Based on your taste preferences</p>
            </div>
            <div className="mb-4">
              <img
                src={aiPick.image_url || aiPick.image}
                alt={aiPick.name}
                loading="lazy"
                className="w-full h-48 object-cover rounded-lg mb-3"
                onError={(e) => {e.target.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'}}
              />
              <h4 className="text-xl font-bold mb-2">{aiPick.name}</h4>
              {aiPick.avgRating && (
                <div className="flex items-center gap-2 mb-2">
                  <StarRating value={aiPick.avgRating} />
                </div>
              )}
              {aiPick.distance != null && (
                <p className="text-sm text-gray-600">📍 {aiPick.distance.toFixed(2)} km away</p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                💡 This restaurant matches your preferences for highly-rated places nearby!
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAIRecommendation(false)} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Not Now</button>
              <button onClick={() => { setShowAIRecommendation(false); openWithMenu(aiPick) }} className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:shadow-lg">View Menu</button>
            </div>
          </div>
        </div>
      )}

      {!pos && <div className="glass rounded-2xl p-8 text-center shadow-lg"><div className="text-4xl mb-3">📍</div><div className="text-gray-600 font-medium">Determining location...</div></div>}

      {/* Category Filter Chips - always show all 12 */}
      {pos && (
        <div className="cuisine-chips-scroll flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <button
            onClick={() => setActiveCuisine(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeCuisine === null
                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm'
            }`}
          >
            All
          </button>
          {categoryOrder.map(cat => {
            const count = (categoryGroups[cat] || []).length
            const isEmpty = count === 0
            return (
              <button
                key={cat}
                onClick={() => !isEmpty && setActiveCuisine(activeCuisine === cat ? null : cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                  activeCuisine === cat
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
                    : isEmpty
                      ? 'bg-gray-100 text-gray-400 border border-gray-100 cursor-default'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm'
                }`}
              >
                {CATEGORY_ICONS[cat] || '🍽️'} {cat}
                {count > 0 && <span className="ml-1 text-xs opacity-70">({count})</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Category Sections - Each on its own row */}
      {pos && (
        <div className="space-y-8">
          {(activeCuisine ? [activeCuisine] : categoryOrder)
            .filter(c => (categoryGroups[c] || []).length > 0)
            .map(cat => (
            <section key={cat}>
              {/* Section Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{CATEGORY_ICONS[cat] || '🍽️'}</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Top {cat}</h3>
                  <p className="text-xs text-gray-500">Best rated {cat.toLowerCase()} near you</p>
                </div>
              </div>

              {/* Horizontal Scroll Cards */}
              <div className="cuisine-row-scroll flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory -mx-1 px-1">
                {(expandedCategories[cat] ? categoryGroups[cat] : categoryGroups[cat].slice(0, 5)).map((r, idx) => (
                  <div
                    key={r.id || `${r.name}-${idx}`}
                    className="flex-shrink-0 w-[280px] snap-start card-hover bg-white rounded-2xl shadow-md overflow-hidden flex flex-col border border-gray-100 hover:shadow-xl transition-shadow"
                  >
                    {/* Card Image */}
                    <div className="relative">
                      <img
                        src={`${resolveImage(r, idx)}${resolveImage(r, idx).includes('?') ? '&' : '?'}w=600&auto=format&fit=crop&q=80`}
                        alt={r.name}
                        loading="lazy"
                        className="w-full h-40 object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=800&q=80' }}
                      />
                      {/* Rating Badge */}
                      {(r.avgRating != null || r.rating != null) && (
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-lg">
                          <span className="text-sm font-bold flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            {Number((r.avgRating || r.rating || 0).toFixed(1))}
                          </span>
                        </div>
                      )}
                      {/* Rank Badge */}
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow-lg">
                        #{idx + 1}
                      </div>
                      {/* Wait Time Overlay */}
                      {r.waitTime != null && (
                        <div className={`absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                          r.waitTime === 'Closed' ? 'bg-red-500 text-white' :
                          r.waitTime <= 15 ? 'bg-green-500 text-white' :
                          r.waitTime <= 30 ? 'bg-yellow-500 text-white' :
                          'bg-red-500 text-white'
                        }`}>
                          {r.waitTime === 'Closed' ? 'Closed' : `${r.waitTime} min wait`}
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col">
                      <h4 className="font-bold text-base text-gray-900 leading-tight mb-2 line-clamp-1">{r.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        {r.cuisine && (
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium">{r.cuisine}</span>
                        )}
                        {r.price_level && (
                          <span className="text-green-700 font-semibold">{'$'.repeat(r.price_level)}</span>
                        )}
                        {r.distance != null && (
                          <span className="flex items-center gap-0.5">📍 {(r.distance * 0.621371).toFixed(1)} mi</span>
                        )}
                      </div>
                      {r.review_count > 0 && (
                        <p className="text-xs text-gray-400 mb-3">{r.review_count} reviews</p>
                      )}
                      <div className="mt-auto flex gap-2">
                        <button
                          onClick={() => {
                            const restaurantName = encodeURIComponent(r.name)
                            window.open(`https://www.opentable.com/s?term=${restaurantName}`, '_blank')
                          }}
                          aria-label={`Book a table at ${r.name}`}
                          className="flex-1 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          Reserve
                        </button>
                        <button
                          onClick={() => openWithMenu(r)}
                          aria-label={`View menu for ${r.name}`}
                          className="flex-1 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-sm hover:shadow-md transition-all"
                          disabled={opening}
                        >
                          {opening ? '...' : 'View Menu'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* View All / Show Less button */}
              {categoryGroups[cat].length > 5 && (
                <button
                  onClick={() => toggleExpand(cat)}
                  className="mt-2 w-full py-2.5 text-sm font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors flex items-center justify-center gap-1"
                >
                  {expandedCategories[cat]
                    ? 'Show Less'
                    : `View All ${categoryGroups[cat].length} Restaurants`}
                  <span className="text-xs">{expandedCategories[cat] ? '▲' : '▶'}</span>
                </button>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Loading / empty state */}
      {pos && nearby.length > 0 && nearby[0].loading && (
        <div className="glass rounded-2xl p-8 text-center shadow-lg">
          <div className="text-4xl mb-3 animate-pulse">🍽️</div>
          <div className="text-gray-600 font-medium">Finding restaurants near you...</div>
        </div>
      )}
      {pos && nearby.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center shadow-lg">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-gray-600 font-medium">No restaurants found nearby</div>
        </div>
      )}
    </main>
  )
}
