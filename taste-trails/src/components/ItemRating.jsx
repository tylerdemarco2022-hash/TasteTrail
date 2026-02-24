import React, { useState, useRef, useEffect } from 'react'
import StarRating from './StarRating'
import { filterProfanity } from '../utils/profanityFilter'

const GROUPS_STORAGE_KEY = 'taste-trails-groups'
const CURRENT_USER = 'You'

export default function ItemRating({ item, restaurant, onBack, onSubmit }) {
  const placeholderImages = [
    'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1506354666786-959d6d497f1a?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1400&q=80'
  ]

  const getItemBackdrop = () => {
    if (item?.image) return item.image
    const seed = (item?.name || 'dish').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
    return placeholderImages[seed % placeholderImages.length]
  }

  const backdropImage = getItemBackdrop()
  const headerStyle = backdropImage
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.2)), url(${backdropImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : {
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.4), rgba(255, 255, 255, 0.6))'
      }

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const [showCamera, setShowCamera] = useState(false)
  const [stream, setStream] = useState(null)
  const [myGroups, setMyGroups] = useState([])
  const [showGroupPicker, setShowGroupPicker] = useState(false)
  // Feed + profile are always enabled. Groups are optional multi-select.
  const [postTo, setPostTo] = useState({ feed: true, profile: true, groups: [] })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUPS_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      const list = Array.isArray(parsed) ? parsed : []
      const mine = list.filter((group) => Array.isArray(group?.members) && group.members.includes(CURRENT_USER))
      setMyGroups(mine)
    } catch (e) {
      setMyGroups([])
    }
  }, [])

  const toggleGroupSelection = (groupId) => {
    setPostTo((prev) => {
      const selected = Array.isArray(prev.groups) ? prev.groups : []
      const exists = selected.some((id) => String(id) === String(groupId))
      const nextGroups = exists
        ? selected.filter((id) => String(id) !== String(groupId))
        : [...selected, groupId]
      return { ...prev, groups: nextGroups }
    })
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      setPhoto(ev.target.result)
      setPhotoPreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setShowCamera(true)
    } catch (err) {
      console.error('Error accessing camera:', err)
      alert('Could not access camera. Please use the upload option.')
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0)
    
    const photoData = canvas.toDataURL('image/jpeg')
    setPhoto(photoData)
    setPhotoPreview(photoData)
    stopCamera()
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setShowCamera(false)
  }

  const handleSubmit = () => {
    const trimmed = comment.trim()
    if (!trimmed) {
      alert('Please add a comment about this dish')
      return
    }
    const cleanedComment = filterProfanity(trimmed)
    const selectedGroups = Array.isArray(postTo.groups) ? postTo.groups : []
    const reviewData = {
      dishName: item.name,
      restaurant: restaurant,
      rating: rating,
      comment: cleanedComment,
      photo: photo,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString(),
      postTo: {
        feed: true,
        profile: true,
        groups: selectedGroups
      }
    }
    if (cleanedComment !== trimmed) {
      alert('Profanity was removed from your comment.')
    }
    onSubmit(reviewData)
  }

  const handleCancel = () => {
    stopCamera()
    onBack()
  }

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 pb-24">
        {/* Header */}
        <div className="rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="p-4 text-white" style={headerStyle}>
            <div className="flex items-center justify-between mb-3">
              <button 
                onClick={handleCancel}
                className="text-white/90 hover:text-white flex items-center gap-2"
              >
                â† Back
              </button>
              <h2 className="text-lg font-bold">Rate Item</h2>
              <div className="w-16"></div>
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-semibold">{item.name}</h3>
              <p className="text-sm text-white/80">{restaurant}</p>
            </div>
          </div>
        </div>

        {/* Photo Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Photo</h3>
          
          {!photoPreview && !showCamera && (
            <div className="space-y-2">
              <button
                onClick={startCamera}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                ðŸ“· Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                ðŸ“ Upload from Gallery
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          )}

          {showCamera && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-black"
              />
              <div className="flex gap-2">
                <button
                  onClick={capturePhoto}
                  className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
                >
                  ðŸ“¸ Capture
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {photoPreview && !showCamera && (
            <div className="space-y-3">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full rounded-lg"
              />
              <button
                onClick={() => {
                  setPhoto(null)
                  setPhotoPreview(null)
                }}
                className="w-full px-4 py-2 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200"
              >
                Remove Photo
              </button>
            </div>
          )}
        </div>

        {/* Rating Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Rating</h3>
          <div className="flex items-center justify-center gap-4 mb-3">
            <StarRating value={rating} />
            <span className="text-2xl font-bold text-gray-900">{rating.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={rating}
            onChange={(e) => setRating(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>


        {/* Post Options */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Posting</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl bg-gray-50">
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Always posting to</div>
                <div className="text-xs text-gray-500 mt-1">Community Feed and My Profile are always included.</div>
              </div>
              <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">Enabled</span>
            </div>

            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowGroupPicker((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-all"
              >
                <div>
                  <div className="font-semibold text-gray-900">Groups</div>
                  <div className="text-xs text-gray-500">
                    {postTo.groups.length > 0
                      ? `${postTo.groups.length} selected`
                      : 'Select groups to also share this rating'}
                  </div>
                </div>
                <span className="text-sm text-gray-600 font-semibold">
                  {showGroupPicker ? 'Hide' : 'Choose'}
                </span>
              </button>

              {showGroupPicker && (
                <div className="border-t border-gray-200 p-3 space-y-2 bg-white">
                  {myGroups.length === 0 ? (
                    <div className="text-xs text-gray-500 px-1 py-2">You are not in any groups yet.</div>
                  ) : (
                    myGroups.map((group) => {
                      const checked = postTo.groups.some((id) => String(id) === String(group.id))
                      return (
                        <label
                          key={group.id}
                          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroupSelection(group.id)}
                            className="w-4 h-4 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{group.name}</div>
                            <div className="text-xs text-gray-500">{(group.members || []).length} members</div>
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comment Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Review</h3>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about this dish... What did you love? Any tips for others?"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows="6"
          />
          <div className="text-xs text-gray-500 mt-2">
            {comment.length} characters
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Profanity is filtered automatically.
          </div>
        </div>

        {/* Submit Button */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <button
            onClick={handleSubmit}
            disabled={!comment.trim()}
            className="w-full px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg hover:from-amber-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg"
          >
            Submit Review
          </button>
        </div>
      </div>

    </div>
  )
}

