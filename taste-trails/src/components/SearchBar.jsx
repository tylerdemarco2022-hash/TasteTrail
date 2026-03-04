import React, { useState, useEffect, useRef, useContext } from 'react';
import { users } from '../data';
export default function SearchBar({ onSelect }) {
  // User names for autocomplete
  const apiUserNames = users.map(u => u.name)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  // ...existing code...
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const { location: userLocation } = useContext(LocationContext)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!query) {
      setAllResults([])
      setSuggestions([])
      setOpen(false)
      setActiveSuggestion(-1)
      return
    }
    setOpen(true)
    // Compute autocomplete suggestions immediately (local + cached user names)
    const groupNames = getLocalGroups(query).map(g => g.name)
    setSuggestions(getAutocompleteSuggestions(query, apiUserNames, groupNames, 6))
    // Debounce the full search
    const id = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(id)
  }, [query, apiUserNames])

  async function doSearch(q) {
    setLoading(true);
    const needle = q.toLowerCase().trim();
    // Only show exact matches from localRestaurants
    const exactMatches = localRestaurants.filter(r => (r.name || '').toLowerCase() === needle)
      .map((r, idx) => ({
        id: `local-${r.id}`,
        name: r.name,
        image: r.image || (typeof fallbackImage === 'function' ? fallbackImage(r.name, idx) : undefined),
        rating: 0,
        review_count: 0,
        distance: 0,
        source: 'local',
        location: { address1: r.location || 'Charlotte, NC' }
      }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/yelp/search?term=${encodeURIComponent(q)}&location=Charlotte`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      // Only show exact matches from Yelp results
      const yelpMatches = (data.restaurants || []).filter(yelpItem => (yelpItem.name || '').toLowerCase() === needle);
      setResults([...exactMatches, ...yelpMatches]);
    } catch (e) {
      console.error('Yelp search error:', e);
      setResults(exactMatches);
    } finally {
      setLoading(false);
    }
  }

  function buildAndSetResults(q, restaurants, foodItems, users, groups, cities) {
    const getBestScore = (fields) =>
      Math.max(...fields.map(f => f ? similarity(q.toLowerCase(), f.toLowerCase()) : 0))

    let unified = [
      ...restaurants.map(r => ({ ...r, _type: 'restaurant', _score: getBestScore([r.name || '', r.location || '']) })),
      ...foodItems.map(i => ({ ...i, _type: 'food', _score: getBestScore([i.name || '', i.description || '', i.restaurant || '']) })),
      ...users.map(u => ({ ...u, _type: 'user', _score: getBestScore([u.name || '', u.userCode || '']) })),
      ...groups.map(g => ({ ...g, _type: 'group', _score: getBestScore([g.name || '', g.desc || '']) })),
      ...cities.map(c => ({ ...c, _type: 'city', _score: getBestScore([c.name || '', c.state || '']) })),
    ]

    const needle = q.toLowerCase().trim()
    const longEnough = needle.length >= 4
    // Only include results with a reasonable score
    const filtered = unified.filter(item => {
      if (longEnough) return item._score > 0.3
      return item.name?.toLowerCase().startsWith(needle)
    })
    // Exact matches first, then by score
    const exactMatches = filtered.filter(item => item.name?.toLowerCase() === needle)
    const others = filtered.filter(item => item.name?.toLowerCase() !== needle)
    const sortedOthers = others.sort((a, b) => b._score - a._score)
    setAllResults([...exactMatches, ...sortedOthers].slice(0, 15))
  }

  function handleSelect(item) {
    if (item._type === 'user') {
      window.location.href = `/#/profile/${item.id}`
    } else if (item._type === 'group') {
      window.location.href = '/#/groups'
    } else if (item._type === 'city') {
      setQuery(item.name)
      doSearch(item.name)
      return
    } else {
      onSelect(item)
    }
    setQuery('')
    setOpen(false)
  }

  function handleSuggestionClick(text) {
    setQuery(text)
    inputRef.current?.focus()
    // Trigger search immediately
    doSearch(text)
  }

  // Keyboard navigation
  function handleKeyDown(e) {
    const totalItems = suggestions.length + allResults.length
    if (!open || totalItems === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion(prev => (prev + 1) % totalItems)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion(prev => (prev - 1 + totalItems) % totalItems)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeSuggestion >= 0 && activeSuggestion < suggestions.length) {
        handleSuggestionClick(suggestions[activeSuggestion])
      } else if (activeSuggestion >= suggestions.length) {
        handleSelect(allResults[activeSuggestion - suggestions.length])
      } else {
        doSearch(query)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveSuggestion(-1)
    }
  }

  const showDropdown = open && query && (suggestions.length > 0 || allResults.length > 0 || loading)

  const TYPE_ICON = {
    user: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    restaurant: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3" />
      </svg>
    ),
    food: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    group: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
      </svg>
    ),
    city: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      </svg>
    ),
  }

  const SEARCH_ICON = (
    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )

  // Build the flat ordered list for keyboard nav index tracking
  // suggestions first, then results
  let resultOffset = 0

  // ...existing code...
  return (
    <div className="relative">
      {/* Input */}
      <div className="relative flex items-center">
        <svg
          className="absolute left-3 w-5 h-5 text-gray-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveSuggestion(-1) }}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setOpen(true)}
          placeholder="Search restaurants, dishes, friends, groups..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
          autoComplete="off"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-full mt-1 overflow-hidden"
          style={{ maxHeight: '480px', overflowY: 'auto' }}
        >
          {/* ── Google-style autocomplete suggestions ── */}
          {suggestions.length > 0 && (
            <div className="py-1 border-b border-gray-100">
              {suggestions.map((text, idx) => {
                const isActive = activeSuggestion === idx
                // Show the typed portion normal, rest in lighter text
                const lowerText = text.toLowerCase()
                const lowerQ = query.toLowerCase()
                const matchStart = lowerText.indexOf(lowerQ)
                let before = '', match = text, after = ''
                if (matchStart >= 0) {
                  before = text.slice(0, matchStart)
                  match = text.slice(matchStart, matchStart + query.length)
                  after = text.slice(matchStart + query.length)
                }
                return (
                  <button
                    key={`sug-${idx}`}
                    onMouseDown={e => { e.preventDefault(); handleSuggestionClick(text) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${isActive ? 'bg-gray-50' : ''}`}
                  >
                    {SEARCH_ICON}
                    <span className="text-sm text-gray-700 truncate">
                      {before}
                      <span className="font-semibold text-gray-900">{match}</span>
                      <span className="text-gray-400">{after}</span>
                    </span>
                    {/* Arrow to fill into input */}
                    <svg
                      className="w-3.5 h-3.5 text-gray-300 ml-auto flex-shrink-0 rotate-[-45deg]"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                )
              })}
            </div>
          )}


          {/* ── Unified results, no headers ── */}
          {allResults.map((item, idx) => {
            const globalIdx = suggestions.length + idx
            const isActive = activeSuggestion === globalIdx
            return (
              <button
                key={`${item._type}-${item.id || item.name || idx}`}
                onMouseDown={e => { e.preventDefault(); handleSelect(item) }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-50 ${isActive ? 'bg-blue-50' : ''}`}
              >
                {/* Avatar / image */}
                {item._type === 'user' && (
                  item.avatar_url
                    ? <img src={item.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {item.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )
                )}
                {item._type !== 'user' && item.image && (
                  <img src={item.image} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                )}
                {item._type !== 'user' && !item.image && (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400">
                    {TYPE_ICON[item._type]}
                  </div>
                )}

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                    {item.name}
                    {item.isLocal && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-normal">suggested</span>
                    )}
                  </div>
                  {item._type === 'food' && (
                    <div className="text-xs text-gray-500 truncate">{item.restaurant}{item.category ? ` · ${item.category}` : ''}</div>
                  )}
                  {item._type === 'restaurant' && item.location && (
                    <div className="text-xs text-gray-500 truncate">{item.location}</div>
                  )}
                  {item._type === 'restaurant' && (
                    item.rating > 0 ? (
                      <div className="text-xs text-yellow-600">{item.rating.toFixed(1)} stars{item.reviewCount > 0 ? ` · ${item.reviewCount} reviews` : ''}</div>
                    ) : (
                      <div className="text-xs text-gray-400">Not rated yet</div>
                    )
                  )}
                  {item._type === 'food' && item.description && (
                    <div className="text-xs text-gray-400 truncate">{item.description}</div>
                  )}
                  {item._type === 'user' && item.userCode && (
                    <div className="text-xs text-gray-500">#{item.userCode}</div>
                  )}
                  {item._type === 'group' && (
                    <div className="text-xs text-gray-500 truncate">{item.desc} · {item.memberCount} member{item.memberCount !== 1 ? 's' : ''}</div>
                  )}
                  {item._type === 'city' && (
                    <div className="text-xs text-gray-500">{item.state ? `${item.state}` : ''}</div>
                  )}
                </div>
              </button>
            )
          })}

          {/* Empty state */}
          {!loading && allResults.length === 0 && suggestions.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  )
}
