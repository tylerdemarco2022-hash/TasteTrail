import React, { useState, useEffect } from 'react'

export default function Reviews({ restaurantId, restaurantName }) {
  const [data, setData] = useState({ reviews: [], aggregates: [] })
  const [dish, setDish] = useState('')
  const [rating, setRating] = useState(8)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!restaurantId) return
    fetchReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  async function fetchReviews() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reviews?restaurant_id=${encodeURIComponent(restaurantId)}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  async function submit() {
    if (!dish || !rating) return
    const user_id = localStorage.getItem('tt_user') || (() => { const u = 'u_' + Math.random().toString(36).slice(2); localStorage.setItem('tt_user', u); return u })()
    const payload = { user_id, restaurant_id: restaurantId, dish, rating, comment }
    try {
      const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('submit failed')
      setDish('')
      setRating(5)
      setComment('')
      fetchReviews()
    } catch (e) { console.error(e) }
  }

  return (
    <div className="mt-4">
      <h3 className="font-semibold">Dish Reviews</h3>
      {loading && <div className="text-sm text-gray-500">Loading reviews…</div>}

      {data.aggregates && data.aggregates.length > 0 && (
        <div className="grid gap-2 mt-2">
          {data.aggregates.map((a) => (
            <div key={a.dish || Math.random()} className="bg-white p-2 rounded shadow-sm flex justify-between items-center">
              <div>
                <div className="font-medium">{a.dish}</div>
                <div className="text-xs text-gray-500">{a.total_reviews} reviews · avg {Number(a.avg_rating).toFixed(2)}</div>
              </div>
              <div className="text-yellow-500 font-semibold">{Number(a.avg_rating).toFixed(1)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 bg-white p-3 rounded shadow">
        <div className="mb-2 text-sm text-gray-600">Add a dish review for {restaurantName}</div>
        <input placeholder="Dish name" value={dish} onChange={(e)=>setDish(e.target.value)} className="w-full p-2 border rounded mb-2" />
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm">Rating (1-10)</label>
          <input type="range" min="1" max="10" step="0.1" value={rating} onChange={(e)=>setRating(Number(e.target.value))} className="flex-1" />
          <div className="font-semibold w-8">{rating.toFixed(1)}</div>
        </div>
        <textarea placeholder="Comment (optional)" value={comment} onChange={(e)=>setComment(e.target.value)} className="w-full p-2 border rounded mb-2" />
        <div className="flex justify-end">
          <button onClick={submit} className="px-3 py-2 bg-amber-600 text-white rounded">Submit Review</button>
        </div>
      </div>
    </div>
  )
}
