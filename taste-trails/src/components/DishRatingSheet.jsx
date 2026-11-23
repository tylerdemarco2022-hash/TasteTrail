import { useState } from 'react'

export default function DishRatingSheet({ dish, restaurant, area, onClose, onSaved }) {
  const [score, setScore] = useState(8)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function readPhoto(file) {
    if (!file) return
    const data = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(file)
    })
    if (typeof data === 'string' && data.length > 500000) {
      setError('That photo is too large. Try a smaller one.')
      return
    }
    setPhoto(data)
  }

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        setError('Log in to rate a dish.')
        return
      }
      const { API_BASE_URL } = await import('../config/api')
      const res = await fetch(`${API_BASE_URL}/api/dish-reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dish,
          restaurant,
          rating: Math.round(score * 10) / 10,
          note,
          photo,
          area
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not save that rating')
        return
      }
      onSaved?.(data)
    } catch {
      setError('Could not save that rating')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3">
      <div className="surface w-full max-w-md p-5 shadow-card" role="dialog" aria-label={`Rate ${dish}`}>
        <p className="text-sm text-[var(--mute)]">{restaurant}</p>
        <h3 className="font-display text-2xl">{dish}</h3>
        <p className="mt-4 text-center font-display text-7xl leading-none text-[var(--brand)]" aria-hidden="true">{Number(score).toFixed(1)}</p>
        <label className="sr-only" htmlFor="dish-score">Score out of 10</label>
        <input
          id="dish-score"
          type="range"
          min="1"
          max="10"
          step="0.1"
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          className="mt-3 w-full accent-[var(--brand)]"
        />
        <label className="sr-only" htmlFor="dish-note">Note</label>
        <input id="dish-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" className="field mt-4" />
        <label className="sr-only" htmlFor="dish-photo">Photo</label>
        <input id="dish-photo" type="file" accept="image/*" onChange={(event) => readPhoto(event.target.files?.[0])} className="mt-1 text-sm" />
        {photo && <img src={photo} alt="" className="mt-2 h-28 w-full rounded-2xl object-cover" />}
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-quiet flex-1">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="btn btn-primary flex-1 disabled:opacity-60">
            {busy ? 'Saving' : 'Save rating'}
          </button>
        </div>
      </div>
    </div>
  )
}
