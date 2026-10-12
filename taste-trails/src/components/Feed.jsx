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

export default function Feed({ onOpen }) {
  const [pos, setPos] = useState(null)
  const [nearby, setNearby] = useState([])
  const [nearbyError, setNearbyError] = useState('')
  const [showAIRecommendation, setShowAIRecommendation] = useState(false)
  const [aiPick, setAiPick] = useState(null)
  const [locationInput, setLocationInput] = useState('')
  const [searchingLocation, setSearchingLocation] = useState(false)
  const [opening, setOpening] = useState(false)
  const [topPicks, setTopPicks] = useState([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [locationNote, setLocationNote] = useState('Finding restaurants near you.')

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
    if (!r || r.loading) return;
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
      const updatedRestaurant = {
        ...r,
        menu,
        restaurant: r.restaurant || r.name,
        website: r.website || null,
        lat: r.lat,
        lon: r.lon
      };
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
    if (!navigator.geolocation) {
      setPos(null)
      setLocationNote('Location is unavailable. Enter a city or ZIP.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationNote('Using your location.')
        setPos({ lat: position.coords.latitude, lon: position.coords.longitude })
      },
      () => {
        setPos(null)
        setLocationNote('Location permission was denied. Enter a city or ZIP.')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }, [])

  useEffect(() => {
    if (!pos || pos.fromSearch) return
    loadNearby(pos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos])

  async function searchLocation(address) {
    if (!address.trim()) return
    setSearchingLocation(true)
    setNearbyError('')
    try {
      await loadNearby(null, address.trim())
    } catch (e) {
      console.error('Geocoding error:', e)
      setNearbyError('That city or ZIP could not be found.')
    } finally {
      setSearchingLocation(false)
    }
  }

  async function loadNearby(location, query) {
    setNearbyLoading(true)
    setNearbyError('')
    try {
      const params = new URLSearchParams({ radius: '3' })
      if (query) params.set('q', query)
      else {
        params.set('lat', String(location.lat))
        params.set('lon', String(location.lon))
      }
      const res = await fetch(`${API_BASE_URL}/api/nearby-restaurants?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch nearby restaurants')
      const rows = (data.restaurants || []).map((restaurant) => ({
        ...restaurant,
        image: restaurant.photoName ? `${API_BASE_URL}/api/place-photo?name=${encodeURIComponent(restaurant.photoName)}` : null,
        distance: restaurant.distanceMiles == null ? null : restaurant.distanceMiles * 1.60934
      }))
      if (query && data.location?.latitude != null && data.location?.longitude != null) {
        setPos({ lat: data.location.latitude, lon: data.location.longitude, fromSearch: true })
      }
      if (data.location?.label) setLocationNote(data.location.label)
      else if (location) setLocationNote('Using your location.')
      setNearby(filterBlockedRestaurants(rows))
    } catch (e) {
      console.error('Failed to fetch nearby restaurants:', e)
      setNearbyError(e.message || 'Nearby restaurants are unavailable right now.')
      setNearby([])
    } finally {
      setNearbyLoading(false)
    }
  }

  async function fetchRestaurantsNearLocation(location) {
    return loadNearby(location)
  }

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
      setNearbyError('')
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
      setNearbyError('Nearby restaurants are unavailable right now. Search still works on saved menus.')
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

      <form
        className="glass rounded-2xl p-4 shadow-lg space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          searchLocation(locationInput)
        }}
      >
        <div className="text-sm text-gray-600">{locationNote}</div>
        <div className="flex gap-2">
          <input
            value={locationInput}
            onChange={(event) => setLocationInput(event.target.value)}
            placeholder="City or ZIP"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl"
            aria-label="City or ZIP"
          />
          <button
            type="submit"
            disabled={searchingLocation}
            className="px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold disabled:opacity-60"
          >
            {searchingLocation ? 'Searching' : 'Search'}
          </button>
        </div>
      </form>
      {nearbyLoading && (
        <div className="glass rounded-2xl p-6 text-center shadow-lg text-sm text-gray-600">Finding restaurants…</div>
      )}
      {nearbyError && (
        <div className="glass rounded-2xl p-6 text-center shadow-lg text-sm text-gray-600">{nearbyError}</div>
      )}
      {!nearbyLoading && nearby.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {nearby.map((r, idx) => (
            <div key={r.id || `${r.name}-${idx}`} className="card-hover glass rounded-2xl shadow-lg overflow-hidden flex flex-col">
              <div className="relative">
                {r.image ? (
                  <img src={r.image} alt="" className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-amber-100 flex items-center justify-center text-amber-800 font-semibold">Restaurant</div>
                )}
                {r.rating != null && (
                  <div className="absolute top-2 right-2 glass rounded-full px-3 py-1 shadow-lg">
                    <span className="text-xs font-bold">⭐ {Number(r.rating).toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="p-4 space-y-3 flex-1 flex flex-col">
                <div className="font-bold text-base text-gray-900 leading-tight">{r.name}</div>
                {r.address && <div className="text-xs text-gray-500">{r.address}</div>}
                <div className="flex flex-wrap gap-2 text-xs">
                  {r.distanceMiles != null && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">📍 {r.distanceMiles.toFixed(1)} mi</span>}
                  {r.menuStatus === 'unknown' && <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-medium">Menu loading</span>}
                  {r.menuStatus === 'unavailable' && <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">Menu not available online</span>}
                  {r.menuStatus === 'unavailable' && r.website && (
                    <a href={r.website} target="_blank" rel="noreferrer" className="px-2 py-1 text-amber-700 underline">Restaurant site</a>
                  )}
                  {r.menuStatus === 'ready' && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">Menu ready</span>}
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
                  {r.website ? (
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 px-3 py-2.5 text-sm font-bold text-center text-orange-700 bg-orange-50 rounded-xl"
                    >
                      Site
                    </a>
                  ) : (
                    <div className="flex-1 px-3 py-2.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-xl text-center flex items-center justify-center">
                      No website
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
