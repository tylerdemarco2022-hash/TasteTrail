import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config/api'
import RestaurantCard from './RestaurantCard'
import FoodMap from './FoodMap'

const MARKETS = [
  { label: 'Charlotte, NC', q: 'Charlotte, NC' },
  { label: 'Fort Mill, SC', q: 'Fort Mill, SC' },
  { label: 'Greenwood, SC', q: 'Greenwood, SC' }
]

const PILLARS = [
  { title: 'Discover dishes', text: 'Meals people actually recommend.' },
  { title: 'Explore restaurants', text: 'Sit-down dining nearby.' },
  { title: 'Share experiences', text: 'Post a photo and rate the dish.' },
  { title: 'Remember favorites', text: 'Save restaurants and meals.' }
]

export default function Home({ onOpen }) {
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('Charlotte, Fort Mill, and Greenwood are ready. Share your location or pick a city.')
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scores, setScores] = useState([])
  const [areas, setAreas] = useState([])
  const [showMap, setShowMap] = useState(false)
  const [cuisine, setCuisine] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    fetch(`${API_BASE_URL}/api/food-scores`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.ok ? res.json() : { dishes: [] })
      .then((data) => {
        setScores(Array.isArray(data.dishes) ? data.dishes : [])
        setAreas(Array.isArray(data.areas) ? data.areas : [])
      })
      .catch(() => setScores([]))
  }, [])

  async function load(params) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/nearby-restaurants?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Nearby restaurants are unavailable right now.')
      setPlaces((data.restaurants || []).map((place) => ({
        ...place,
        image: place.photoName ? `${API_BASE_URL}/api/place-photo?name=${encodeURIComponent(place.photoName)}` : null
      })))
      if (data.location?.label) setNote(data.location.label)
    } catch (err) {
      setPlaces([])
      setError(err.message || 'Nearby restaurants are unavailable right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => load(new URLSearchParams({ lat: String(pos.coords.latitude), lon: String(pos.coords.longitude), radius: '3' })),
      () => setNote('Location permission was denied. Pick Charlotte, Fort Mill, or Greenwood, or type a city or ZIP.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }, [])

  const cuisines = [...new Set(places.map((place) => place.cuisine).filter(Boolean))]
  const visible = places.filter((place) => !cuisine || place.cuisine === cuisine)
  const nearbyNames = new Set(visible.map((place) => String(place.name || '').toLowerCase()))
  const dishHits = scores.filter((row) => !nearbyNames.size || nearbyNames.has(String(row.restaurant || '').toLowerCase())).slice(0, 5)

  function openPlace(place) {
    onOpen?.({
      restaurant: place.name,
      name: place.name,
      address: place.address,
      location: place.address,
      lat: place.lat,
      lon: place.lon,
      website: place.website,
      menuUrl: place.menuUrl,
      hours: place.hours,
      cuisine: place.cuisine,
      phone: place.phone,
      neighborhood: place.neighborhood,
      rating: place.rating,
      ratingCount: place.ratingCount,
      image: place.image,
      distanceMiles: place.distanceMiles
    })
  }

  return (
    <main className="max-w-3xl mx-auto px-4 pt-4 pb-28 space-y-4">
      <header>
        <p className="text-sm font-semibold text-amber-700">TasteTrails</p>
        <h1 className="text-2xl font-bold text-gray-900">Discover Food Worth Remembering.</h1>
        <p className="text-sm text-gray-600 mt-1">What should I eat, where should I go, and what’s actually worth ordering?</p>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {PILLARS.map((pillar) => (
          <div key={pillar.title} className="bg-white rounded-2xl border border-gray-200 p-3">
            <h2 className="text-sm font-semibold text-gray-900">{pillar.title}</h2>
            <p className="text-xs text-gray-600 mt-1">{pillar.text}</p>
          </div>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); load(new URLSearchParams({ q: query, radius: '3' })) }}>
        <label className="sr-only" htmlFor="city-search">City or ZIP</label>
        <input id="city-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City or ZIP" className="flex-1 min-h-11 px-3 border border-gray-300 rounded-xl" />
        <button type="submit" className="min-h-11 px-4 rounded-xl bg-amber-500 text-white font-semibold">Search</button>
      </form>
      <div className="flex gap-2 overflow-x-auto">
        {MARKETS.map((market) => (
          <button key={market.q} type="button" onClick={() => { setQuery(market.q); load(new URLSearchParams({ q: market.q, radius: '3' })) }} className="shrink-0 min-h-11 px-3 rounded-full bg-white border border-gray-300 text-sm font-semibold">
            {market.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-600">{note}</p>
      {error && <p className="text-sm text-red-700 bg-white border border-red-100 rounded-xl p-3">{error}</p>}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Nearby restaurants</h2>
        <button type="button" onClick={() => setShowMap((value) => !value)} className="min-h-11 px-3 text-sm font-semibold text-amber-800">{showMap ? 'Hide map' : 'Map'}</button>
      </div>
      {showMap && <FoodMap places={visible} onOpen={openPlace} />}
      {cuisines.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => setCuisine('')} className="min-h-11 px-3 rounded-full bg-white border text-sm font-semibold">All cuisines</button>
          {cuisines.map((item) => (
            <button key={item} type="button" onClick={() => setCuisine(item)} className={`min-h-11 px-3 rounded-full border text-sm font-semibold ${cuisine === item ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-300'}`}>{item}</button>
          ))}
        </div>
      )}
      <section className="bg-white rounded-2xl border border-gray-200 p-4">
        <h2 className="font-semibold">Worth ordering</h2>
        {dishHits.length === 0 ? (
          <p className="text-sm text-gray-600 mt-1">No dish ratings here yet. Open a menu and be the first to score a meal.</p>
        ) : dishHits.map((dish) => (
          <button key={dish.key} type="button" onClick={() => openPlace({ name: dish.restaurant, neighborhood: dish.area })} className="w-full text-left mt-2 min-h-11">
            <span className="font-medium">{dish.dish}</span>
            <span className="text-sm text-gray-600"> at {dish.restaurant} · {Number(dish.score).toFixed(1)} from {dish.count}</span>
          </button>
        ))}
      </section>
      {areas.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <h2 className="font-semibold">Food score by area</h2>
          <p className="text-xs text-gray-500">Adjusted so a single rating does not outrank a neighborhood with more reviews.</p>
          {areas.map((area) => (
            <p key={area.key} className="text-sm mt-2">{area.area} · {Number(area.score).toFixed(1)} from {area.count} ratings</p>
          ))}
        </section>
      )}
      {loading && <p className="text-sm text-gray-600">Finding restaurants…</p>}
      {!loading && visible.length === 0 && !error && <p className="text-sm text-gray-600">No restaurants in this search yet.</p>}
      <div className="space-y-3">
        {visible.map((place) => <RestaurantCard key={place.id || place.name} place={place} onOpen={openPlace} />)}
      </div>
    </main>
  )
}
