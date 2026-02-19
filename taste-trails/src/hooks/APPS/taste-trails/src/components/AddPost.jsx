import React, { useState } from 'react'
import StarRating from './StarRating'
import { restaurants as allRestaurants } from '../data'

export default function AddPost({ initialRestaurant = null, initialGroupId = '', onCancel, onSubmit }) {
  const [step, setStep] = useState(1)
  const [imageSrc, setImageSrc] = useState(null)
  const [file, setFile] = useState(null)
  const [restaurant, setRestaurant] = useState(initialRestaurant ? initialRestaurant.name || initialRestaurant.restaurant || initialRestaurant : '')
  const [dish, setDish] = useState('')
  const [caption, setCaption] = useState('')
  const [rating, setRating] = useState(8)
  const [groupId, setGroupId] = useState(initialGroupId || '')
  const [groups, setGroups] = useState([])
  const CURRENT_USER = 'You'

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => setImageSrc(ev.target.result)
    reader.readAsDataURL(f)
  }

  function goNext() {
    if (!imageSrc) return
    setStep(2)
  }

  function goBackToPhoto() {
    setStep(1)
  }

  function submit() {
    if (!dish || !restaurant) return
    const post = {
      id: Date.now(),
      user: { name: 'You', avatar: 'https://i.pravatar.cc/64?img=1' },
      restaurant: restaurant,
      dish,
      image: imageSrc || '',
      caption,
      rating,
      comments: 0,
      menu: [],
      groupId: groupId || null,
      groupName: groups.find((g) => String(g.id) === String(groupId))?.name || null
    }
    onSubmit(post)
  }

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('taste-trails-groups')
      if (!raw) return
      const g = JSON.parse(raw)
      const mine = (g || []).filter(grp => (grp.members || []).includes(CURRENT_USER))
      setGroups(mine)
    } catch (e) {}
  }, [])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg p-4 w-full max-w-md">
        {step === 1 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Take a Photo</h3>
            <div className="mb-2 border rounded p-4 flex flex-col items-center justify-center">
              {imageSrc ? (
                <img src={imageSrc} className="w-full h-64 object-cover rounded" alt="preview" />
              ) : (
                <div className="text-gray-500">No photo yet. Use the button below to take or choose a photo.</div>
              )}
              <input className="mt-3" type="file" accept="image/*" capture="environment" onChange={handleFile} />
            </div>
            <div className="flex justify-end space-x-2 mt-3">
              <button onClick={onCancel} className="px-3 py-2 bg-gray-100 rounded">Cancel</button>
              <button onClick={goNext} disabled={!imageSrc} className="px-3 py-2 bg-yellow-500 text-white rounded">Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Describe your Food</h3>
            <div className="mb-2">
              <label className="block text-sm text-gray-600">Restaurant</label>
              <select value={restaurant} onChange={(e) => setRestaurant(e.target.value)} className="w-full border p-2 rounded">
                <option value="">Select restaurant</option>
                {allRestaurants.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-sm text-gray-600">Group (optional)</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full border p-2 rounded">
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-sm text-gray-600">Dish</label>
              <input value={dish} onChange={(e) => setDish(e.target.value)} className="w-full border p-2 rounded" />
            </div>

            <div className="mb-2">
              <label className="block text-sm text-gray-600">Rating (1-10)</label>
              <div className="flex items-center space-x-2">
                <StarRating value={rating} />
                <input type="range" min="1" max="10" step="0.1" value={rating} onChange={(e) => setRating(Number(e.target.value))} className="flex-1" />
                <span className="text-sm font-semibold w-8">{rating.toFixed(1)}</span>
              </div>
            </div>

            <div className="mb-2">
              <label className="block text-sm text-gray-600">Caption</label>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full border p-2 rounded" />
            </div>

            <div className="flex justify-between items-center mt-3">
              <button onClick={goBackToPhoto} className="px-3 py-2 bg-white rounded shadow">Back</button>
              <div className="flex items-center gap-2">
                <button onClick={onCancel} className="px-3 py-2 bg-gray-100 rounded">Cancel</button>
                <button onClick={submit} className="px-3 py-2 bg-yellow-500 text-white rounded">Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
