import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config/api'
import FoodMap from './FoodMap'

export default function MapScreen({ onOpen }) {
  const [places, setPlaces] = useState([])
  const [note, setNote] = useState('Charlotte, NC')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE_URL}/api/nearby-restaurants?q=${encodeURIComponent('Charlotte, NC')}&radius=3`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Map is unavailable right now.')
        if (!cancelled) {
          setPlaces(data.restaurants || [])
          if (data.location?.label) setNote(data.location.label)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Map is unavailable right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="screen">
      <h1 className="font-display text-3xl text-[var(--ink)]">Around you</h1>
      <p className="mt-1 text-sm text-[var(--mute)]">{note}</p>
      <div className="mt-4">
        {loading ? <div className="skeleton h-80 w-full" /> : error ? <p className="text-sm text-red-700">{error}</p> : (
          <FoodMap places={places} onOpen={(place) => onOpen?.({ ...place, restaurant: place.name })} />
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--mute)]">Pins use the restaurants returned for this area. Tap one to open its menu.</p>
    </div>
  )
}
