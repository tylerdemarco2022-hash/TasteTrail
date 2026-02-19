import React, { useState } from 'react'

export default function EditBioModal({ displayName, bio, onSave, onCancel }) {
  const [newDisplayName, setNewDisplayName] = useState(displayName || '')
  const [newBio, setNewBio] = useState(bio || '')

  const handleSave = () => {
    if (!newDisplayName.trim()) {
      alert('Please enter a display name')
      return
    }
    onSave({
      displayName: newDisplayName.trim(),
      bio: newBio.trim()
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-xl font-bold">Edit Profile</h2>
        
        <div>
          <label className="block text-sm font-semibold mb-2">Display Name</label>
          <input
            type="text"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Your display name"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Bio</label>
          <textarea
            value={newBio}
            onChange={(e) => setNewBio(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            placeholder="Tell others about yourself..."
            rows="4"
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
