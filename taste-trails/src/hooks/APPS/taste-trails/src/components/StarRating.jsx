import React from 'react'
import { Star } from 'lucide-react'

export default function StarRating({ value = 0 }) {
  // Scale to 10 stars, show half stars
  const scaledValue = value / 2 // Convert 10-point scale to 5 stars for display
  const full = Math.floor(scaledValue)
  const half = scaledValue - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)

  return (
    <div className="flex items-center space-x-1">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
      ))}
      {half && <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} className="w-4 h-4 text-gray-300" />
      ))}
      <span className="text-sm text-gray-600 ml-1">{value.toFixed(1)}</span>
    </div>
  )
}
