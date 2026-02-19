import React, { useState } from 'react'
import StarRating from './StarRating'

export default function EditRatingModal({ item, onSave, onCancel }) {
  const [rating, setRating] = useState(item.rating || 5)
  const [comment, setComment] = useState(item.comment || '')

  const handleSave = () => {
    onSave({
      ...item,
      rating: Number(rating),
      comment: comment.trim()
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-xl font-bold">Edit Rating</h2>
        
        <div>
          <label className="block text-sm font-semibold mb-2">Rating: {rating.toFixed(1)}/10</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="10"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <StarRating value={rating} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Comment (Optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            placeholder="Add a comment about this dish..."
            rows="3"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 px-4 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
