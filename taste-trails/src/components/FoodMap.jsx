export default function FoodMap({ places = [], onOpen }) {
  const pins = places.filter((place) => Number.isFinite(Number(place.lat ?? place.latitude)) && Number.isFinite(Number(place.lon ?? place.longitude)))
  if (!pins.length) {
    return <p className="text-sm text-[var(--mute)]">No restaurants with a location in this search.</p>
  }
  const lats = pins.map((place) => Number(place.lat ?? place.latitude))
  const lons = pins.map((place) => Number(place.lon ?? place.longitude))
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const latSpan = Math.max(maxLat - minLat, 0.012)
  const lonSpan = Math.max(maxLon - minLon, 0.012)
  const placed = []
  for (const place of pins) {
    const lat = Number(place.lat ?? place.latitude)
    const lon = Number(place.lon ?? place.longitude)
    let top = ((maxLat - lat) / latSpan) * 70 + 14
    let left = ((lon - minLon) / lonSpan) * 70 + 14
    let bump = 0
    while (placed.some((pin) => Math.abs(pin.top - top) < 10 && Math.abs(pin.left - left) < 18) && bump < 6) {
      bump += 1
      left = Math.min(86, left + 14)
      if (left > 80) {
        left = 16
        top = Math.min(84, top + 12)
      }
    }
    placed.push({ place, top, left })
  }
  return (
    <div className="space-y-3">
      <div className="surface relative h-80 overflow-hidden bg-[#efe6da]" role="group" aria-label="Restaurants near you">
        <div className="absolute inset-6 rounded-full border border-[#e7d3c0]" />
        <div className="absolute inset-16 rounded-full border border-[#e7d3c0]" />
        {placed.map(({ place, top, left }, index) => (
          <button
            key={place.id || place.name}
            type="button"
            onClick={() => onOpen?.(place)}
            className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-semibold text-white shadow-card"
            style={{ top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)' }}
            aria-label={`Open ${place.name}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {pins.slice(0, 8).map((place) => (
          <li key={`list-${place.id || place.name}`}>
            <button type="button" onClick={() => onOpen?.(place)} className="surface flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-semibold">
              <span>{pins.indexOf(place) + 1}. {place.name}</span>
              <span className="font-normal text-[var(--mute)]">{place.distanceMiles != null ? `${Number(place.distanceMiles).toFixed(1)} mi` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
