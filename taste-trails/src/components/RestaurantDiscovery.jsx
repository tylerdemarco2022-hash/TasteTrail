import React, { useState } from 'react'
import { MapPin, Loader, CheckCircle, AlertCircle } from 'lucide-react'
import { API_BASE_URL } from '../config/api'

export default function RestaurantDiscovory() {
  const [loading, setLoading] = useState(false)
  const [discovered, setDiscovered] = useState(null)
  const [error, setError] = useState(null)
  const [radiusKm, setRadiusKm] = useState(10)

  const handleUseCurrentLocation = async () => {
    setLoading(true)
    setError(null)

    try {
      if (!navigator.geolocation) {
        setError('Geolocation not supported by your browser')
        setLoading(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          await triggerDiscovery(latitude, longitude)
        },
        (err) => {
          setError(`Location access denied: ${err.message}`)
          setLoading(false)
        }
      )
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const triggerDiscovery = async (latitude, longitude) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/discover-restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, radiusKm }),
        credentials: 'include'
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()

      if (data.success) {
        setDiscovered(data.data)
      } else {
        setError(data.error || 'Discovery failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTestDiscovery = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/discover-restaurants/test`, {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()

      if (data.success) {
        setDiscovered(data.data)
      } else {
        setError(data.error || 'Discovery failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🔍 Restaurant Discovery Agent
          </h1>
          <p className="text-lg text-gray-600">
            Automatically find and add nearby restaurants to your database
          </p>
        </div>

        {/* Discovery Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="space-y-6">
            {/* Radius Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search Radius
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xl font-bold text-orange-600 min-w-fit">
                  {radiusKm}km
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleUseCurrentLocation}
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Discovering...
                  </>
                ) : (
                  <>
                    <MapPin className="h-5 w-5" />
                    Use My Current Location
                  </>
                )}
              </button>

              <button
                onClick={handleTestDiscovery}
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Discovering...' : '🧪 Test (Charlotte, NC)'}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {discovered && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
                <div className="text-sm font-semibold opacity-90">Newly Discovered</div>
                <div className="text-3xl font-bold">{discovered.discovered}</div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
                <div className="text-sm font-semibold opacity-90">Total Database</div>
                <div className="text-3xl font-bold">{discovered.total}</div>
              </div>
            </div>

            {/* Success Message */}
            {discovered.discovered > 0 && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded flex gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900">Discovery Successful!</h3>
                  <p className="text-green-700">
                    Found and added {discovered.discovered} new restaurants to the database.
                  </p>
                </div>
              </div>
            )}

            {/* New Restaurants List */}
            {discovered.newRestaurants && discovered.newRestaurants.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <h3 className="font-bold text-gray-900">
                    ✨ New Restaurants ({discovered.newRestaurants.length})
                  </h3>
                </div>
                <div className="divide-y max-h-96 overflow-y-auto">
                  {discovered.newRestaurants.slice(0, 20).map((rest, idx) => (
                    <div key={idx} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-900">{rest.name}</h4>
                        {rest.distance && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                            {rest.distance.toFixed(1)}km away
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>📂 {rest.cuisine}</p>
                        {rest.address && <p>📍 {rest.address}</p>}
                        {rest.phone && <p>📞 {rest.phone}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-8">
          <h3 className="font-bold text-blue-900 mb-2">ℹ️ How It Works</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>✓ Uses OpenStreetMap data (free, no API key needed)</li>
            <li>✓ Automatically finds nearby restaurants within your search radius</li>
            <li>✓ Adds new restaurants to your database with photos</li>
            <li>✓ Avoids duplicates by checking existing names</li>
            <li>✓ Sorts by distance from your location</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
