import React, { useState, useEffect } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import StarRating from './StarRating'
import Saved from './Saved'
import EditRatingModal from './EditRatingModal'
import EditBioModal from './EditBioModal'

/**
 * Profile Component - User's Own Profile with Privacy Toggle
 * 
 * Instagram-style Private Account Control:
 * - Users can toggle their account between public and private modes
 * - Private toggle is displayed prominently in the profile header
 * - When enabled: other users see "This account is private" and need to request to follow
 * - When disabled: anyone can view the user's posts and ratings
 * - Changes are saved to the backend and synchronized with the profile
 */

export default function Profile({ userPosts = [], onEditPost, onDeletePost }) {
  const { profile, user, refreshProfile } = useAuth()
  const [gallery, setGallery] = useState([])
  const [badges, setBadges] = useState([])
  const [activeTab, setActiveTab] = useState('my-content') // 'my-content' or 'saved'
  const [menuOpen, setMenuOpen] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [editingBio, setEditingBio] = useState(false)
  const [bio, setBio] = useState('Welcome to TasteTrails! Start exploring and rating dishes.')
  const [isPrivate, setIsPrivate] = useState(false)
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false)

  useEffect(() => {
    // Load privacy setting from profile
    if (profile?.is_private !== undefined) {
      setIsPrivate(profile.is_private)
    }
  }, [profile])

  useEffect(() => {
    const loadBadges = () => {
      try {
        const raw = localStorage.getItem('taste-trails-badges')
        const allBadges = raw ? JSON.parse(raw) : []
        // Filter badges for current user
        const userBadges = allBadges.filter(b => b.user === 'You')
        setBadges(userBadges)
      } catch (e) {
        setBadges([])
      }
    }

    const loadRatedItems = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('my-rated-items') || '[]')
        setGallery(saved)
      } catch (e) {
        setGallery([])
      }
    }

    loadBadges()
    loadRatedItems()

    const handlePostsCleared = () => setGallery([])
    const handleRatingSaved = () => loadRatedItems()
    window.addEventListener('postsCleared', handlePostsCleared)
    window.addEventListener('ratingSaved', handleRatingSaved)
    return () => {
      window.removeEventListener('postsCleared', handlePostsCleared)
      window.removeEventListener('ratingSaved', handleRatingSaved)
    }
  }, [])

  const handleEditRating = (item) => {
    setEditingItem(item)
  }

  const handleSaveRating = (updatedItem) => {
    const updatedGallery = gallery.map(g => 
      g.entryId === updatedItem.entryId 
        ? updatedItem
        : g
    )
    setGallery(updatedGallery)
    localStorage.setItem('my-rated-items', JSON.stringify(updatedGallery))
    setEditingItem(null)
    setMenuOpen(null)
    window.dispatchEvent(new Event('ratingSaved'))
  }

  const handleDeleteRating = (item) => {
    if (confirm(`Delete rating for ${item.dish}?`)) {
      const updatedGallery = gallery.filter(g => g.entryId !== item.entryId)
      setGallery(updatedGallery)
      localStorage.setItem('my-rated-items', JSON.stringify(updatedGallery))
      setMenuOpen(null)
      window.dispatchEvent(new Event('ratingSaved'))
    }
  }

  const handleSaveBio = async (updatedInfo) => {
    try {
      // Save bio locally
      setBio(updatedInfo.bio)
      localStorage.setItem('user_bio', updatedInfo.bio)
      
      // Try to update profile name on backend if server is running
      try {
        const response = await fetch('http://localhost:8081/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          },
          body: JSON.stringify({
            name: updatedInfo.displayName,
            email: profile?.email,
            is_private: isPrivate // Include current privacy setting
          })
        })
        if (response.ok) {
          await refreshProfile()
        }
      } catch (e) {
        // Backend not available, but bio saved locally
        console.warn('Backend not available, bio saved locally only')
      }
      
      setEditingBio(false)
    } catch (e) {
      console.error('Error saving bio:', e)
      alert(`Error saving bio: ${e.message}`)
    }
  }

  /**
   * Toggle Privacy Setting - Instagram-style
   * When user toggles private mode:
   * - Sends update to backend to save is_private flag
   * - Updates local state immediately for responsive UI
   * - Refreshes profile to sync with backend
   * 
   * Effect on other users:
   * - Private ON: Only followers can see posts/ratings. Others see lock icon and "Request to Follow"
   * - Private OFF: Everyone can view posts/ratings freely
   */
  const handlePrivacyToggle = async () => {
    setUpdatingPrivacy(true)
    const newPrivacyState = !isPrivate
    
    try {
      const response = await fetch('http://localhost:8081/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          name: profile?.name,
          email: profile?.email,
          is_private: newPrivacyState
        })
      })

      if (response.ok) {
        setIsPrivate(newPrivacyState)
        await refreshProfile()
        alert(`Account is now ${newPrivacyState ? 'private' : 'public'}`)
      } else {
        alert('Failed to update privacy setting')
      }
    } catch (e) {
      console.error('Error updating privacy:', e)
      alert('Error updating privacy setting')
    } finally {
      setUpdatingPrivacy(false)
    }
  }

  // Get user's first name for display
  const displayName = profile?.name || user?.email?.split('@')[0] || 'Food Explorer'
  const userEmail = profile?.email || user?.email || ''
  const userRole = profile?.role || 'user'

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-3xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold flex items-center gap-2">
              {displayName}
              {userRole === 'admin' && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">
                  Admin
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">{userEmail}</div>
            <p className="mt-2 text-gray-700">{bio}</p>
            
            {/* Privacy Toggle - Instagram Style */}
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => setEditingBio(true)}
                className="px-3 py-1 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold"
              >
                Edit Profile
              </button>
              
              <button
                onClick={handlePrivacyToggle}
                disabled={updatingPrivacy}
                className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg font-semibold transition-colors ${
                  isPrivate
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
                title={isPrivate ? 'Account is private. Only followers can see your posts.' : 'Account is public. Anyone can see your posts.'}
              >
                {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {updatingPrivacy ? 'Updating...' : isPrivate ? 'Private' : 'Public'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-6">
          <div><div className="font-semibold">{gallery.length}</div><div className="text-sm text-gray-500">Rated Dishes</div></div>
          <div><div className="font-semibold">{badges.length}</div><div className="text-sm text-gray-500">Badges</div></div>
          <div><div className="font-semibold">0</div><div className="text-sm text-gray-500">Following</div></div>
        </div>
      </div>

      {/* Badges Section */}
      {badges.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <h3 className="font-semibold text-lg mb-3">🏆 My Badges</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div key={badge.id} className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-3 border-2 border-yellow-200 text-center">
                <div className="text-3xl mb-1">{badge.name.split(' ')[0]}</div>
                <div className="text-xs font-semibold text-gray-700">{badge.name.split(' ').slice(1).join(' ')}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(badge.earnedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="bg-white rounded-xl shadow-sm mb-4 p-1 flex gap-1">
        <button
          onClick={() => setActiveTab('my-content')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors text-sm ${
            activeTab === 'my-content'
              ? 'bg-amber-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          My Content
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors text-sm ${
            activeTab === 'saved'
              ? 'bg-amber-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Saved Items
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'my-content' ? (
        <div className="space-y-3">
          {userPosts && userPosts.length > 0 ? (
            userPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-sm overflow-hidden relative">
                <div className="flex gap-3 p-3">
                  <img src={post.image} alt={post.dish} className="w-24 h-24 object-cover rounded" />
                  <div className="flex-1">
                    <div className="font-semibold">{post.restaurant}</div>
                    <div className="text-sm text-gray-600">{post.dish}</div>
                    <div className="text-sm text-gray-500 mt-1 line-clamp-2">{post.caption}</div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)}
                      className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
                    >
                      ⋯
                    </button>
                    {menuOpen === post.id && (
                      <div className="absolute right-0 mt-2 w-28 bg-white border rounded-lg shadow-lg z-10">
                        {onEditPost && (
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => { setMenuOpen(null); onEditPost(post) }}
                          >
                            Edit
                          </button>
                        )}
                        {onDeletePost && (
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50 border-t"
                            onClick={() => { setMenuOpen(null); onDeletePost(post) }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : null}
          {gallery && gallery.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {gallery.map((g) => (
                <div key={g.entryId} className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col relative">
                  <div className="relative h-48 bg-gradient-to-br from-orange-200 to-red-200 flex items-center justify-center text-3xl font-bold text-orange-800 overflow-hidden">
                    {g.image ? (
                      <img src={g.image} alt={g.dish} className="w-full h-full object-cover" />
                    ) : (
                      g.dish?.charAt(0)?.toUpperCase() || '🍴'
                    )}
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={() => setMenuOpen(menuOpen === g.entryId ? null : g.entryId)}
                        className="p-3 hover:bg-black hover:bg-opacity-30 rounded-full text-white text-2xl"
                      >
                        ⋯
                      </button>
                      {menuOpen === g.entryId && (
                        <div className="absolute right-0 mt-2 w-28 bg-white border rounded-lg shadow-lg z-10">
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => handleEditRating(g)}
                          >
                            Edit
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50 border-t"
                            onClick={() => handleDeleteRating(g)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="text-sm text-gray-500 truncate">{g.restaurant || 'Restaurant'}</div>
                    <div className="font-semibold text-lg truncate">{g.dish || 'Dish'}</div>
                    <div className="flex items-center gap-2">
                      <StarRating value={g.rating} />
                      <span className="text-sm font-semibold text-gray-700">{Number(g.rating).toFixed(1)}/10</span>
                    </div>
                    {g.comment && (
                      <div className="text-sm text-gray-600 line-clamp-2">{g.comment}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {(!userPosts || userPosts.length === 0) && (!gallery || gallery.length === 0) && (
            <div className="bg-white border rounded-lg p-4 text-center text-gray-500">
              You haven't posted or rated anything yet.
            </div>
          )}
        </div>
      ) : (
        <Saved />
      )}

      {editingItem && (
        <EditRatingModal
          item={editingItem}
          onSave={handleSaveRating}
          onCancel={() => setEditingItem(null)}
        />
      )}

      {editingBio && (
        <EditBioModal
          displayName={displayName}
          bio={bio}
          onSave={handleSaveBio}
          onCancel={() => setEditingBio(false)}
        />
      )}
    </div>
  )
}
