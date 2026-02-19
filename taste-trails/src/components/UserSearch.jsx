import React, { useState, useEffect, useContext } from 'react'
import { useAuth } from '../context/AuthContext'
import { currentUser, users as seedUsers, restaurants as localRestaurants } from '../data'
import { API_BASE_URL } from '../config/api'
import { LocationContext } from '../App'
import Fuse from 'fuse.js'
import { Lock } from 'lucide-react'


export default function UserSearch({ onFollowChange, onOpenProfile }) {
  const { profile } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [allResults, setAllResults] = useState({ restaurants: [], users: [], groups: [] })
  const [allUsers, setAllUsers] = useState([])
  const [following, setFollowing] = useState([...currentUser.following])
  const [loading, setLoading] = useState(false)
  const [listFollowLoading, setListFollowLoading] = useState(null) // userId being followed
  const { location: userLocation } = useContext(LocationContext)

  // Load all users from backend (bypasses Supabase RLS)
  useEffect(() => {
    const loadAllUsers = async () => {
      try {
        const token = localStorage.getItem('access_token') || ''
        const res = await fetch(`${API_BASE_URL}/directory/users`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
        if (!res.ok) {
          console.warn('Directory users failed, falling back to local API:', res.status)
          // Fallback: use local dataManager users
          const fallbackRes = await fetch(`${API_BASE_URL}/api/users`)
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json()
            const localUsers = Array.isArray(fallbackData?.users) ? fallbackData.users : []
            const normalized = localUsers.map(u => ({ id: u.id, name: u.displayName || u.username || 'Unknown', email: '' }))
            console.log('Loaded local users fallback:', normalized)
            setAllUsers(normalized.length ? normalized : seedUsers)
            return
          } else {
            console.error('Local users fallback failed:', await fallbackRes.text())
            setAllUsers(seedUsers)
            return
          }
        }
        const data = await res.json()
        const users = Array.isArray(data?.users) ? data.users : []
        console.log('Loaded users:', users)
        console.log('Total users found:', users.length)
        setAllUsers(users.length ? users : seedUsers)
      } catch (e) {
        console.error('Error loading users, attempting local fallback:', e)
        try {
          const fallbackRes = await fetch(`${API_BASE_URL}/api/users`)
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json()
            const localUsers = Array.isArray(fallbackData?.users) ? fallbackData.users : []
            const normalized = localUsers.map(u => ({ id: u.id, name: u.displayName || u.username || 'Unknown', email: '' }))
            console.log('Loaded local users fallback:', normalized)
            setAllUsers(normalized.length ? normalized : seedUsers)
          } else {
            setAllUsers(seedUsers)
          }
        } catch (err) {
          setAllUsers(seedUsers)
        }
      }
    }

    loadAllUsers()
  }, [profile?.id])

  // Live search via backend + fuzzy fallback
  useEffect(() => {
    const runSearch = async () => {
      const q = searchQuery.trim()
      if (!q) { 
        setAllResults({ restaurants: [], users: [], groups: [] })
        return 
      }

      setLoading(true)
      try {
        const token = localStorage.getItem('access_token') || ''
        
        // Use unified search endpoint
        let locParam = ''
        if (userLocation && userLocation.latitude && userLocation.longitude) {
          locParam = `&lat=${userLocation.latitude}&lon=${userLocation.longitude}`
        } else {
          locParam = '&location=Charlotte'
        }

        const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}${locParam}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
        
        if (res.ok) {
          const data = await res.json()
          const apiUsers = Array.isArray(data.users) ? data.users : []
          const apiRestaurants = Array.isArray(data.restaurants) ? data.restaurants : []
          const users = apiUsers.length ? apiUsers : (allUsers.length ? fuzzySearchUsers(q) : seedUsers)
          const localRestaurants = getLocalRestaurantMatches(q, 6)
          const mergedRestaurants = apiRestaurants.length ? apiRestaurants : localRestaurants
          
          // Get local groups
          const localGroups = getLocalGroups(q)
          
          setAllResults({
            restaurants: mergedRestaurants,
            users,
            groups: localGroups
          })
        } else {
          // Fallback to fuzzy search on locally loaded users
          const fuzzyUsers = allUsers.length > 0 ? fuzzySearchUsers(q) : []
          const localRestaurants = getLocalRestaurantMatches(q, 6)
          const localGroups = getLocalGroups(q)
          setAllResults({ 
            restaurants: localRestaurants, 
            users: fuzzyUsers, 
            groups: localGroups 
          })
        }
      } catch (e) {
        console.error('Backend search failed, falling back to client fuzzy:', e)
        // Fuzzy fallback on the locally loaded directory
        const fuzzyUsers = allUsers.length > 0 ? fuzzySearchUsers(q) : []
        const localRestaurants = getLocalRestaurantMatches(q, 6)
        const localGroups = getLocalGroups(q)
        setAllResults({ 
          restaurants: localRestaurants, 
          users: fuzzyUsers, 
          groups: localGroups 
        })
      } finally {
        setLoading(false)
      }
    }

    runSearch()
  }, [searchQuery, allUsers, profile?.id])

  function fuzzySearchUsers(q) {
    if (allUsers.length > 0) {
      const fuse = new Fuse(allUsers, {
        keys: ['name', 'email'],
        threshold: 0.4,
        minMatchCharLength: 2,
        includeScore: true
      })
      const results = fuse.search(q)
      return results.map(r => r.item)
    }
    return []
  }

  function getLocalGroups(query) {
    try {
      const raw = localStorage.getItem('taste-trails-groups')
      if (!raw) return []
      const groups = JSON.parse(raw)
      return groups
        .filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
        .map(g => ({
          id: g.id,
          name: g.name,
          desc: g.desc,
          memberCount: (g.members || []).length,
          type: 'group'
        }))
    } catch (e) {
      return []
    }
  }

  const fallbackRestaurantImage = (name, idx = 0) =>
    `https://source.unsplash.com/400x300/?restaurant,${encodeURIComponent(name)}&sig=${idx}`

  function getLocalRestaurantMatches(q, limit = 6) {
    const needle = q.toLowerCase().trim()
    if (!needle) return []
    return localRestaurants
      .map((r, idx) => {
        const score = similarity(needle, (r.name || '').toLowerCase())
        return {
          id: `local-${r.id}`,
          name: r.name,
          image: r.image || fallbackRestaurantImage(r.name, idx),
          rating: r.avgRating || 0,
          reviewCount: r.reviews || 0,
          location: r.location || '',
          score,
          isLocal: true
        }
      })
      .filter((r) => r.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  function similarity(a, b) {
    if (!a || !b) return 0
    const tokensA = a.split(/\s+/)
    const tokensB = b.split(/\s+/)
    let tokenOverlap = 0
    tokensA.forEach((t) => {
      if (tokensB.some((tb) => tb.includes(t) || t.includes(tb))) tokenOverlap++
    })
    const tokenScore = tokenOverlap / Math.max(tokensA.length, tokensB.length)

    let charOverlap = 0
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) charOverlap++
    }
    const charScore = charOverlap / Math.max(a.length, b.length)
    return 0.6 * tokenScore + 0.4 * charScore
  }

  const isFollowing = (userId) => following.includes(userId)

  const handleToggleFollow = (userId) => {
    let newFollowing
    if (isFollowing(userId)) {
      // Unfollow
      newFollowing = following.filter(id => id !== userId)
    } else {
      // Follow
      newFollowing = [...following, userId]
    }
    setFollowing(newFollowing)
    
    // Update currentUser following list
    currentUser.following = newFollowing
    
    // Notify parent component if callback provided
    if (onFollowChange) {
      onFollowChange(newFollowing)
    }

    // Save to localStorage
    try {
      localStorage.setItem('taste-trails-following', JSON.stringify(newFollowing))
    } catch (e) {
      console.error('Failed to save following list:', e)
    }
  }

  // Send follow request for private accounts
  const handleFollowUser = async (userId) => {
    console.log('🔵 Follow Request: Starting for user', userId)
    setListFollowLoading(userId)
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('sb-access-token')
      console.log('🔵 Token available:', !!token)
      if (!token) {
        alert('Please log in to send a follow request')
        setListFollowLoading(null)
        return
      }
      
      console.log('🔵 Sending POST to /api/users/' + userId + '/follow')
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/follow`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      
      console.log('🔵 Response status:', res.status)
      const data = await res.json()
      console.log('🔵 Response data:', data)
      
      if (res.ok) {
        console.log('✅ Follow request sent successfully')
        alert(data.message || 'Follow request sent')
        // Refresh search results to show updated status
        if (searchQuery.trim()) {
          await searchUsers(searchQuery)
        }
      } else {
        console.error('❌ Error response:', data)
        alert(data.error || 'Failed to send request')
      }
    } catch (err) {
      console.error('❌ Follow request error:', err)
      alert('Failed to send request: ' + err.message)
    } finally {
      setListFollowLoading(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for restaurants, people, or groups..."
            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            🔍
          </div>
        </div>
      </div>

      {searchQuery.trim() === '' ? (
        <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-500">
          Start typing to search for restaurants, people, or groups
        </div>
      ) : (
        <>
          {/* Restaurants Section */}
          {allResults.restaurants.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2 px-2">🍽️ Restaurants</h3>
              <div className="space-y-2">
                {allResults.restaurants.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => window.location.href = `/#/restaurant/${r.id}`}
                    className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      {r.image && (
                        <img src={r.image} alt="" className="w-16 h-16 object-cover rounded-lg" />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{r.name}</div>
                        {r.location && <div className="text-xs text-gray-500">{r.location}</div>}
                        {r.rating > 0 && (
                          <div className="text-xs text-gray-600">
                            ⭐ {r.rating} {r.reviewCount > 0 && `(${r.reviewCount} reviews)`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* People Section */}
          {allResults.users.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2 px-2">👤 People</h3>
              <div className="space-y-3">
                {allResults.users.map((user) => (
            <div key={user.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onOpenProfile && onOpenProfile(user)}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold hover:opacity-90"
                    title="View Profile"
                  >
                    {user.name?.charAt(0).toUpperCase() || '?'}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenProfile && onOpenProfile(user)}
                        className="font-semibold text-gray-900 hover:underline text-left"
                        title="View Profile"
                      >
                        {user.name || 'Unknown'}
                      </button>
                      {user.is_private && (
                        <Lock className="w-4 h-4 text-gray-500" title="Private account" />
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.is_private ? (
                    // Private account - show Request button
                    isFollowing(user.id) ? (
                      <span className="px-3 py-2 rounded-lg font-semibold bg-gray-200 text-gray-700 text-sm">
                        Following
                      </span>
                    ) : (
                      <button
                        onClick={() => handleFollowUser(user.id)}
                        disabled={listFollowLoading === user.id}
                        className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {listFollowLoading === user.id ? 'Requesting...' : 'Request'}
                      </button>
                    )
                  ) : (
                    // Public account - show View + Follow
                    <>
                      <button
                        onClick={() => onOpenProfile && onOpenProfile(user)}
                        className="px-3 py-2 rounded-lg font-semibold bg-white border hover:bg-gray-50"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleToggleFollow(user.id)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                          isFollowing(user.id)
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                      >
                        {isFollowing(user.id) ? 'Following' : 'Follow'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups Section */}
          {allResults.groups.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2 px-2">👥 Groups</h3>
              <div className="space-y-2">
                {allResults.groups.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => window.location.href = '/#/groups'}
                    className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="font-semibold text-gray-900">{g.name}</div>
                    <div className="text-sm text-gray-500">
                      {g.desc} • {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {allResults.restaurants.length === 0 && 
           allResults.users.length === 0 && 
           allResults.groups.length === 0 && !loading && (
            <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-500">
              No results found. Try a different search.
            </div>
          )}

          {/* Following Count */}
          <div className="mt-4 bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-sm text-gray-500">
              You're following <span className="font-semibold text-gray-900">{following.length}</span> {following.length === 1 ? 'person' : 'people'}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
