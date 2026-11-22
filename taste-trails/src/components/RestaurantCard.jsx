import { formatPublishedPrice, priceLevelFromPrices } from '../services/menuPresentation'

function dollars(level) {
  if (!level) return null
  return '$'.repeat(level)
}

export default function RestaurantCard({ place, onOpen }) {
  const price = dollars(place.priceLevel || priceLevelFromPrices(place.prices || []))
  const meta = [place.cuisine, price, place.neighborhood].filter(Boolean).join(' · ')
  const rating = Number(place.communityScore ?? place.rating)
  const ratingCount = place.communityCount ?? place.ratingCount
  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button type="button" onClick={() => onOpen?.(place)} className="w-full text-left">
        <div className="flex gap-3 p-3">
          <div className="w-24 h-24 rounded-xl bg-amber-50 overflow-hidden shrink-0 flex items-center justify-center">
            {place.image ? (
              <img src={place.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-amber-800 px-2 text-center">No photo</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 text-base leading-tight">{place.name}</h3>
            {meta && <p className="text-sm text-gray-600 mt-1 truncate">{meta}</p>}
            <p className="text-sm text-gray-700 mt-1">
              {Number.isFinite(rating) && rating > 0 ? (
                <span>{rating.toFixed(1)}{ratingCount ? ` (${ratingCount})` : ''}</span>
              ) : (
                <span className="text-gray-500">No ratings yet</span>
              )}
              {place.distanceMiles != null && <span> · {Number(place.distanceMiles).toFixed(1)} mi</span>}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {place.menuStatus === 'unavailable' ? 'Menu not available online' : place.menuStatus === 'unknown' ? 'Menu loads when you open it' : 'Full menu'}
            </p>
          </div>
        </div>
      </button>
    </article>
  )
}

export function DishResult({ dish, onOpen }) {
  const price = dish.priceLabel || formatPublishedPrice(dish.price)
  const score = dish.community?.score
  return (
    <button
      type="button"
      onClick={() => onOpen?.(dish)}
      className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-3 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900">{dish.name}</div>
          <div className="text-sm text-gray-600 truncate">{dish.restaurant?.name || dish.restaurant}</div>
          <div className="text-sm text-amber-800 mt-1">{price || 'Price not listed'}</div>
        </div>
        <div className="text-right shrink-0">
          {score != null ? (
            <>
              <div className="text-lg font-bold text-gray-900">{Number(score).toFixed(1)}</div>
              <div className="text-xs text-gray-500">{dish.community.count} rating{dish.community.count === 1 ? '' : 's'}</div>
            </>
          ) : (
            <div className="text-xs text-gray-500 max-w-24">No ratings yet</div>
          )}
        </div>
      </div>
    </button>
  )
}
