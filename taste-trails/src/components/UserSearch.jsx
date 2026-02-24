import React, { useState, useEffect, useContext } from 'react'
import { useAuth } from '../context/AuthContext'
import { currentUser, users as seedUsers, posts } from '../data'
import { API_BASE_URL } from '../config/api'
import { LocationContext } from '../App'
import Fuse from 'fuse.js'
import { Lock } from 'lucide-react'
import {
  getActiveProfileId,
  getPrivateProfileForUser,
  loadUserScopedValue,
  saveUserScopedValue
} from '../utils/accountStorage'

// â”€â”€ Build a unique restaurant list from posts (since data.restaurants = []) â”€â”€
function buildLocalRestaurants() {
  const map = new Map()
  for (const post of posts) {
    const name = post.restaurant || ''
    if (!name || map.has(name.toLowerCase())) continue
    map.set(name.toLowerCase(), {
      id: post.restaurant_id || `local-${name.replace(/\s+/g, '-').toLowerCase()}`,
      name,
      image: post.image || null,
      rating: 0,
      reviewCount: 0,
      location: post.location || 'Charlotte, NC',
      isLocal: true,
    })
  }
  return Array.from(map.values())
}

const LOCAL_RESTAURANTS = buildLocalRestaurants()

// â”€â”€ Build a unique dish list from posts (post.dish + post.menu[]) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildLocalDishes() {
  const map = new Map()
  for (const post of posts) {
    // Signature dish from the post itself
    if (post.dish) {
      const key = post.dish.toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          name: post.dish,
          restaurant: post.restaurant,
          restaurantId: post.restaurant_id,
          image: post.image || null,
          price: null,
        })
      }
    }
    // Menu items
    if (Array.isArray(post.menu)) {
      for (const item of post.menu) {
        const itemName = item.name || ''
        if (!itemName) continue
        const key = itemName.toLowerCase()
        if (!map.has(key)) {
          map.set(key, {
            name: itemName,
            restaurant: post.restaurant,
            restaurantId: post.restaurant_id,
            image: post.image || null,
            price: item.price || null,
          })
        }
      }
    }
  }
  return Array.from(map.values())
}

const LOCAL_DISHES = buildLocalDishes()

// â”€â”€ Similarity scorer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function similarity(a, b) {
  if (!a || !b) return 0
  a = a.toLowerCase()
  b = b.toLowerCase()
  if (a === b) return 1
  if (b.includes(a) || a.includes(b)) return 0.9
  const ta = a.split(/\s+/)
  const tb = b.split(/\s+/)
  for (const word of tb) {
    if (word.startsWith(a)) return 0.85
    for (const qword of ta) {
      if (word.startsWith(qword) && qword.length > 1) return 0.8
    }
  }
  const setA = new Set(ta)
  const setB = new Set(tb)
  const inter = [...setA].filter((x) => setB.has(x)).length
  const union = new Set([...setA, ...setB]).size || 1
  const charsA = new Set(a)
  const charsB = new Set(b)
  const charInter = [...charsA].filter((x) => charsB.has(x)).length
  const charUnion = charsA.size + charsB.size || 1
  return 0.6 * (inter / union) + 0.4 * (2 * charInter / charUnion)
}

