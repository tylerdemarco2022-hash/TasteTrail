import { priceLevelFromPrices } from '../services/menuPresentation'

function dollars(level) {
  return level ? '$'.repeat(level) : null
}

export default function RestaurantCard({ place, onOpen }) {
  const price = dollars(place.priceLevel || priceLevelFromPrices(place.prices || []))
  const meta = [place.cuisine, price, place.neighborhood].filter(Boolean).join(' · ')
  const rating = Number(place.communityScore ?? place.rating)
  const ratingCount = place.communityCount ?? place.ratingCount
  return (
    <article className="surface overflow-hidden">
      <button type="button" onClick={() => onOpen?.(place)} className="block w-full text-left">
        <div className="plate h-40 w-full" aria-hidden="true" />
        <div className="space-y-1 px-4 py-3">
          <h3 className="text-lg font-semibold text-[var(--ink)]">{place.name}</h3>
          {meta && <p className="text-sm text-[var(--mute)]">{meta}</p>}
          <p className="text-sm text-[var(--ink)]">
            {Number.isFinite(rating) && rating > 0 ? `${rating.toFixed(1)}${ratingCount ? ` · ${ratingCount}` : ''}` : 'No ratings yet'}
            {place.distanceMiles != null ? ` · ${Number(place.distanceMiles).toFixed(1)} mi` : ''}
          </p>
          <p className="text-xs text-[var(--mute)]">
            {place.menuStatus === 'unavailable' ? 'Menu not available online' : 'Full menu'}
          </p>
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
          <>
            <span className="block text-lg font-semibold">{Number(score).toFixed(1)}</span>
            <span className="text-xs text-[var(--mute)]">{dish.community.count} ratings</span>
          </>
        ) : (
          <span className="text-xs text-[var(--mute)]">No ratings yet</span>
        )}
      </span>
    </button>
  )
}
