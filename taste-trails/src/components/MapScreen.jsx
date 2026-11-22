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
      <h1 className="sr-only">Map</h1>
      <p className="sr-only">{note}</p>
      <div>
        {loading ? <div className="skeleton h-80 w-full" /> : error ? <p className="text-sm text-red-700">{error}</p> : (
          <FoodMap places={places} onOpen={(place) => onOpen?.({ ...place, restaurant: place.name })} />
        )}
      </div>
    </div>
  )
}
