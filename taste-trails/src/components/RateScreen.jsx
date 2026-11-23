import { useState } from 'react'
import { API_BASE_URL } from '../config/api'
import DishRatingSheet from './DishRatingSheet'
import { formatPublishedPrice } from '../services/menuPresentation'

export default function RateScreen() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null)
  const [saved, setSaved] = useState('')

  async function search(event) {
    event?.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setSaved('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/find-menu-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, limit: 8 })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setItems(Array.isArray(data.items) ? data.items : [])
      if (!data.items?.length) setError('Nothing found.')
    } catch (err) {
      setItems([])
      setError(err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen">
      <h1 className="font-display text-4xl text-[var(--ink)]">What did you eat?</h1>
      <form className="mt-4 flex gap-2" onSubmit={search}>
        <label className="sr-only" htmlFor="rate-query">Dish</label>
        <input id="rate-query" className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Steak, ramen, salad" />
        <button className="btn btn-primary" type="submit">Find</button>
      </form>
      {loading && <div className="mt-4 space-y-2"><div className="skeleton h-16" /><div className="skeleton h-16" /></div>}
      {error && <p className="mt-3 text-sm text-[var(--mute)]">{error}</p>}
      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const restaurant = item.restaurant?.name || item.restaurant
          return (
            <button
              key={`${restaurant}-${item.name}`}
              type="button"
              onClick={() => setPicked({ dish: item.name, restaurant })}
              className="surface flex min-h-16 w-full items-center justify-between px-4 py-3 text-left"
            >
              <span>
                <span className="block font-semibold">{item.name}</span>
                <span className="text-sm text-[var(--mute)]">{restaurant}</span>
              </span>
              <span className="text-sm font-semibold">{item.priceLabel || formatPublishedPrice(item.price) || 'Price not listed'}</span>
            </button>
          )
        })}
      </div>
      {saved && <p className="mt-4 text-sm font-medium text-[var(--brand-deep)]">{saved}</p>}
      {picked && (
        <DishRatingSheet
          dish={picked.dish}
          restaurant={picked.restaurant}
          area="Charlotte"
          onClose={() => setPicked(null)}
          onSaved={(data) => {
            setPicked(null)
            setSaved('Saved')
          }}
        />
      )}
    </div>
  )
}
