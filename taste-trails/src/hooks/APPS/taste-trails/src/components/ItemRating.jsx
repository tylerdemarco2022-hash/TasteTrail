import React, { useState, useRef } from 'react'
import StarRating from './StarRating'

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
  // Post options are now always visible above the comment box
  const [postTo, setPostTo] = useState({ feed: false, group: null, profile: true })

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
    if (!comment.trim()) {
      alert('Please add a comment about this dish')
      return
    }
    const reviewData = {
      dishName: item.name,
      restaurant: restaurant,
      rating: rating,
      comment: comment.trim(),
      photo: photo,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString(),
      postTo: postTo
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
                ← Back
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
                📷 Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                📁 Upload from Gallery
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
                  📸 Capture
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


        {/* Post Options (always visible) */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Where do you want to post?</h3>
          <div className="space-y-3">
            {/* Feed Option */}
            <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all">
              <input
                type="checkbox"
                checked={postTo.feed}
                onChange={(e) => setPostTo({ ...postTo, feed: e.target.checked })}
                className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Community Feed</div>
                <div className="text-xs text-gray-500">Share with your followers</div>
              </div>
              <span className="text-2xl">🌍</span>
            </label>

            {/* Group Option */}
            <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all">
              <input
                type="checkbox"
                checked={postTo.group !== null}
                onChange={(e) => {
                  if (e.target.checked) {
                    // Get first group or null
                    const groups = JSON.parse(localStorage.getItem('taste-trails-groups') || '[]')
                    const myGroups = groups.filter(g => (g.members || []).includes('You'))
                    setPostTo({ ...postTo, group: myGroups.length > 0 ? myGroups[0].id : null })
                  } else {
                    setPostTo({ ...postTo, group: null })
                  }
                }}
                className="w-5 h-5 text-purple-500 rounded focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Group</div>
                <div className="text-xs text-gray-500">Share with your groups</div>
              </div>
              <span className="text-2xl">👥</span>
            </label>

            {/* Profile Option */}
            <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
              <input
                type="checkbox"
                checked={postTo.profile}
                onChange={(e) => setPostTo({ ...postTo, profile: e.target.checked })}
                className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">My Profile</div>
                <div className="text-xs text-gray-500">Save to your ratings</div>
              </div>
              <span className="text-2xl">👤</span>
            </label>
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
