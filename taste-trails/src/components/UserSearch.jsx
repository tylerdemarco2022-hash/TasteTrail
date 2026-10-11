import React, { useState, useEffect, useContext } from 'react'
import { useAuth } from '../context/AuthContext'
import { currentUser, users as seedUsers, posts } from '../data'
import { API_BASE_URL } from '../config/api'
import { LocationContext } from '../App'
import Fuse from 'fuse.js'
import { Lock } from 'lucide-react'
import MenuFinderControls from './MenuFinderControls'
import { findMenuItems, searchRestaurants } from '../services/menuItemFinder'
import { getClientMenuCatalog } from '../services/menuCatalogClient'
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
    .filter((r) => r._score > 0.34)
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

  return { restaurants, groups }
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function selectedDietary(stored) {
  if (!stored || typeof stored !== 'object') return []
  return Object.entries(stored).filter(([, on]) => on).map(([key]) => key)
}

export default function UserSearch({ onFollowChange, onOpenProfile, onOpenMenu }) {
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
  const [dietary, setDietary] = useState(() => selectedDietary(loadUserScopedValue('taste-trails-dietary', {})))
  const [maxPrice, setMaxPrice] = useState(null)
  const [maxPriceLevel, setMaxPriceLevel] = useState(null)
  const [maxDistanceMiles, setMaxDistanceMiles] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState('Distance uses Charlotte until you share your location.')
  const [searchNote, setSearchNote] = useState('')
  const { location: userLocation, setLocation } = useContext(LocationContext)

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
    const filtersActive = dietary.length > 0 || maxPrice != null || maxPriceLevel != null || maxDistanceMiles != null
    if (!q && !filtersActive) {
      setAllResults({ restaurants: [], dishes: [], users: [], groups: [] })
      setSearchNote('')
      return
    }

    const local = q ? searchLocal(q) : { restaurants: [], groups: [] }
    const users = q ? fuzzySearchUsers(q) : []
    const catalog = getClientMenuCatalog()
    const menu = findMenuItems(catalog, {
      q,
      lat: userLocation?.latitude,
      lng: userLocation?.longitude,
      dietary,
      maxPrice,
      maxPriceLevel,
      maxDistanceMiles,
      limit: 12
    })
    const catalogRestaurants = searchRestaurants(catalog, q, {
      lat: userLocation?.latitude,
      lng: userLocation?.longitude,
      maxDistanceMiles
    })
    const restaurants = []
    const seenRestaurants = new Set()
    for (const restaurant of [...catalogRestaurants, ...local.restaurants]) {
      const key = String(restaurant?.name || '').toLowerCase()
      if (!key || seenRestaurants.has(key)) continue
      seenRestaurants.add(key)
      restaurants.push(restaurant)
      if (restaurants.length >= 6) break
    }
    setSearchNote(menu.message || '')
    setAllResults({ ...local, restaurants, dishes: menu.items, users })

    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      ;(async () => {
        try {
          const token = localStorage.getItem('access_token') || ''
          let locParam = '&location=Charlotte'
          if (userLocation?.latitude && userLocation?.longitude) {
            locParam = `&lat=${userLocation.latitude}&lon=${userLocation.longitude}`
          }
          const [menuResult, searchResult] = await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/find-menu-items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                q,
                lat: userLocation?.latitude,
                lng: userLocation?.longitude,
                dietary,
                maxPrice,
                maxPriceLevel,
                maxDistanceMiles,
                limit: 12
              }),
              signal: controller.signal
            }),
            fetch(
              `${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}${locParam}`,
              { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal }
            )
          ])
          if (menuResult.status === 'fulfilled' && menuResult.value.ok) {
            const data = await menuResult.value.json()
            const dishes = Array.isArray(data.items) ? data.items : []
            setAllResults((prev) => ({ ...prev, dishes }))
            if (data.message) setSearchNote(data.message)
            else if (dishes.some((item) => item.source === 'saved')) setSearchNote('Some dishes are from a saved menu because a live menu could not be retrieved.')
            else setSearchNote('')
          }
          if (searchResult.status === 'fulfilled' && searchResult.value.ok) {
            const data = await searchResult.value.json()
            const apiRestaurants = Array.isArray(data.restaurants) ? data.restaurants : []
            const apiUsers = Array.isArray(data.users) ? data.users : []
            setAllResults((prev) => ({
              ...prev,
              restaurants: apiRestaurants.length ? apiRestaurants : prev.restaurants,
              users: apiUsers.length ? apiUsers : prev.users
            }))
          }
          const menuFailed = menuResult.status === 'rejected' || (menuResult.status === 'fulfilled' && !menuResult.value.ok)
          if (menuFailed) {
            setSearchNote((current) => current || 'Showing saved menus on this device. The server could not be reached.')
          }
        } catch (error) {
          if (error?.name === 'AbortError') return
          setSearchNote((current) => current || 'Showing saved menus on this device. The server could not be reached.')
        } finally {
          setLoading(false)
        }
      })()
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery, allUsers, dietary, maxPrice, maxPriceLevel, maxDistanceMiles, userLocation])

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
            placeholder="Search restaurants, dishes, people, or groups"
            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">Search</div>
        </div>
        <MenuFinderControls
          dietary={dietary}
          onToggleDietary={(key) => setDietary((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}
          maxPrice={maxPrice}
          maxPriceLevel={maxPriceLevel}
          onPriceChange={({ maxPrice: nextPrice, maxPriceLevel: nextLevel }) => {
            setMaxPrice(nextPrice)
            setMaxPriceLevel(nextLevel)
          }}
          maxDistanceMiles={maxDistanceMiles}
          onDistanceChange={setMaxDistanceMiles}
          onUseLocation={() => {
            if (!navigator.geolocation) {
              setLocationNote('This device does not share location. Results stay centered on Charlotte.')
              return
            }
            setLocating(true)
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setLocation?.({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
                setLocationNote('Using your location for distance.')
                setLocating(false)
              },
              () => {
                setLocationNote('Location permission was denied. Results stay centered on Charlotte.')
                setLocating(false)
              },
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
            )
          }}
          locating={locating}
          locationNote={locationNote}
        />
      </div>

      {searchQuery.trim() === '' && dietary.length === 0 && maxPrice == null && maxPriceLevel == null && maxDistanceMiles == null ? (
        <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-400 text-sm">
          Search for restaurants, dishes, people, or groups
        </div>
      ) : (
        <>
          {/* â”€â”€ Restaurants â”€â”€ */}
          {allResults.restaurants.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Restaurants</h3>
              <div className="space-y-2">
                {allResults.restaurants.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md hover:bg-amber-50 transition-all flex items-center gap-3"
                    onClick={() => onOpenMenu?.({ restaurant: r.name, name: r.name, dish: r.dish, location: r.location })}
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-amber-100 shrink-0 flex items-center justify-center">
                      {r.image
                        ? <img src={r.image} alt="" className="w-full h-full object-cover" />
                        : <span className="text-sm font-semibold text-amber-700">Menu</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{r.name}</div>
                      {r.location && <div className="text-xs text-gray-500">{r.location}</div>}
                      {r.rating > 0 && (
                        <div className="text-xs text-gray-500">{r.rating}{r.reviewCount > 0 ? ` · ${r.reviewCount} reviews` : ''}</div>
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
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Dishes</h3>
              <div className="space-y-2">
                {allResults.dishes.map((d, idx) => (
                  <div
                    key={`${d.name}-${idx}`}
                    className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md hover:bg-amber-50 transition-all flex items-center gap-3"
                    onClick={() => onOpenMenu?.({
                      restaurant: d.restaurant?.name || d.restaurant,
                      name: d.restaurant?.name || d.restaurant,
                      dish: d.name,
                      location: d.restaurant?.address || d.address || ''
                    })}
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-amber-100 shrink-0 flex items-center justify-center">
                      <span className="text-sm font-semibold text-amber-700">Dish</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{d.name}</div>
                      {(d.restaurant?.name || d.restaurant) && (
                        <div className="text-xs text-gray-500">at {d.restaurant?.name || d.restaurant}</div>
                      )}
                      <div className="text-xs text-amber-600 font-semibold">
                        {[
                          d.priceLabel,
                          d.source === 'live' ? 'Live menu' : d.source === 'saved' ? 'Saved menu' : null,
                          d.distanceMiles != null ? `${d.distanceMiles} mi${d.approximateLocation ? ' approx' : ''}` : null
                        ].filter(Boolean).join(' · ') || 'Price not listed'}
                      </div>
                      {Array.isArray(d.dietaryLabels) && d.dietaryLabels.length > 0 && (
                        <div className="text-xs text-gray-400 truncate">{d.dietaryLabels.slice(0, 3).map((tag) => tag.label).join(' · ')}</div>
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
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">People</h3>
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
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Groups</h3>
              <div className="space-y-2">
                {allResults.groups.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => window.location.href = '/#/groups'}
                    className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md hover:bg-amber-50 transition-all"
                  >
                    <div className="font-semibold text-gray-900 text-sm">{g.name}</div>
                    <div className="text-xs text-gray-500">
                      {g.desc ? `${g.desc} · ` : ''}{g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {!hasAnyResults && !loading && (
            <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-500 text-sm">
              {searchNote || `No results for "${searchQuery}"`}
            </div>
          )}
          {searchNote && hasAnyResults && (
            <p className="text-xs text-gray-500 px-1 mb-3">{searchNote}</p>
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

