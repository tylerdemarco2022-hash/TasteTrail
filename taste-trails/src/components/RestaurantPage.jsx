import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Check, Info } from 'lucide-react'
import { API_BASE_URL } from '../config/api'
import { formatPublishedPrice } from '../services/menuPresentation'
import DishRatingSheet from './DishRatingSheet'

const TABS = ['Overview', 'Menu', 'Photos', 'Reviews']

export default function RestaurantPage({ post, onBack }) {
  const name = post?.restaurant || post?.name || 'Restaurant'
  const [menu, setMenu] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState(post?.dish ? 'Menu' : 'Overview')
  const [query, setQuery] = useState(post?.dish || '')
  const [openSections, setOpenSections] = useState({})
  const [ratingDish, setRatingDish] = useState(null)
  const [saveNote, setSaveNote] = useState('')
  const [expanded, setExpanded] = useState({})
  const [showSource, setShowSource] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ name })
        if (post?.website) params.set('website', post.website)
        if (post?.menuUrl) params.set('menuUrl', post.menuUrl)
        if (post?.lat != null) params.set('lat', String(post.lat))
        if (post?.lon != null) params.set('lng', String(post.lon))
        const token = localStorage.getItem('access_token')
        const res = await fetch(`${API_BASE_URL}/api/restaurant-menu?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setNotice(data.error || 'Menu not available online')
          setMenu({ sections: [], source: 'unavailable', website: post?.website || null })
        } else {
          setMenu(data)
          setNotice(data.message || '')
          const first = {}
          ;(data.sections || []).slice(0, 2).forEach((section) => { first[section.name] = true })
          setOpenSections(first)
        }
      } catch {
        if (!cancelled) {
          setNotice('Menu not available online')
          setMenu({ sections: [], source: 'unavailable', website: post?.website || null })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [name, post?.website, post?.menuUrl, post?.lat, post?.lon])

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (menu?.sections || []).map((section) => ({
      ...section,
      items: (section.items || []).filter((item) => !q || `${item.name} ${item.description || ''}`.toLowerCase().includes(q))
    })).filter((section) => section.items.length)
  }, [menu, query])

  const website = menu?.website || menu?.sourceUrl || post?.website || null
  const photos = [
    ...(post?.image ? [{ src: post.image, label: name }] : []),
    ...((menu?.reviews || []).filter((review) => review.photo).map((review) => ({ src: review.photo, label: review.dish })))
  ]

  async function save(kind, itemName, status) {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setSaveNote('Log in to save this.')
      return
    }
    const res = await fetch(`${API_BASE_URL}/api/saves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, name: itemName, restaurant: name, status })
    })
    const data = await res.json()
    setSaveNote(res.ok ? 'Saved' : (data.error || 'Could not save'))
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] pb-10 text-[var(--ink)]">
      <div className="plate relative h-52">
        {post?.image ? <img src={post.image} alt="" className="h-full w-full object-cover" /> : null}
        <button type="button" onClick={onBack} className="btn btn-quiet absolute left-4 top-[max(0.75rem,env(safe-area-inset-top))]">Back</button>
      </div>
      <div className="mx-auto max-w-lg px-4 py-4">
        <h1 className="font-display text-4xl leading-none">{name}</h1>
        <p className="mt-2 text-sm text-[var(--mute)]">
          {[post?.cuisine, post?.neighborhood, post?.distanceMiles != null ? `${Number(post.distanceMiles).toFixed(1)} mi` : null, post?.rating ? Number(post.rating).toFixed(1) : null].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-4 flex gap-2">
          {website && <a className="btn btn-primary inline-flex items-center" href={website} target="_blank" rel="noreferrer">Website</a>}
          {post?.phone && <a className="btn btn-quiet inline-flex items-center" href={`tel:${post.phone}`}>Call</a>}
          <button type="button" onClick={() => save('restaurant', name, 'want')} className="btn btn-quiet">Save</button>
        </div>
        {saveNote && <p className="text-sm text-amber-800 mt-2">{saveNote}</p>}
      </div>
      <div className="sticky top-0 z-20 mx-auto flex max-w-lg border-b border-[var(--line)] bg-[var(--paper)]" role="tablist" aria-label="Restaurant">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`min-h-11 flex-1 text-sm font-semibold ${tab === item ? 'border-b-2 border-[var(--brand)] text-[var(--brand)]' : 'text-[var(--mute)]'}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <section className="mx-auto max-w-lg space-y-3 p-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-200">
            <p className="text-sm">{post?.address || post?.location || 'Address not listed'}</p>
            {post?.hours && <p className="mt-2 text-sm">{post.hours}</p>}
          </div>
        </section>
      )}

      {tab === 'Menu' && (
        <section className="mx-auto max-w-lg space-y-3 p-4">
          <label className="sr-only" htmlFor="menu-search">Search this menu</label>
          <input id="menu-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="field" />
          {loading && <div className="skeleton h-24" />}
          {!loading && menu?.source === 'unavailable' && (
            <div className="py-8 text-center">
              <p>Menu not online.</p>
              {website && <a className="btn btn-primary mt-3 inline-flex items-center" href={website} target="_blank" rel="noreferrer">Website</a>}
            </div>
          )}
          {(menu?.worthOrdering || []).length > 0 && !query && (
            <div className="space-y-2">
              {menu.worthOrdering.map((item) => (
                <p key={item.name} className="flex justify-between text-sm"><span>{item.name}</span><span>{Number(item.community.score).toFixed(1)}</span></p>
              ))}
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sections.map((section) => (
              <button key={section.name} type="button" onClick={() => setOpenSections((current) => ({ ...current, [section.name]: true }))} className="shrink-0 min-h-11 px-3 rounded-full bg-white border border-gray-300 text-sm font-semibold">
                {section.name} ({section.items.length})
              </button>
            ))}
          </div>
          {sections.map((section) => {
            const open = query ? true : openSections[section.name]
            return (
              <div key={section.name} className="bg-white rounded-2xl border border-gray-200">
                <button type="button" className="w-full min-h-11 px-4 text-left font-semibold" aria-expanded={!!open} onClick={() => setOpenSections((current) => ({ ...current, [section.name]: !current[section.name] }))}>
                  {section.name} · {section.items.length}
                </button>
                {open && section.items.map((item) => (
                  <div key={item.name} className="px-4 py-3 border-t border-gray-100">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        {item.description && (
                          <button type="button" className={`mt-1 text-left text-sm text-[var(--mute)] ${expanded[item.name] ? '' : 'line-clamp-2'}`} aria-expanded={!!expanded[item.name]} onClick={() => setExpanded((current) => ({ ...current, [item.name]: !current[item.name] }))}>
                            {item.description}
                          </button>
                        )}
                        {Array.isArray(item.dietaryLabels) && item.dietaryLabels.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{item.dietaryLabels.map((tag) => tag.label).join(' · ')}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold">{formatPublishedPrice(item.price) || ''}</div>
                        <div className="text-xs text-[var(--mute)]">{item.community?.score != null ? Number(item.community.score).toFixed(1) : ''}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => setRatingDish(item.name)} className="min-h-11 px-3 rounded-full bg-amber-500 text-white text-sm font-semibold">Rate</button>
                      <button type="button" aria-label="Want to try" onClick={() => save('dish', item.name, 'want')} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)]"><Bookmark className="h-4 w-4" /></button>
                      <button type="button" aria-label="Visited" onClick={() => save('dish', item.name, 'visited')} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)]"><Check className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
          {(menu?.sourceUrl || menu?.fetchedAt) && (
            <div className="pt-6">
              <button type="button" aria-label="Menu source" onClick={() => setShowSource((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)]">
                <Info className="h-4 w-4" />
              </button>
              {showSource && (
                <p className="mt-2 text-xs text-[var(--mute)]">
                  {menu.fetchedAt ? String(menu.fetchedAt).slice(0, 10) : ''}
                  {menu.sourceUrl && <> · <a className="underline" href={menu.sourceUrl} target="_blank" rel="noreferrer">Source</a></>}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'Photos' && (
        <section className="p-4">
          {photos.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-200">
              <p>No photos.</p>
              <button type="button" onClick={() => setTab('Menu')} className="btn btn-primary mt-3">Rate</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo) => <img key={photo.src} src={photo.src} alt={photo.label || ''} className="h-36 w-full object-cover rounded-xl" />)}
            </div>
          )}
        </section>
      )}

      {tab === 'Reviews' && (
        <section className="p-4 space-y-2">
          {(menu?.reviews || []).length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-200">
              <p>No ratings.</p>
              <button type="button" onClick={() => setTab('Menu')} className="btn btn-primary mt-3">Rate</button>
            </div>
          ) : menu.reviews.map((review) => (
            <article key={review.id} className="bg-white rounded-2xl p-4 border border-gray-200">
              <p className="font-semibold">{review.dish} · {Number(review.rating).toFixed(1)} / 10</p>
              <p className="text-sm text-gray-600">{review.user?.name}</p>
              {review.note && <p className="text-sm mt-1">{review.note}</p>}
            </article>
          ))}
        </section>
      )}

      {ratingDish && (
        <DishRatingSheet
          dish={ratingDish}
          restaurant={name}
          area={post?.neighborhood || ''}
          onClose={() => setRatingDish(null)}
          onSaved={() => {
            setRatingDish(null)
            setNotice('')
          }}
        />
      )}
    </div>
  )
}
