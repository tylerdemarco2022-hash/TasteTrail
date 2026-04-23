import { useState } from 'react'

export default function RestaurantDiscoveryTest() {
  const [lat, setLat] = useState('35.2271')
  const [lng, setLng] = useState('-80.8431')
  const [radius, setRadius] = useState('1000')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleDiscover = async () => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('http://localhost:8081/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radius: parseInt(radius)
        })
      })

      if (!response.ok) throw new Error(`Failed: ${response.status}`)

      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(4))
          setLng(position.coords.longitude.toFixed(4))
        },
        (err) => setError(`Location error: ${err.message}`)
      )
    } else {
      setError('Geolocation not supported')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          🍽️ Restaurant Discovery
        </h1>
        <p className="text-gray-600 mb-8">
          Powered by OpenStreetMap Overpass API (Free, No API Key)
        </p>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="35.2271"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="-80.8431"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Radius (meters)
              </label>
              <input
                type="number"
                step="100"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1000"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDiscover}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '🔍 Searching...' : '🔍 Discover Restaurants'}
            </button>

            <button
              onClick={useCurrentLocation}
              className="bg-green-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-green-700 transition-colors"
            >
              📍 Use My Location
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            ❌ {error}
          </div>
        )}

        {results && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              ✅ Found {results.length} Restaurants
            </h2>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {results.map((restaurant, idx) => (
                <div
                  key={restaurant.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-800">
                        {idx + 1}. {restaurant.name}
                      </h3>
                      {restaurant.cuisine && (
                        <p className="text-sm text-gray-600">
                          🍳 {restaurant.cuisine}
                        </p>
                      )}
                      {restaurant.address && (
                        <p className="text-sm text-gray-500">
                          📍 {restaurant.address}
                          {restaurant.city ? `, ${restaurant.city}` : ''}
                        </p>
                      )}
                      {restaurant.phone && (
                        <p className="text-sm text-gray-500">
                          📞 {restaurant.phone}
                        </p>
                      )}
                      {restaurant.website && (
                        <a
                          href={restaurant.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          🌐 Website
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      ID: {restaurant.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