function searchLocal(q) {
  const needle = q.toLowerCase().trim()
  if (!needle) return { restaurants: [], dishes: [], groups: [] }

  const restaurants = LOCAL_RESTAURANTS
    .map((r) => ({ ...r, _score: similarity(needle, r.name) }))
    .filter((r) => r._score > 0.1)
    .sort((a, b) => b._score - a._score)
    .slice(0, 6)

  const dishes = LOCAL_DISHES
    .map((d) => ({ ...d, _score: similarity(needle, d.name) }))
    .filter((d) => d._score > 0.12)
    .sort((a, b) => b._score - a._score)
    .slice(0, 6)

  const groups = (() => {
    try {
      const raw = localStorage.getItem('taste-trails-groups')
      if (!raw) return []
      return JSON.parse(raw)
        .filter((g) => g.name.toLowerCase().includes(needle))
        .slice(0, 5)
        .map((g) => ({
          id: g.id,
          name: g.name,
          desc: g.desc,
          memberCount: (g.members || []).length,
        }))
    } catch {
      return []
    }
  })()

  return { restaurants, dishes, groups }
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function UserSearch({ onFollowChange, onOpenProfile }) {
  const { profile } = useAuth()
  const activeProfileId = profile?.id || getActiveProfileId()
  const [searchQuery, setSearchQuery] = useState('')
  const [allResults, setAllResults] = useState({ restaurants: [], dishes: [], users: [], groups: [] })
  const [allUsers, setAllUsers] = useState(seedUsers) // start with seed data immediately
  const [following, setFollowing] = useState(() => {
    const stored = loadUserScopedValue('taste-trails-following', currentUser.following || [], activeProfileId)
    return Array.isArray(stored) ? stored : []
  })
  const [privacyTick, setPrivacyTick] = useState(0)
  const [loading, setLoading] = useState(false)
  const [listFollowLoading, setListFollowLoading] = useState(null)
  const { location: userLocation } = useContext(LocationContext)

  useEffect(() => {
    const stored = loadUserScopedValue('taste-trails-following', currentUser.following || [], activeProfileId)
    const next = Array.isArray(stored) ? stored : []
    setFollowing(next)
    currentUser.following = next
  }, [activeProfileId])

  useEffect(() => {
    const handlePrivacyUpdated = () => setPrivacyTick((value) => value + 1)
    window.addEventListener('privacyUpdated', handlePrivacyUpdated)
    return () => window.removeEventListener('privacyUpdated', handlePrivacyUpdated)
  }, [])

  // Try to load richer user list from backend; fall back to seedUsers
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const token = localStorage.getItem('access_token') || ''
        const res = await fetch(`${API_BASE_URL}/directory/users`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          const users = Array.isArray(data?.users) ? data.users : []
          if (users.length) setAllUsers(users)
          return
        }
        const res2 = await fetch(`${API_BASE_URL}/api/users`)
        if (res2.ok) {
          const data2 = await res2.json()
          const users2 = Array.isArray(data2?.users) ? data2.users : []
          if (users2.length) {
            setAllUsers(users2.map((u) => ({ id: u.id, name: u.displayName || u.username || 'Unknown', email: '' })))
          }
        }
      } catch {
        // seedUsers already set as default â€” nothing to do
      }
    }
    loadUsers()
  }, [profile?.id])

  // Fuzzy user search using Fuse.js against whichever user list we have
  function fuzzySearchUsers(q) {
    const pool = allUsers.length > 0 ? allUsers : seedUsers
    if (!pool.length) return []
    const fuse = new Fuse(pool, {
      keys: ['name', 'email'],
      threshold: 0.4,
      minMatchCharLength: 2,
      includeScore: true,
    })
    return fuse.search(q).map((r) => r.item).slice(0, 8)
  }

  // Main search effect
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setAllResults({ restaurants: [], dishes: [], users: [], groups: [] })
      return
    }

    // Run local search immediately (no loading state needed â€” it's instant)
    const local = searchLocal(q)
    const users = fuzzySearchUsers(q)
    setAllResults({ ...local, users })

    // Optionally enhance with backend results
    const controller = new AbortController()
    setLoading(true)
    ;(async () => {
      try {
        const token = localStorage.getItem('access_token') || ''
        let locParam = '&location=Charlotte'
        if (userLocation?.latitude && userLocation?.longitude) {
          locParam = `&lat=${userLocation.latitude}&lon=${userLocation.longitude}`
        }
        const res = await fetch(
          `${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}${locParam}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal }
        )
        if (res.ok) {
          const data = await res.json()
          const apiRestaurants = Array.isArray(data.restaurants) ? data.restaurants : []
          const apiUsers = Array.isArray(data.users) ? data.users : []
          // Merge: prefer API results but keep local if API has nothing
          setAllResults((prev) => ({
            ...prev,
            restaurants: apiRestaurants.length ? apiRestaurants : prev.restaurants,
            users: apiUsers.length ? apiUsers : prev.users,
          }))
        }
      } catch {
        // Local results already shown â€” nothing to do
      } finally {
        setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [searchQuery, allUsers])

  const isFollowing = (userId, user = null) => {
    const targetId = String(userId || '')
    if (!targetId) return false
    if (following.some((id) => String(id) === targetId)) return true
    return Boolean(user?.isFollowing)
  }

  const isUserPrivate = (user = {}) => {
    const override = getPrivateProfileForUser(user?.id)
    if (typeof override === 'boolean') return override
    return Boolean(user?.is_private || user?.isPrivate)
  }

  const handleToggleFollow = (userId) => {
    const targetId = String(userId || '')
    if (!targetId) return
    const alreadyFollowing = following.some((id) => String(id) === targetId)
    const newFollowing = alreadyFollowing
      ? following.filter((id) => String(id) !== targetId)
      : [...following, targetId]
    setFollowing(newFollowing)
    currentUser.following = newFollowing
    onFollowChange?.(newFollowing)
    saveUserScopedValue('taste-trails-following', newFollowing, activeProfileId)
  }

  const handleFollowUser = async (userId) => {
    setListFollowLoading(userId)
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('sb-access-token')
      if (!token) { alert('Please log in to send a follow request'); return }
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Follow request sent')
        setAllResults((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            String(u?.id) === String(userId)
              ? { ...u, followRequestStatus: 'pending' }
              : u
          )
        }))
      } else {
        alert(data.error || 'Failed to send request')
      }
    } catch (err) {
      alert('Failed to send request: ' + err.message)
    } finally {
      setListFollowLoading(null)
    }
  }

  const hasAnyResults =
    allResults.restaurants.length > 0 ||
    allResults.dishes.length > 0 ||
    allResults.users.length > 0 ||
    allResults.groups.length > 0

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Search input */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="relative">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search restaurants, dishes, people, or groupsâ€¦"
            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">ðŸ”</div>
        </div>
      </div>

      {searchQuery.trim() === '' ? (
        <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-400 text-sm">
          Search for restaurants, dishes, people, or groups
        </div>
      ) : (
        <>
          {/* â”€â”€ Restaurants â”€â”€ */}
          {allResults.restaurants.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">ðŸ½ï¸ Restaurants</h3>
              <div className="space-y-2">
                {allResults.restaurants.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md hover:bg-amber-50 transition-all flex items-center gap-3"
                    onClick={() => window.location.href = `/#/restaurant/${r.id}`}
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-amber-100 shrink-0 flex items-center justify-center">
                      {r.image
                        ? <img src={r.image} alt="" className="w-full h-full object-cover" />
                        : <span className="text-2xl">ðŸ½ï¸</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{r.name}</div>
                      {r.location && <div className="text-xs text-gray-500">{r.location}</div>}
                      {r.rating > 0 && (
                        <div className="text-xs text-gray-500">â­ {r.rating}{r.reviewCount > 0 ? ` Â· ${r.reviewCount} reviews` : ''}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* â”€â”€ Dishes â”€â”€ */}
          {allResults.dishes.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">ðŸ¥˜ Dishes</h3>
              <div className="space-y-2">
                {allResults.dishes.map((d, idx) => (
                  <div
                    key={`${d.name}-${idx}`}
                    className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md hover:bg-amber-50 transition-all flex items-center gap-3"
                    onClick={() => window.location.href = `/#/restaurant/${d.restaurantId}`}
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-amber-100 shrink-0 flex items-center justify-center">
                      {d.image
                        ? <img src={d.image} alt="" className="w-full h-full object-cover" />
                        : <span className="text-2xl">ðŸ´</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{d.name}</div>
                      {d.restaurant && <div className="text-xs text-gray-500">at {d.restaurant}</div>}
                      {d.price != null && (
                        <div className="text-xs font-semibold text-amber-500">
                          {typeof d.price === 'number' && d.price <= 10
                            ? ['', '$6.99', '$9.99', '$14.99', '$19.99', '$29.99'][d.price] || `$${d.price}`
                            : d.price}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* â”€â”€ People â”€â”€ */}
          {allResults.users.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">ðŸ‘¤ People</h3>
              <div className="space-y-2">
                {allResults.users.map((user) => {
                  const privateAccount = isUserPrivate(user)
                  const followingUser = isFollowing(user.id, user)
                  const requestPending = String(user?.followRequestStatus || '').toLowerCase() === 'pending'
                  return (
                    <div key={user.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onOpenProfile?.(user)}
                          className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold hover:opacity-90 text-sm"
                        >
                          {user.avatar
                            ? <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                            : user.name?.charAt(0).toUpperCase() || '?'
                          }
                        </button>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onOpenProfile?.(user)}
                              className="font-semibold text-gray-900 hover:underline text-sm text-left"
                            >
                              {user.name || 'Unknown'}
                            </button>
                            {privateAccount && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                          </div>
                          {user.email && <div className="text-xs text-gray-400">{user.email}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {privateAccount ? (
                          followingUser ? (
                            <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600">Following</span>
                          ) : requestPending ? (
                            <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-yellow-100 text-yellow-700">Requested</span>
                          ) : (
                            <button
                              onClick={() => handleFollowUser(user.id)}
                              disabled={listFollowLoading === user.id}
                              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {listFollowLoading === user.id ? '…' : 'Request'}
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              onClick={() => onOpenProfile?.(user)}
                              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-gray-200 hover:bg-gray-50"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleToggleFollow(user.id)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                                followingUser
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  : 'bg-amber-500 text-white hover:bg-amber-600'
                              }`}
                            >
                              {followingUser ? 'Following' : 'Follow'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* â”€â”€ Groups â”€â”€ */}
          {allResults.groups.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">ðŸ‘¥ Groups</h3>
              <div className="space-y-2">
                {allResults.groups.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => window.location.href = '/#/groups'}
                    className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md hover:bg-amber-50 transition-all"
                  >
                    <div className="font-semibold text-gray-900 text-sm">{g.name}</div>
                    <div className="text-xs text-gray-500">
                      {g.desc ? `${g.desc} Â· ` : ''}{g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {!hasAnyResults && !loading && (
            <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-400 text-sm">
              No results for "{searchQuery}" â€” try a different search
            </div>
          )}

          {/* Following count footer */}
          <div className="mt-4 bg-white rounded-xl shadow-sm p-3 text-center">
            <span className="text-sm text-gray-400">
              Following <span className="font-semibold text-gray-700">{following.length}</span>{' '}
              {following.length === 1 ? 'person' : 'people'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

