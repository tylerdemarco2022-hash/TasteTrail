import React, { useState, useEffect } from 'react'
import { MapPin, Loader, AlertCircle } from 'lucide-react'
import RestaurantCard from './RestaurantCard'
import { API_BASE_URL } from '../config/api'

/**
 * RestaurantFinder Component
 * Location-aware restaurant discovery from database with cover photos
 */
export default function RestaurantFinder() {
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [radius, setRadius] = useState(5)
  const [loading, setLoading] = useState(false)
  const [restaurants, setRestaurants] = useState(null)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [sortBy, setSortBy] = useState('distance') // PHASE 13: Sort toggle

  // PHASE 18: Load sort preference from localStorage on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setLat(latitude)
          setLng(longitude)
          setUserLocation({ lat: latitude, lng: longitude })
        },
        () => {
          // Fallback to Charlotte, NC if geolocation fails
          setLat(35.2271)
          setLng(-80.8431)
          setError('Using Charlotte, NC as default (geolocation access denied)')
        }
      )
    }

    // PHASE 18: Restore sort preference from localStorage
    const savedSort = localStorage.getItem('restaurantFinder_sortBy');
    if (savedSort) {
      setSortBy(savedSort);
    }
  }, [])

  // PHASE 18: Persist sort preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('restaurantFinder_sortBy', sortBy);
  }, [sortBy])

  const handleSearch = async () => {
    if (!lat || !lng) {
      setError('Location not available')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const url = `${API_BASE_URL}/api/restaurants?lat=${lat}&lng=${lng}&radius=${radius}&sort=${sortBy}`
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setRestaurants(data)
      } else {
        setError(data.error || 'Search failed')
      }
    } catch (err) {
      setError(err.message)
      setRestaurants(null)
    } finally {
      setLoading(false)
    }
  }

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setLat(latitude)
          setLng(longitude)
          setUserLocation({ lat: latitude, lng: longitude })
          setError(null)
        },
        () => {
          setError('Could not access your location')
        }
      )
    } else {
      setError('Geolocation not supported by your browser')
    }
  }

  // PHASE 18: Handle Enter key to trigger search (instead of clicking button)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && lat && lng && !loading) {
      handleSearch()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-2">
            🍽️ Taste Trails
          </h1>
          <p className="text-xl text-gray-700 mb-4">
            Discover nearby restaurants
          </p>
          <p className="text-sm text-gray-600">
            No APIs • Community-driven • Real locations
          </p>
        </div>

        {/* Search Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lat || ''}
                onChange={(e) => setLat(parseFloat(e.target.value) || null)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="35.2271"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lng || ''}
                onChange={(e) => setLng(parseFloat(e.target.value) || null)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="-80.8431"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Radius (miles)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value) || 5)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={loading || !lat || !lng}
                className="w-full px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <MapPin className="h-5 w-5" />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PHASE 13: Sort Toggle */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              onClick={() => setSortBy('distance')}
              className={`px-4 py-2 font-semibold rounded-lg transition-all ${
                sortBy === 'distance'
                  ? 'bg-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              📍 By Distance
            </button>
            <button
              onClick={() => setSortBy('trending')}
              className={`px-4 py-2 font-semibold rounded-lg transition-all ${
                sortBy === 'trending'
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              🔥 By Trending
            </button>
          </div>

          <button
            onClick={handleUseCurrentLocation}
            className="w-full px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-colors"
          >
            📍 Use My Current Location
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {restaurants && (
          <div>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm font-semibold text-gray-600">Found</div>
                <div className="text-4xl font-bold text-orange-600 mt-2">
                  {restaurants.count}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm font-semibold text-gray-600">Radius</div>
                <div className="text-4xl font-bold text-blue-600 mt-2">
                  {restaurants.radiusMiles} mi
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm font-semibold text-gray-600">Closest</div>
                <div className="text-4xl font-bold text-green-600 mt-2">
                  {restaurants.restaurants && restaurants.restaurants.length > 0
                    ? `${restaurants.restaurants[0].distance.toFixed(2)} mi`
                    : '—'
                  }
                </div>
              </div>
              {/* PHASE 13: Show current sort mode */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm font-semibold text-gray-600">Sort</div>
                <div className="text-lg font-bold text-purple-600 mt-2">
                  {restaurants.sortBy === 'trending' ? '🔥 Trending' : '📍 Distance'}
                </div>
              </div>
            </div>

            {/* Restaurant Grid */}
            {restaurants.count > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {restaurants.restaurants.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <p className="text-2xl text-gray-500">
                  No restaurants found within {radius} miles
                </p>
                <p className="text-gray-400 mt-2">
                  Try increasing the search radius or moving to a different location
                </p>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 mb-3">✨ About Taste Trails</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>✓ Powered by community-driven OpenStreetMap data</li>
            <li>✓ No external APIs required</li>
            <li>✓ Confidence scoring based on data completeness</li>
            <li>✓ Browse restaurants by distance</li>
            <li>✓ Support the local food community</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
