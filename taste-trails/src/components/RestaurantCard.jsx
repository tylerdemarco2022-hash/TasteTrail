import { useState } from 'react'
import { priceLevelFromPrices } from '../services/menuPresentation'

export function PlacePhoto({ src, attribution, className = '' }) {
  const [failed, setFailed] = useState(false)
  const show = Boolean(src) && !failed
  return (
    <div className={`relative overflow-hidden ${className} ${show ? '' : 'plate'}`}>
      {show ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} /> : null}
      {show && attribution ? <p className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-[10px] text-white">{attribution}</p> : null}
    </div>
  )
}

function dollars(level) {
  return level ? '$'.repeat(level) : null
}

export default function RestaurantCard({ place, onOpen }) {
  const price = dollars(place.priceLevel || priceLevelFromPrices(place.prices || []))
  const distance = place.distanceMiles != null ? `${Number(place.distanceMiles).toFixed(1)} mi` : null
  const meta = [place.cuisine, price, distance || place.neighborhood].filter(Boolean).join(' · ')
  const rating = Number(place.communityScore ?? place.rating)
  const hasRating = Number.isFinite(rating) && rating > 0
  return (
    <article className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen?.(place)}
        className="block w-full text-left"
        aria-label={`${place.name}${meta ? `, ${meta}` : ''}${hasRating ? `, ${rating.toFixed(1)}` : ', no rating'}${place.menuStatus === 'unavailable' ? ', menu not available online' : ''}`}
      >
        <PlacePhoto src={place.image} attribution={place.photoAttribution} className="h-44 w-full" />
        <div className="space-y-1 px-4 py-4">
          <h3 className="text-lg font-semibold text-[var(--ink)]">{place.name}</h3>
          {meta && <p className="truncate text-sm text-[var(--mute)]">{meta}</p>}
          {hasRating && <p className="text-sm">{rating.toFixed(1)}</p>}
        </div>
      </button>
    </article>
  )
}

export function DishResult({ dish, onOpen }) {
  const score = dish.community?.score
  return (
    <button type="button" onClick={() => onOpen?.(dish)} className="surface flex min-h-16 w-full items-center justify-between px-4 py-3 text-left">
      <span className="min-w-0">
        <span className="block truncate font-semibold">{dish.name}</span>
        <span className="block truncate text-sm text-[var(--mute)]">{dish.restaurant?.name || dish.restaurant}</span>
      </span>
      <span className="shrink-0 text-right">
        {score != null ? (
          <span className="text-lg font-semibold" aria-label={`${Number(score).toFixed(1)} from ${dish.community.count} ratings`}>{Number(score).toFixed(1)}</span>
        ) : (
          <span className="sr-only">No rating</span>
        )}
      </span>
    </button>
  )
}
