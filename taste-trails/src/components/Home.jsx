import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config/api'
import RestaurantCard, { PlacePhoto } from './RestaurantCard'
import { pickFeatured } from '../services/featuredRestaurant'

const MARKETS = [
  { label: 'Charlotte', q: 'Charlotte, NC' },
  { label: 'Fort Mill', q: 'Fort Mill, SC' },
  { label: 'Greenwood', q: 'Greenwood, SC' }
]

export default function Home({ onOpen }) {
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scores, setScores] = useState([])
  const [restaurantScores, setRestaurantScores] = useState([])
  const [cuisine, setCuisine] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    fetch(`${API_BASE_URL}/api/food-scores`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.ok ? res.json() : { dishes: [] })
      .then((data) => {
        setScores(Array.isArray(data.dishes) ? data.dishes : [])
        setRestaurantScores(Array.isArray(data.restaurants) ? data.restaurants : [])
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
      setPlaces((data.restaurants || []).map((place) => {
        const url = place.photo?.url || null
        return {
          ...place,
          image: url ? (url.startsWith('/') ? `${API_BASE_URL}${url}` : url) : null,
          photoAttribution: place.photo?.source === 'google' || place.photo?.source === 'wikimedia' ? place.photo.attribution : null
        }
      }))
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
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }, [])

  const cuisines = [...new Set(places.map((place) => place.cuisine).filter(Boolean))]
  const visible = places.filter((place) => !cuisine || place.cuisine === cuisine)
  const nearbyNames = new Set(visible.map((place) => String(place.name || '').toLowerCase()))
  const dishHits = scores.filter((row) => !nearbyNames.size || nearbyNames.has(String(row.restaurant || '').toLowerCase())).slice(0, 5)
  const featured = pickFeatured(visible, restaurantScores)

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
      photoAttribution: place.photoAttribution,
      distanceMiles: place.distanceMiles
    })
  }

  return (
    <main className="screen space-y-8">
      <h1 className="font-display text-4xl leading-[1.05] text-[var(--ink)]">Discover food worth remembering.</h1>
      {featured && (
        <button type="button" onClick={() => openPlace(featured)} className="surface block w-full overflow-hidden text-left" aria-label={`Featured restaurant ${featured.name}`}>
          <PlacePhoto src={featured.image} attribution={featured.photoAttribution} className="h-56 w-full" />
          <div className="space-y-1 px-4 py-4">
            <h2 className="text-2xl font-semibold">{featured.name}</h2>
            <p className="text-sm text-[var(--mute)]">{[featured.cuisine, featured.distanceMiles != null ? `${Number(featured.distanceMiles).toFixed(1)} mi` : featured.neighborhood].filter(Boolean).join(' · ')}</p>
            {featured.foodScore != null && <p className="text-sm">{Number(featured.foodScore).toFixed(1)}</p>}
          </div>
        </button>
      )}
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (query.trim()) load(new URLSearchParams({ q: query, radius: '3' })) }}>
        <label className="sr-only" htmlFor="city-search">City or ZIP</label>
        <input id="city-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City or ZIP" className="field" />
        <button type="submit" className="btn btn-primary" aria-label="Search">Go</button>
      </form>
      <div className="flex gap-2 overflow-x-auto">
        {MARKETS.map((market) => (
          <button key={market.q} type="button" onClick={() => { setQuery(''); load(new URLSearchParams({ q: market.q, radius: '3' })) }} className="btn btn-quiet shrink-0">
            {market.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {cuisines.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => setCuisine('')} className={`btn shrink-0 ${cuisine ? 'btn-quiet' : 'btn-primary'}`}>All</button>
          {cuisines.map((item) => (
            <button key={item} type="button" onClick={() => setCuisine(item)} className={`btn shrink-0 ${cuisine === item ? 'btn-primary' : 'btn-quiet'}`}>{item}</button>
          ))}
        </div>
      )}
      {dishHits.length > 0 && (
        <div className="space-y-2">
          {dishHits.map((dish) => (
            <button key={dish.key} type="button" onClick={() => openPlace({ name: dish.restaurant, neighborhood: dish.area })} className="flex min-h-11 w-full items-center justify-between text-left">
              <span className="font-medium">{dish.dish}</span>
              <span>{Number(dish.score).toFixed(1)}</span>
            </button>
          ))}
        </div>
      )}
      {loading && <div className="space-y-6"><div className="skeleton h-64" /><div className="skeleton h-64" /></div>}
      {!loading && visible.length === 0 && !error && <p className="text-sm text-[var(--mute)]">No restaurants.</p>}
      <div className="space-y-6">
        {visible.map((place) => <RestaurantCard key={place.id || place.name} place={place} onOpen={openPlace} />)}
      </div>
    </main>
  )
}
