export default function FoodMap({ places = [], onOpen }) {
  const pins = places.filter((place) => Number.isFinite(Number(place.lat ?? place.latitude)) && Number.isFinite(Number(place.lon ?? place.longitude)))
  if (!pins.length) {
    return <p className="text-sm text-gray-500">Share a location to see restaurants on the map.</p>
  }
  const lats = pins.map((place) => Number(place.lat ?? place.latitude))
  const lons = pins.map((place) => Number(place.lon ?? place.longitude))
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const latSpan = Math.max(maxLat - minLat, 0.01)
  const lonSpan = Math.max(maxLon - minLon, 0.01)
  return (
    <div className="relative h-64 rounded-2xl bg-amber-50 border border-amber-100 overflow-hidden" role="group" aria-label="Restaurants near you">
      {pins.map((place) => {
        const lat = Number(place.lat ?? place.latitude)
        const lon = Number(place.lon ?? place.longitude)
        const top = ((maxLat - lat) / latSpan) * 80 + 8
        const left = ((lon - minLon) / lonSpan) * 80 + 8
        return (
          <button
            key={place.id || place.name}
            type="button"
            onClick={() => onOpen?.(place)}
            className="absolute min-h-11 min-w-11 px-2 py-1 rounded-full bg-white border border-amber-400 text-xs font-semibold text-gray-900 shadow"
            style={{ top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)' }}
            aria-label={`Open ${place.name}`}
          >
            {place.name.split(' ')[0]}
          </button>
        )
      })}
    </div>
  )
}
