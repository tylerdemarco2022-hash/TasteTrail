import { DIETARY_FILTERS } from '../services/restaurantMeta'

const PRICE_OPTIONS = [
  { value: '', label: 'Any price' },
  { value: 'level:1', label: '$' },
  { value: 'level:2', label: '$$ or less' },
  { value: 'level:3', label: '$$$ or less' },
  { value: '15', label: 'Under $15' },
  { value: '30', label: 'Under $30' }
]

const DISTANCE_OPTIONS = [
  { value: '', label: 'Any distance' },
  { value: '2', label: 'Within 2 mi' },
  { value: '5', label: 'Within 5 mi' },
  { value: '10', label: 'Within 10 mi' },
  { value: '25', label: 'Within 25 mi' }
]

export function priceSelection({ maxPrice, maxPriceLevel }) {
  if (maxPrice != null) return String(maxPrice)
  if (maxPriceLevel != null) return `level:${maxPriceLevel}`
  return ''
}

export default function MenuFinderControls({
  dietary = [],
  onToggleDietary,
  maxPrice = null,
  maxPriceLevel = null,
  onPriceChange,
  maxDistanceMiles = null,
  onDistanceChange,
  showDistance = true,
  showPrice = true,
  onUseLocation,
  locating = false,
  locationNote = ''
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {DIETARY_FILTERS.map((option) => {
          const active = dietary.includes(option.key)
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onToggleDietary?.(option.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                active
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {showPrice && (
          <select
            aria-label="Price"
            value={priceSelection({ maxPrice, maxPriceLevel })}
            onChange={(event) => {
              const value = event.target.value
              if (!value) onPriceChange?.({ maxPrice: null, maxPriceLevel: null })
              else if (value.startsWith('level:')) onPriceChange?.({ maxPrice: null, maxPriceLevel: Number(value.slice(6)) })
              else onPriceChange?.({ maxPrice: Number(value), maxPriceLevel: null })
            }}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
          >
            {PRICE_OPTIONS.map((option) => (
              <option key={option.value || 'any'} value={option.value}>{option.label}</option>
            ))}
          </select>
        )}
        {showDistance && (
          <select
            aria-label="Distance"
            value={maxDistanceMiles == null ? '' : String(maxDistanceMiles)}
            onChange={(event) => onDistanceChange?.(event.target.value ? Number(event.target.value) : null)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
          >
            {DISTANCE_OPTIONS.map((option) => (
              <option key={option.value || 'any'} value={option.value}>{option.label}</option>
            ))}
          </select>
        )}
        {onUseLocation && (
          <button
            type="button"
            onClick={onUseLocation}
            className="px-2.5 py-1.5 text-sm font-semibold rounded-lg border border-gray-200 bg-white hover:bg-amber-50"
          >
            {locating ? 'Finding you…' : 'Use my location'}
          </button>
        )}
      </div>
      {locationNote && <p className="text-xs text-gray-500">{locationNote}</p>}
      <p className="text-xs text-amber-800">
        Dietary matches are estimated from menu wording and can miss unlisted ingredients. Confirm with the restaurant.
      </p>
    </div>
  )
}
