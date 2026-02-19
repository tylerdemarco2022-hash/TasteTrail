import React, { useState, useEffect } from 'react'
import { restaurants as localRestaurants } from '../data'

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query) return setResults([])
    const id = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(id)
  }, [query])

  async function doSearch(q) {
    setLoading(true)
    const fuzzy = getFuzzySuggestions(q)

    // Always show local results immediately
    setResults(fuzzy)

    try {
      const res = await fetch(`http://localhost:8081/api/yelp/search?term=${encodeURIComponent(q)}&location=Charlotte`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      
      // Merge Yelp results with local, prioritizing local matches
      const combined = [...fuzzy]
      data.forEach(yelpItem => {
        // Only add Yelp result if it's not already in local results
        const existsLocally = fuzzy.some(local => 
          local.name.toLowerCase().includes(yelpItem.name.toLowerCase()) ||
          yelpItem.name.toLowerCase().includes(local.name.toLowerCase())
        )
        if (!existsLocally) {
          combined.push(yelpItem)
        }
      })
      setResults(combined)
    } catch (e) {
      console.error('Yelp search error:', e)
      // Keep showing fuzzy results even if Yelp fails
      setResults(fuzzy)
    } finally {
      setLoading(false)
    }
  }

  const fallbackImage = (name, idx = 0) => `https://source.unsplash.com/400x300/?restaurant,${encodeURIComponent(name)}&sig=${idx}`

  function getFuzzySuggestions(q) {
    const needle = q.toLowerCase().trim()
    if (!needle) return []
    return localRestaurants
      .map((r, idx) => {
        const score = similarity(needle, (r.name || '').toLowerCase())
        return {
          id: `local-${r.id}`,
          name: r.name,
          image: r.image || fallbackImage(r.name, idx),
          rating: r.avgRating || 4.5,
          review_count: (r.menu || []).length || 12,
          distance: 0,
          _score: score,
          source: 'local',
          location: { address1: r.location || 'Charlotte, NC' }
        }
      })
      .filter((r) => r._score > 0.1) // Lower threshold for better matching
      .sort((a, b) => b._score - a._score)
      .slice(0, 8) // Show more results
  }

  function similarity(a, b) {
    if (!a || !b) return 0
    
    // Exact match or substring gets top score
    if (a === b) return 1
    if (b.includes(a) || a.includes(b)) return 0.95

    // Check if any word in the query matches any word in the restaurant name
    const ta = a.split(/\s+/)
    const tb = b.split(/\s+/)
    
    // If any word starts with the query, high score
    for (const word of tb) {
      if (word.startsWith(a)) return 0.9
      for (const qword of ta) {
        if (word.startsWith(qword) && qword.length > 2) return 0.85
      }
    }

    // Token overlap
    const setA = new Set(ta)
    const setB = new Set(tb)
    const inter = [...setA].filter((x) => setB.has(x)).length
    const union = new Set([...setA, ...setB]).size || 1

    // Character overlap (Dice coefficient)
    const charsA = new Set(a)
    const charsB = new Set(b)
    const charInter = [...charsA].filter((x) => charsB.has(x)).length
    const charUnion = charsA.size + charsB.size || 1

    return 0.6 * (inter / union) + 0.4 * (2 * charInter / charUnion)
  }

  return (
    <div className="mb-4">
      <input
        className="w-full p-2 rounded border"
        placeholder="Search restaurants, cuisine or city…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) {
            onSelect(results[0])
          }
        }}
      />

      {loading && <div className="text-sm text-gray-500 mt-2">Searching…</div>}

      {results.length > 0 && (
        <div className="mt-2 bg-white rounded shadow divide-y">
          {results.map((r, idx) => (
            <div key={r.id || `${r.name}-${idx}`} className="p-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50" onClick={() => onSelect(r)}>
              <img src={r.image || fallbackImage(r.name, idx)} alt="" className="w-12 h-12 object-cover rounded" />
              <div>
                <div className="font-medium flex items-center gap-2">
                  <span>{r.name}</span>
                  {r.source === 'local' && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700">auto-correct</span>}
                </div>
                <div className="text-xs text-gray-500">{r.rating || '—'} · {r.review_count || 0} reviews</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
