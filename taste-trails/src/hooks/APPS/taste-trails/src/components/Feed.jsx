import { API_BASE_URL } from '../config/api'
import React, { useEffect, useState } from 'react'
import { restaurants, posts as communityPosts } from '../data'
import SearchBar from './SearchBar'
import StarRating from './StarRating'

console.log('Feed.jsx LOADED')

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

const BLOCKED_RESTAURANT_TOKENS = new Set([
  'chickfila',
  'cookout',
  'starbucks',
  'quicktrip',
  'quiktrip',
  'crackerbarrel'
])

const normalizeRestaurantName = (name = '') =>
  String(name).toLowerCase().replace(/[^a-z0-9]+/g, '')

const isBlockedRestaurant = (name = '') => {
  const normalized = normalizeRestaurantName(name)
  if (!normalized) return false
  for (const token of BLOCKED_RESTAURANT_TOKENS) {
    if (normalized.includes(token)) return true
  }
  return false
}

const filterBlockedRestaurants = (list = []) =>
  list.filter((r) => !isBlockedRestaurant(r?.name || r?.restaurant || ''))

function MapOverview({ points, user, onSelect, locationInput, setLocationInput, searchLocation, searchingLocation }) {
  const hasUser = Number.isFinite(user?.lat) && Number.isFinite(user?.lon)
  const center = hasUser
    ? `${user.lat},${user.lon}`
    : '35.2271,-80.8431'

  const mapSrc = `https://www.google.com/maps/embed/v1/search?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=restaurants+near+${center}&zoom=13`

  return (
    <div className="rounded-xl overflow-hidden shadow-md">
      <div className="h-48 w-full relative">
        <iframe
          key={center}
          title="Nearby Restaurants"
          src={mapSrc}
          className="w-full h-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
        {/* Location search overlay */}
        <div className="absolute top-2 left-2 right-2 flex gap-2">
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchLocation(locationInput)}
            placeholder="Change location..."
            className="flex-1 px-3 py-2 text-sm bg-white/90 backdrop-blur-sm border-0 rounded-lg shadow-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
            disabled={searchingLocation}
          />
          <button
            onClick={() => searchLocation(locationInput)}
            disabled={searchingLocation || !locationInput.trim()}
            className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition-colors"
          >
            {searchingLocation ? '⏳' : '🔍'}
          </button>
        </div>
      </div>
    </div>
  )
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

  const resolveImage = (r, idx = 0) => {
    const existing = (r.image_url || r.image || '').trim()
    if (existing) return existing
    const nameToken = encodeURIComponent(r.name || 'restaurant')
    return `https://source.unsplash.com/600x400/?restaurant,food,${nameToken}&sig=${idx}`
  }

  async function openWithMenu(r) {
    if (!r) return;
    setOpening(true);
    const restaurantId = r.id || r.restaurantId || r.yelpId;
    const isUuidLike = (value) => typeof value === 'string' && value.length === 36;
    const debugMenuItemsUrl = import.meta.env.VITE_DEBUG_MENU_ITEMS_URL || '';
    try {
      // Try backend menu lookup by id (preferred)
      if (restaurantId) {
        try {
          const idText = String(restaurantId || '');
          if (isUuidLike(idText)) {
            console.log('API_BASE_URL VALUE:', API_BASE_URL);
            const finalUrl = debugMenuItemsUrl || `${API_BASE_URL}/api/restaurants/${restaurantId}/menu-items`;
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
      // Fallback: try by name if no id or empty
      if ((!menu || menu.length < 3) && restaurantId) {
        try {
          const fallbackUrl = `${API_BASE_URL}/api/restaurants/${restaurantId}/full-menu`;
          console.log("Calling:", fallbackUrl);
          const res = await fetch(fallbackUrl);
          const text = await res.text();
          if (res.ok) {
            let data = null;
            try {
              data = JSON.parse(text);
            } catch (err) {
              console.error("MENU FETCH ERROR:", err);
            }
            if (data) {
              if (Array.isArray(data.menu) && data.menu.length) {
                menu = data.menu;
              } else if (Array.isArray(data.categories)) {
                menu = data.categories.flatMap((cat) => cat.items || []);
              }
            }
          } else if (res.status !== 404) {
            console.warn('Menu fallback fetch failed:', text.slice(0, 200));
          }
        } catch (e) {
          console.error("FETCH ERROR:", e);
        }
      }
      // Merge cached found menus from localStorage (from Find Nearby results)
      try {
        const raw = localStorage.getItem('foundMenusByPlace')
        if (raw) {
          const byPlace = JSON.parse(raw || '{}')
          const keyCandidates = [ (r.place_id || '').toString().toLowerCase(), (restaurantName || '').toString().toLowerCase() ]
          for (const k of keyCandidates) {
            if (!k) continue
            const items = byPlace[k]
            if (items && items.length) {
              // map items to menu format expected by MenuView
              const mapped = items.map(it => ({ dish_name: it.dish_name || it.name || '', description: it.description || '', price: it.price || it.price || '' }))
              // prefer cached if no menu or menu small
              if (!menu || menu.length < 3) menu = mapped
              else menu = menu.concat(mapped)
              break
            }
          }
        }
      } catch (e) {
        console.warn('Failed to merge cached found menus', e)
      }
      onOpen({
        id: restaurantId, // always pass id for MenuView
        restaurant: restaurantName,
        menu: menu || [],
        image: r.image_url || r.image,
        lat: r.lat,
        lon: r.lon,
        yelpId: r.id,
        photos: r.photos || []
      });
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
      const filtered = filterBlockedRestaurants(withDist)
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
      const filtered = filterBlockedRestaurants(withDist)
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
    const filtered = filterBlockedRestaurants(withDist)
    setNearby(filtered)
  }, [pos])

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
      const filtered = filterBlockedRestaurants(items)
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
      const filtered = filterBlockedRestaurants(withDist)
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
      {/* Today's Top Picks Section */}
      {topPicks.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border-2 border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🔥</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Today's Top Picks</h3>
              <p className="text-xs text-gray-600">Based on highly-rated items</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {topPicks.map((r, idx) => (
              <div 
                key={r.id || `${r.name}-${idx}`} 
                className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openWithMenu(r)}
              >
                <img
                  src={resolveImage(r, idx)}
                  alt={r.name}
                  className="w-full h-24 object-cover"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=800&q=80' }}
                />
                <div className="p-2">
                  <div className="font-semibold text-sm leading-tight mb-1">{r.name}</div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-yellow-600">⭐ {r.userAvgRating.toFixed(1)}</span>
                    <span className="text-gray-500">({r.userReviewCount} {r.userReviewCount === 1 ? 'review' : 'reviews'})</span>
                  </div>
                  {r.distance != null && (
                    <div className="text-xs text-gray-500 mt-1">📍 {r.distance.toFixed(2)} km away</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Your Favorite Restaurants Section */}
      {topPicks.length > 0 && (
        <div className="glass rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">❤️</span>
            <div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Your Favorites</h3>
              <p className="text-xs text-gray-600">Restaurants you love and visit often</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {topPicks.map((r, idx) => (
              <div 
                key={r.id || `${r.name}-${idx}`} 
                onClick={() => openWithMenu(r)}
                className="card-hover glass rounded-xl overflow-hidden cursor-pointer shadow-md"
              >
                <img 
                  src={resolveImage(r, idx)} 
                  alt={r.name}
                  className="w-full h-24 object-cover"
                  onError={(e) => {e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'}}
                />
                <div className="p-3">
                  <div className="font-bold text-sm text-gray-900 mb-1">{r.name}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">
                      ⭐ {r.userAvgRating?.toFixed(1) || r.avgRating?.toFixed(1)}
                    </span>
                    <span className="text-gray-600">
                      {r.userReviewCount} {r.userReviewCount === 1 ? 'rating' : 'ratings'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex justify-end items-center mb-2">
        <button onClick={getAIRecommendation} className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center text-2xl">
          ✨
        </button>
      </div>

      {/* AI Recommendation Modal */}
      {showAIRecommendation && aiPick && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
              <button
                onClick={() => setShowAIRecommendation(false)}
                className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Not Now
              </button>
              <button
                onClick={() => {
                  setShowAIRecommendation(false)
                  openWithMenu(aiPick)
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:shadow-lg"
              >
                View Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {!pos && <div className="glass rounded-2xl p-8 text-center shadow-lg"><div className="text-4xl mb-3">📍</div><div className="text-gray-600 font-medium">Determining location…</div></div>}
      {pos && (
        <div className="grid grid-cols-2 gap-4">
          {nearby.map((r, idx) => (
            <div key={r.id || `${r.name}-${idx}`} className="card-hover glass rounded-2xl shadow-lg overflow-hidden flex flex-col">
              <div className="relative">
                <img
                  src={resolveImage(r, idx)}
                  alt={r.name}
                  className="w-full h-36 object-cover"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=800&q=80' }}
                />
                {r.avgRating != null && (
                  <div className="absolute top-2 right-2 glass rounded-full px-3 py-1 shadow-lg">
                    <span className="text-xs font-bold flex items-center gap-1">
                      ⭐ {Number(r.avgRating.toFixed(1))}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 space-y-3 flex-1 flex flex-col">
                <div className="font-bold text-base text-gray-900 leading-tight">{r.name}</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {r.distance != null && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium flex items-center gap-1">📍 {r.distance.toFixed(1)} km</span>}
                  {r.waitTime != null && (
                    <span className={`px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
                      r.waitTime === 'Closed' ? 'bg-red-100 text-red-700' :
                      r.waitTime <= 15 ? 'bg-green-100 text-green-700' :
                      r.waitTime <= 30 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {r.waitTime === 'Closed' ? 'Closed' : `Wait: ${r.waitTime} min`}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex gap-2">
                  {r.yelpId && r.review_count >= 10 ? (
                    <button
                      onClick={() => {
                        const restaurantName = encodeURIComponent(r.name)
                        window.open(`https://www.opentable.com/s?term=${restaurantName}`, '_blank')
                      }}
                      className="flex-1 px-3 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                    >
                      📅 Book
                    </button>
                  ) : (
                    <div className="flex-1 px-3 py-2.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-xl text-center flex items-center justify-center">
                      Not Available
                    </div>
                  )}
                  <button
                    onClick={() => openWithMenu(r)}
                    className="flex-1 px-3 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                    disabled={opening}
                  >
                    {opening ? '⏳' : '🍴 Menu'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
