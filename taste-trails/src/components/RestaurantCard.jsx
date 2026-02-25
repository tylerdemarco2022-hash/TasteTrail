import React from 'react'
import { MapPin, Badge } from 'lucide-react'

/**
 * RestaurantCard Component
 * Displays a restaurant with cover photo, distance, cuisine, and badge
 */
export default function RestaurantCard({ restaurant }) {
  const {
    id,
    name,
    cuisine,
    distance,
    cover_photo_url,
    address,
    confidence,
    badge,
    trending_badge,
    trending_score,
    flagged_closed
  } = restaurant

  // Format distance nicely
  const distanceDisplay = distance ? `${distance.toFixed(1)} mi` : 'Unknown'

  // Badge color based on type
  const badgeColorClass = {
    'Verified': 'bg-green-100 text-green-800 border-green-300',
    'Strong Data': 'bg-blue-100 text-blue-800 border-blue-300',
    'New': 'bg-yellow-100 text-yellow-800 border-yellow-300'
  }[badge] || 'bg-gray-100 text-gray-800 border-gray-300'

  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow h-fit ${flagged_closed ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}>
      {/* Cover Photo */}
      <div className={`relative w-full h-48 bg-gray-200 overflow-hidden ${flagged_closed ? 'grayscale' : ''}`}>
        {cover_photo_url ? (
          <img
            src={cover_photo_url}
            alt={name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextElementSibling.style.display = 'flex'
            }}
          />
        ) : null}
        {!cover_photo_url && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-red-100">
            <span className="text-3xl">🍽️</span>
          </div>
        )}

        {/* Badge Overlay (stacked badges) */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          {/* Trending Badge (PHASE 11) */}
          {trending_badge && (
            <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
              🔥 {trending_badge}
            </div>
          )}
          
          {/* Confidence Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${badgeColorClass}`}>
            {badge}
          </div>
        </div>

        {/* Distance Badge */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-gray-800">
          📍 {distanceDisplay}
        </div>

        {/* Closure Warning (PHASE 12) */}
        {flagged_closed && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-xs font-semibold px-3 py-2 text-center">
            ⚠️ Reported Closed
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4">
        {/* Restaurant Name */}
        <h3 className="font-bold text-lg text-gray-900 mb-1 line-clamp-2 hover:text-orange-600">
          {name}
        </h3>

        {/* Cuisine Type */}
        {cuisine && (
          <p className="text-sm text-gray-600 mb-3">
            🍳 {cuisine}
          </p>
        )}

        {/* Address */}
        {address && (
          <div className="flex items-start gap-2 text-xs text-gray-600 mb-3">
            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">{address}</span>
          </div>
        )}

        {/* Stats Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500">
            Confidence: {confidence.toFixed(1)}/5 ⭐
          </span>
        </div>
      </div>
    </div>
  )
}
