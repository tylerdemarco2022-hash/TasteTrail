import React, { useState, useEffect, useContext } from 'react'
import { API_BASE_URL } from '../config/api'
import { restaurants as localRestaurants } from '../data'
import { LocationContext } from '../App'

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('')
  const [allResults, setAllResults] = useState({ restaurants: [], users: [], groups: [], cities: [] })
  const [loading, setLoading] = useState(false)
  const { location: userLocation } = useContext(LocationContext)

  useEffect(() => {
    if (!query) return setAllResults({ restaurants: [], users: [], groups: [], cities: [] })
    const id = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(id)
  }, [query])

  async function doSearch(q) {
    setLoading(true)
    try {
      let locParam = ''
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        locParam = `lat=${userLocation.latitude}&lon=${userLocation.longitude}`
      } else {
        locParam = `location=Charlotte`
      }
      // Call unified search endpoint
      const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}&${locParam}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      // Merge with fuzzy local matches for restaurants
      const fuzzy = getFuzzySuggestions(q, 3)
      const mergedRestaurants = [...fuzzy, ...(data.restaurants || [])]
      // Deduplicate restaurants by name
      const uniqueRestaurants = Array.from(
        new Map(mergedRestaurants.map(r => [r.name.toLowerCase(), r])).values()
      ).slice(0, 6)
      // Add groups from localStorage
      const localGroups = getLocalGroups(q)
         setAllResults({
           restaurants: uniqueRestaurants,
           users: data.users || [],
           groups: localGroups,
           cities: data.cities || []
         })
    } catch (error) {
      console.error('Search error:', error)
      // Fallback to local fuzzy search
      const fuzzy = getFuzzySuggestions(q, 6)
      const localGroups = getLocalGroups(q)
      setAllResults({ 
        restaurants: fuzzy, 
        users: [], 
        groups: localGroups, 
        cities: [] 
      })
    } finally {
      setLoading(false)
    }
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

  const fallbackImage = (name, idx = 0) => `https://source.unsplash.com/400x300/?restaurant,${encodeURIComponent(name)}&sig=${idx}`

  function getFuzzySuggestions(q, limit = 6) {
    const needle = q.toLowerCase().trim()
    if (!needle) return []
    return localRestaurants
      .map((r, idx) => {
        const score = similarity(needle, (r.name || '').toLowerCase())
        return {
          id: `local-${r.id}`,
          name: r.name,
          image: r.image || fallbackImage(r.name, idx),
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

  const totalResults = 
    allResults.restaurants.length + 
    allResults.users.length + 
    allResults.groups.length + 
    allResults.cities.length

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for restaurants, people, groups, or cities..."
        className="w-full px-4 py-3 border rounded-lg shadow-sm"
        autoFocus
      />
      
      {query && totalResults > 0 && (
        <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-full mt-2 max-h-[500px] overflow-y-auto">
          {/* Restaurants */}
          {allResults.restaurants.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase sticky top-0">
                🍽️ Restaurants
              </div>
              {allResults.restaurants.map((r, idx) => (
                <div
                  key={`${r.id}-${idx}`}
                  onClick={() => {
                    onSelect(r)
                    setQuery('')
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  {r.image && (
                    <img src={r.image} alt="" className="w-12 h-12 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">
                      {r.name}
                      {r.isLocal && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          auto-correct
                        </span>
                      )}
                    </div>
                    {r.location && <div className="text-xs text-gray-500">{r.location}</div>}
                    {r.rating > 0 && (
                      <div className="text-xs text-gray-600">
                        ⭐ {r.rating} {r.reviewCount > 0 && `(${r.reviewCount} reviews)`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Users */}
          {allResults.users.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase sticky top-0">
                👤 People
              </div>
              {allResults.users.map((u) => (
                <div
                  key={u.id}
                  onClick={() => {
                    window.location.href = `/#/profile/${u.id}`
                    setQuery('')
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                    {u.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {u.name}
                      {u.isPrivate && <span className="text-gray-400">🔒</span>}
                    </div>
                    {u.userCode && (
                      <div className="text-xs text-gray-500">#{u.userCode}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Groups */}
          {allResults.groups.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase sticky top-0">
                👥 Groups
              </div>
              {allResults.groups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    window.location.href = '/#/groups'
                    setQuery('')
                  }}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-gray-500">
                    {g.desc} • {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cities */}
          {allResults.cities.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase sticky top-0">
                🏙️ Cities
              </div>
              {allResults.cities.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    // Update location for restaurant search
                    setQuery(c.name)
                    doSearch(c.name)
                  }}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="font-medium">{c.name}, {c.state}</div>
                  <div className="text-xs text-gray-500">Population: {c.population}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {query && totalResults === 0 && !loading && (
        <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-full mt-2 p-4 text-center text-gray-500">
          No results found for "{query}"
        </div>
      )}
    </div>
  )
}
