import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { menuData as localMenuData } from '../menuData'
import { API_BASE } from '../config'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Store, UtensilsCrossed, Users, Shield,
  BarChart3, Sliders, DollarSign, Server, X, ChevronRight,
  Search, Edit3, Trash2, Eye, EyeOff, RefreshCw, CheckCircle,
  AlertCircle, TrendingUp, Star, MessageSquare, Zap, Award,
  Flag, ArrowUpRight, ArrowDownRight, ToggleLeft, ToggleRight,
  Save, Plus, Minus, Activity, Database, Wifi, WifiOff, Package,
  Clock, FileText, Image, Hash, ShieldOff, UserX, AlertTriangle
} from 'lucide-react'

/* ─── Font injection ─────────────────────────────────────────── */
const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Figtree:wght@300;400;500;600;700&display=swap');
  .admin-panel * { box-sizing: border-box; }
  .admin-panel { font-family: 'Figtree', sans-serif; }
  .admin-mono  { font-family: 'JetBrains Mono', monospace !important; }
  .admin-syne  { font-family: 'Syne', sans-serif !important; }
  .admin-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
  .admin-scroll::-webkit-scrollbar-track { background: transparent; }
  .admin-scroll::-webkit-scrollbar-thumb { background: #3f3f4e; border-radius: 4px; }
  @keyframes adminFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes adminPulse  { 0%,100% { opacity:1; } 50% { opacity:.5; } }
  .admin-fade { animation: adminFadeIn .22s ease forwards; }
  .admin-live-dot { animation: adminPulse 2s ease-in-out infinite; }
  .admin-bar { transition: width .6s cubic-bezier(.4,0,.2,1); }
  .admin-card-hover { transition: background .15s, border-color .15s, transform .15s; }
  .admin-card-hover:hover { background: #18181f !important; border-color: #3f3f4e !important; transform: translateY(-1px); }
  .admin-btn-amber {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #0d0d10; font-weight: 700; border: none; cursor: pointer;
    transition: opacity .15s, transform .1s;
  }
  .admin-btn-amber:hover { opacity:.9; transform:scale(1.02); }
  .admin-btn-ghost {
    background: transparent; color: #a1a1aa; border: 1px solid #27272f;
    cursor: pointer; transition: background .15s, color .15s, border-color .15s;
  }
  .admin-btn-ghost:hover { background: #18181f; color: #fafafa; border-color: #3f3f4e; }
  .admin-btn-danger { background: #f43f5e22; color: #f43f5e; border: 1px solid #f43f5e44; cursor:pointer; transition:.15s; }
  .admin-btn-danger:hover { background: #f43f5e33; }
  .admin-tag { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; cursor:pointer; transition: .15s; }
  .admin-input { background:#18181f; border:1px solid #27272f; color:#fafafa; border-radius:8px; padding:8px 12px; font-family:'Figtree',sans-serif; font-size:13px; outline:none; transition:border-color .15s; width:100%; }
  .admin-input:focus { border-color:#f59e0b; }
  .admin-input::placeholder { color:#52525b; }
  .admin-slider { -webkit-appearance:none; appearance:none; width:100%; height:4px; background:#27272f; border-radius:2px; outline:none; }
  .admin-slider::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:#f59e0b; cursor:pointer; }
  .admin-table th { font-family:'Syne',sans-serif; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#52525b; padding:10px 14px; }
  .admin-table td { padding:12px 14px; border-top:1px solid #18181f; font-size:13px; }
  .admin-table tr:hover td { background:#18181f44; }
`

/* ─── Colour tokens ──────────────────────────────────────────── */
const C = {
  bg:       '#09090b',
  surface:  '#111115',
  surface2: '#18181f',
  border:   '#27272f',
  text:     '#fafafa',
  text2:    '#a1a1aa',
  text3:    '#52525b',
  amber:    '#f59e0b',
  amberDim: '#d97706',
  emerald:  '#10b981',
  rose:     '#f43f5e',
  blue:     '#3b82f6',
  purple:   '#8b5cf6',
}

/* ─── Sidebar nav items ──────────────────────────────────────── */
const NAV = [
  { id: 'dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'restaurants',  label: 'Restaurants',   icon: Store           },
  { id: 'menu-items',   label: 'Menu Items',    icon: UtensilsCrossed },
  { id: 'users',        label: 'Users',         icon: Users           },
  { id: 'moderation',   label: 'Moderation',    icon: Shield          },
  { id: 'analytics',    label: 'Analytics',     icon: BarChart3       },
  { id: 'algorithm',    label: 'Algorithm',     icon: Sliders         },
  { id: 'monetization', label: 'Monetize',      icon: DollarSign      },
  { id: 'system',       label: 'System',        icon: Server          },
]

/* ─── Mini-component helpers ─────────────────────────────────── */
function StatCard({ label, value, sub, color = C.amber, icon: Icon, trend }) {
  return (
    <div className="admin-card-hover" style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '18px 20px', flex: 1, minWidth: 0
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform:'uppercase', color: C.text3, marginBottom: 8, fontFamily:'Syne,sans-serif' }}>{label}</div>
          <div className="admin-mono" style={{ fontSize: 28, fontWeight: 700, color: C.text, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: C.text2, marginTop: 5 }}>{sub}</div>}
        </div>
        {Icon && <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}22`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={18} color={color} />
        </div>}
      </div>
      {trend != null && (
        <div style={{ display:'flex', alignItems:'center', gap: 4, marginTop: 10, fontSize: 12 }}>
          {trend >= 0 ? <ArrowUpRight size={13} color={C.emerald} /> : <ArrowDownRight size={13} color={C.rose} />}
          <span style={{ color: trend >= 0 ? C.emerald : C.rose, fontWeight: 600 }}>{Math.abs(trend)}%</span>
          <span style={{ color: C.text3 }}>vs last week</span>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 className="admin-syne" style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function Toggle({ value, onChange, label, sub, color = C.amber }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:`1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}
      >
        {value
          ? <ToggleRight size={28} color={color} />
          : <ToggleLeft  size={28} color={C.text3} />}
      </button>
    </div>
  )
}

function Badge({ children, color = C.amber }) {
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700,
      fontFamily: 'Syne, sans-serif', letterSpacing: '.04em'
    }}>{children}</span>
  )
}

function BarChart({ data, maxVal, color = C.amber }) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 120, fontSize: 12, color: C.text2, textAlign:'right', flexShrink: 0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</div>
          <div style={{ flex: 1, height: 8, background: C.surface2, borderRadius: 4, overflow:'hidden' }}>
            <div className="admin-bar" style={{ height:'100%', width:`${(d.value/max)*100}%`, background: color, borderRadius: 4 }} />
          </div>
          <div className="admin-mono" style={{ fontSize: 12, color: C.text2, width: 36, textAlign:'right', flexShrink: 0 }}>{d.value}</div>
        </div>
      ))}
    </div>
  )
}

/* ─── Admin token helper ────────────────────────────────────── */
function adminToken() {
  return localStorage.getItem('admin-token') || 'dev-token-change-me'
}
function adminHeaders() {
  return { 'Content-Type': 'application/json', 'x-admin-token': adminToken() }
}

/* ─── Data helpers ───────────────────────────────────────────── */
function getAllDishRatings() {
  const result = {}
  try {
    Object.keys(localStorage).forEach(key => {
      if (!key.startsWith('dishRatings-')) return
      const restaurant = key.replace('dishRatings-', '')
      try { result[restaurant] = JSON.parse(localStorage.getItem(key) || '{}') } catch {}
    })
  } catch {}
  return result
}

function getCommunityPosts() {
  try { return JSON.parse(localStorage.getItem('community-posts') || '[]') } catch { return [] }
}

function getCachedRestaurants() {
  try {
    const yelp = JSON.parse(localStorage.getItem('nearby-yelp-restaurants') || '[]')
    if (yelp.length) return yelp
    const osm = JSON.parse(localStorage.getItem('osm-charlotte') || '[]')
    return osm
  } catch { return [] }
}

function getAlgoConfig() {
  try {
    return JSON.parse(localStorage.getItem('admin-algo-config') || 'null') || {
      ratingWeight: 70, recencyWeight: 20, popularityWeight: 10,
      trendingBoost: true, newDishBoost: true, bayesianSmoothing: true
    }
  } catch { return { ratingWeight: 70, recencyWeight: 20, popularityWeight: 10, trendingBoost: true, newDishBoost: true, bayesianSmoothing: true } }
}

function getMonoConfig() {
  try {
    return JSON.parse(localStorage.getItem('admin-mono-config') || 'null') || {
      featuredEnabled: false, boostEnabled: false, sponsoredBadge: false,
      adPlacements: false, featuredRestaurants: [], boostedDishes: []
    }
  } catch { return { featuredEnabled: false, boostEnabled: false, sponsoredBadge: false, adPlacements: false, featuredRestaurants: [], boostedDishes: [] } }
}

function getModerationData() {
  try { return JSON.parse(localStorage.getItem('admin-moderation') || 'null') || { flagged: [], banned: [], warned: [] } }
  catch { return { flagged: [], banned: [], warned: [] } }
}

/* ─── Main AdminPanel component ──────────────────────────────── */
export default function AdminPanel({ onClose }) {
  const { profile } = useAuth()
  
  // Only allow admins to access the panel
  if (!profile?.role || profile.role !== 'admin') {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 9999
      }}>
        <div style={{
          background: '#111115', border: '1px solid #27272f', borderRadius: 16,
          padding: '40px', textAlign: 'center', maxWidth: 400, backdropFilter: 'blur(8px)'
        }}>
          <Shield size={48} style={{ color: '#f43f5e', margin: '0 auto 20px', display: 'block' }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>
            Access Denied
          </h3>
          <p style={{ color: '#a1a1aa', margin: '12px 0 24px 0', fontSize: 14 }}>
            You don't have admin permissions to access this panel.
          </p>
          <button
            onClick={onClose}
            style={{
              background: '#f59e0b', color: '#0d0d10', border: 'none',
              borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', transition: '.15s'
            }}
            onMouseOver={(e) => e.target.style.opacity = '0.9'}
            onMouseOut={(e) => e.target.style.opacity = '1'}
          >
            Close
          </button>
        </div>
      </div>
    )
  }
  
  const [active, setActive] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [allRatings, setAllRatings] = useState({})
  const [cachedRestaurants, setCachedRestaurants] = useState([])
  const [communityPosts, setCommunityPosts] = useState([])
  const [algoConfig, setAlgoConfig] = useState(getAlgoConfig())
  const [monoConfig, setMonoConfig] = useState(getMonoConfig())
  const [moderation, setModeration] = useState(getModerationData())
  const [menuItemFlags, setMenuItemFlags] = useState([])
  const [reviewReports, setReviewReports] = useState([])
  const [moderationLoading, setModerationLoading] = useState(false)
  const [apiHealth, setApiHealth] = useState(null)
  const [searchQ, setSearchQ] = useState('')
  const [editingRestaurant, setEditingRestaurant] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [selectedRestaurantForItems, setSelectedRestaurantForItems] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // Server-loaded data
  const [dbRestaurants, setDbRestaurants] = useState([])
  const [dbUsers, setDbUsers] = useState([])
  const [dbRestaurantsLoading, setDbRestaurantsLoading] = useState(false)
  const [dbUsersLoading, setDbUsersLoading] = useState(false)

  /* Load data */
  useEffect(() => {
    setAllRatings(getAllDishRatings())
    setCachedRestaurants(getCachedRestaurants())
    setCommunityPosts(getCommunityPosts())
    checkApiHealth()
    fetchModerationQueue()
    loadAlgoFromServer()
    loadMonoFromServer()
    loadRestaurantsFromServer()
    loadUsersFromServer()
  }, [])

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  async function checkApiHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) })
      setApiHealth(res.ok)
    } catch { setApiHealth(false) }
  }

  async function fetchModerationQueue() {
    setModerationLoading(true)
    try {
      const [flagsRes, reportsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/menu-item-flags`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/admin/review-reports`, { credentials: 'include' })
      ])

      if (flagsRes.ok) {
        const flagsJson = await flagsRes.json()
        setMenuItemFlags(Array.isArray(flagsJson?.flags) ? flagsJson.flags : [])
      } else {
        const queued = JSON.parse(localStorage.getItem('menu-item-flag-queue') || '[]')
        setMenuItemFlags(Array.isArray(queued) ? queued : [])
      }

      if (reportsRes.ok) {
        const reportsJson = await reportsRes.json()
        setReviewReports(Array.isArray(reportsJson?.reports) ? reportsJson.reports : [])
      } else {
        const queued = JSON.parse(localStorage.getItem('review-report-queue') || '[]')
        setReviewReports(Array.isArray(queued) ? queued : [])
      }
    } catch (e) {
      try {
        const queuedFlags = JSON.parse(localStorage.getItem('menu-item-flag-queue') || '[]')
        setMenuItemFlags(Array.isArray(queuedFlags) ? queuedFlags : [])
      } catch {}
      try {
        const queuedReports = JSON.parse(localStorage.getItem('review-report-queue') || '[]')
        setReviewReports(Array.isArray(queuedReports) ? queuedReports : [])
      } catch {}
    } finally {
      setModerationLoading(false)
    }
  }

  async function loadAlgoFromServer() {
    try {
      const res = await fetch(`${API_BASE}/admin/config/algorithm`, { headers: adminHeaders() })
      if (res.ok) {
        const cfg = await res.json()
        setAlgoConfig(cfg)
        localStorage.setItem('admin-algo-config', JSON.stringify(cfg))
      }
    } catch {}
  }

  async function loadMonoFromServer() {
    try {
      const res = await fetch(`${API_BASE}/admin/config/monetization`, { headers: adminHeaders() })
      if (res.ok) {
        const cfg = await res.json()
        setMonoConfig(cfg)
        localStorage.setItem('admin-mono-config', JSON.stringify(cfg))
      }
    } catch {}
  }

  async function loadRestaurantsFromServer() {
    setDbRestaurantsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants`, { headers: adminHeaders() })
      if (res.ok) {
        const { restaurants } = await res.json()
        setDbRestaurants(restaurants || [])
      }
    } catch {} finally {
      setDbRestaurantsLoading(false)
    }
  }

  async function loadUsersFromServer() {
    setDbUsersLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/users`, { headers: adminHeaders() })
      if (res.ok) {
        const { users } = await res.json()
        setDbUsers(users || [])
      }
    } catch {} finally {
      setDbUsersLoading(false)
    }
  }

  const saveAlgo = async (cfg) => {
    setAlgoConfig(cfg)
    localStorage.setItem('admin-algo-config', JSON.stringify(cfg))
    window.dispatchEvent(new Event('algoConfigChanged'))
    try {
      const res = await fetch(`${API_BASE}/admin/config/algorithm`, {
        method: 'POST', headers: adminHeaders(), body: JSON.stringify(cfg)
      })
      showToast(res.ok ? 'Algorithm config saved to server' : 'Saved locally (server error)')
    } catch {
      showToast('Saved locally (server offline)')
    }
  }

  const saveMono = async (cfg) => {
    setMonoConfig(cfg)
    localStorage.setItem('admin-mono-config', JSON.stringify(cfg))
    try {
      const res = await fetch(`${API_BASE}/admin/config/monetization`, {
        method: 'POST', headers: adminHeaders(), body: JSON.stringify(cfg)
      })
      showToast(res.ok ? 'Monetization config saved to server' : 'Saved locally (server error)')
    } catch {
      showToast('Saved locally (server offline)')
    }
  }

  const saveMod = (data) => {
    setModeration(data)
    localStorage.setItem('admin-moderation', JSON.stringify(data))
  }

  /* ── Derived analytics ── */
  const analytics = useMemo(() => {
    let totalDishes = 0, totalReviews = 0, totalRatingSum = 0
    const dishList = []
    const restaurantActivity = {}

    Object.entries(allRatings).forEach(([restaurant, dishes]) => {
      let rCount = 0
      Object.entries(dishes).forEach(([dish, data]) => {
        const reviews = data?.reviews?.length ?? data?.count ?? 0
        const avg = data?.average ?? 0
        totalDishes++
        totalReviews += reviews
        totalRatingSum += avg * reviews
        rCount += reviews
        if (reviews > 0) dishList.push({ name: dish, restaurant, reviews, avg })
      })
      restaurantActivity[restaurant] = rCount
    })

    const avgRating = totalReviews > 0 ? (totalRatingSum / totalReviews) : 0
    const topDishes = [...dishList].sort((a,b) => b.reviews - a.reviews).slice(0, 10)
    const topRestaurants = Object.entries(restaurantActivity)
      .sort(([,a],[,b]) => b-a).slice(0, 8)
      .map(([name, count]) => ({ label: name, value: count }))
    const highestRated = [...dishList].sort((a,b) => b.avg - a.avg).slice(0, 5)

    const posts = communityPosts
    const today = new Date(); today.setHours(0,0,0,0)
    const todayPosts = posts.filter(p => p.timestamp && new Date(p.timestamp) >= today).length
    const weekAgo = new Date(Date.now() - 7*24*60*60*1000)
    const weekPosts = posts.filter(p => p.timestamp && new Date(p.timestamp) >= weekAgo).length

    return { totalDishes, totalReviews, avgRating, topDishes, topRestaurants, highestRated, todayPosts, weekPosts }
  }, [allRatings, communityPosts])

  const localRestaurantNames = Object.keys(localMenuData)
  // allKnownRestaurants: used for Dashboard stats (merge DB + local + cached)
  const allKnownRestaurants = useMemo(() => {
    const set = new Map()
    dbRestaurants.forEach(r => set.set(r.name, { ...r, source: 'db' }))
    localRestaurantNames.forEach(name => {
      if (!set.has(name)) set.set(name, { name, source: 'local', items: localMenuData[name]?.length ?? 0 })
    })
    cachedRestaurants.forEach(r => {
      if (!set.has(r.name)) set.set(r.name, { name: r.name, source: 'yelp', items: r.menu?.length ?? 0, ...r })
    })
    return Array.from(set.values())
  }, [dbRestaurants, cachedRestaurants, localRestaurantNames])

  /* ── Sidebar ── */
  const Sidebar = () => (
    <div style={{
      width: sidebarOpen ? 220 : 60, flexShrink: 0, background: C.surface,
      borderRight: `1px solid ${C.border}`, display:'flex', flexDirection:'column',
      transition: 'width .2s ease', overflow:'hidden', height:'100%'
    }}>
      {/* Logo */}
      <div style={{ padding: sidebarOpen ? '20px 20px 16px' : '20px 16px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${C.amber},${C.amberDim})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>🔥</span>
        </div>
        {sidebarOpen && <div>
          <div className="admin-syne" style={{ fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1 }}>TasteTrails</div>
          <div style={{ fontSize: 10, color: C.amber, fontWeight: 700, letterSpacing:'.1em', textTransform:'uppercase' }}>Admin</div>
        </div>}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY:'auto' }} className="admin-scroll">
        {NAV.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button key={id} onClick={() => setActive(id)} style={{
              display:'flex', alignItems:'center', gap: 10, width:'100%',
              padding: sidebarOpen ? '10px 12px' : '10px', borderRadius: 8,
              background: isActive ? `${C.amber}18` : 'transparent',
              border: isActive ? `1px solid ${C.amber}44` : '1px solid transparent',
              color: isActive ? C.amber : C.text2, cursor:'pointer', marginBottom: 2,
              transition: '.15s', justifyContent: sidebarOpen ? 'flex-start' : 'center'
            }}>
              <Icon size={16} />
              {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 600, whiteSpace:'nowrap' }}>{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button onClick={() => setSidebarOpen(p=>!p)} style={{
        margin: 8, padding: 10, borderRadius: 8, background:'transparent',
        border:`1px solid ${C.border}`, color: C.text3, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', transition:'.15s'
      }}>
        <ChevronRight size={14} style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'none', transition:'.2s' }} />
      </button>
    </div>
  )

  /* ══════════════════════════════════════════════════════
     SECTION: DASHBOARD
  ══════════════════════════════════════════════════════ */
  const DashboardSection = () => (
    <div className="admin-fade">
      <SectionHeader title="Dashboard" sub="Platform overview at a glance" />

      <div style={{ display:'flex', gap: 12, marginBottom: 20, flexWrap:'wrap' }}>
        <StatCard label="Restaurants" value={allKnownRestaurants.length} icon={Store} color={C.amber} sub={`${localRestaurantNames.length} with local menus`} trend={12} />
        <StatCard label="Total Reviews" value={analytics.totalReviews} icon={Star} color={C.purple} sub="Across all dishes" trend={analytics.weekPosts > 0 ? 8 : 0} />
        <StatCard label="Avg Rating" value={analytics.avgRating > 0 ? analytics.avgRating.toFixed(2) : '—'} icon={Award} color={C.emerald} sub="Platform-wide" />
        <StatCard label="Community Posts" value={communityPosts.length} icon={MessageSquare} color={C.blue} sub={`+${analytics.todayPosts} today`} trend={analytics.weekPosts > 0 ? 5 : 0} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Recent Activity */}
        <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 14 }}>Recent Activity</div>
          {communityPosts.slice(0, 6).length > 0 ? communityPosts.slice(0, 6).map((p, i) => (
            <div key={i} style={{ display:'flex', gap: 10, alignItems:'center', padding:'8px 0', borderBottom: i < 5 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius:'50%', background: C.amber, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {p.user?.name || 'Unknown'} rated <span style={{ color: C.amber }}>{p.dish || 'a dish'}</span>
                </div>
                <div style={{ fontSize: 11, color: C.text3 }}>{p.restaurant}</div>
              </div>
              {p.rating > 0 && <Badge color={p.rating >= 8 ? C.emerald : C.amber}>{p.rating}/10</Badge>}
            </div>
          )) : (
            <div style={{ fontSize: 13, color: C.text3, textAlign:'center', padding: 20 }}>No activity yet</div>
          )}
        </div>

        {/* Top Restaurants */}
        <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 14 }}>Top by Reviews</div>
          {analytics.topRestaurants.length > 0 ? (
            <BarChart data={analytics.topRestaurants.slice(0,6)} color={C.amber} />
          ) : (
            <div style={{ fontSize: 13, color: C.text3, textAlign:'center', padding: 20 }}>Rate some dishes to see data</div>
          )}
        </div>
      </div>

      {/* System status strip */}
      <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding:'14px 20px', display:'flex', alignItems:'center', gap: 24, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <div className={`admin-live-dot`} style={{ width: 8, height: 8, borderRadius:'50%', background: apiHealth === true ? C.emerald : apiHealth === false ? C.rose : C.amber }} />
          <span style={{ fontSize: 12, color: C.text2 }}>Backend: <span style={{ color: apiHealth === true ? C.emerald : apiHealth === false ? C.rose : C.amber, fontWeight: 600 }}>{apiHealth === null ? 'Checking…' : apiHealth ? 'Online' : 'Offline'}</span></span>
        </div>
        <div style={{ fontSize: 12, color: C.text2 }}>Local menus: <span className="admin-mono" style={{ color: C.text }}>{localRestaurantNames.length}</span></div>
        <div style={{ fontSize: 12, color: C.text2 }}>Cached restaurants: <span className="admin-mono" style={{ color: C.text }}>{cachedRestaurants.length}</span></div>
        <div style={{ fontSize: 12, color: C.text2 }}>localStorage used: <span className="admin-mono" style={{ color: C.text }}>{(JSON.stringify(localStorage).length / 1024).toFixed(1)} KB</span></div>
      </div>
    </div>
  )

  /* ══════════════════════════════════════════════════════
        const [scrapingId, setScrapingId] = useState(null)
 SECTION: RESTAURANTS
  ══════════════════════════════════════════════════════ */
  const RestaurantsSection = () => {
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({})
    const [hidden, setHidden] = useState(() => {
      try { return JSON.parse(localStorage.getItem('admin-hidden-restaurants') || '[]') } catch { return [] }
    })

    const toggleHidden = (name) => {
      const next = hidden.includes(name) ? hidden.filter(n => n !== name) : [...hidden, name]
      setHidden(next)
      localStorage.setItem('admin-hidden-restaurants', JSON.stringify(next))
      showToast(hidden.includes(name) ? 'Restaurant shown' : 'Restaurant hidden')
    }

    const startEdit = (r) => {
      setEditing(r.name)
      const saved = JSON.parse(localStorage.getItem(`admin-restaurant-overrides`) || '{}')
      setForm({ name: r.name, description: saved[r.name]?.description || '', heroImage: saved[r.name]?.heroImage || '        website: form.website,
        lunch_url: form.lunch_url,
        dinner_url: form.dinner_url,
        drinks_url: form.drinks_url,
        pdf_url: form.pdf_url,
', ...saved[r.name] })
    }

    const saveEdit = () => {
      const overrides = JSON.parse(localStorage.getItem('admin-restaurant-overrides') || '{}')
      overrides[editing] = { ...overrides[editing], ...form }
      localStorage.setItem('admin-restaurant-overrides', JSON.stringify(overrides))
      window.dispatchEvent(new Event('restaurantOverridesChanged'))
      setEditing(null)
      showToast('Restaurant saved')
    }

    const scrapeNow = async (r) => {
      if (!r.id) { showToast('Only DB restaurants can be scraped'); return }
      setScrapingId(r.id)
      try {
        const res = await fetch(`${API_BASE}/admin/restaurants/${r.id}/scrape`, {
          method: 'POST', headers: adminHeaders()
        })
        const data = await res.json()
        if (res.ok) {
          showToast(`Scrape queued for ${r.name}`)
        } else {
          showToast(`Error: ${data.error}`)
        }
      } catch {
        showToast('Server offline — could not queue scrape')
      } finally {
        setScrapingId(null)
      }
    }

    const addRestaurant = async () => {
      if (!newForm.name.trim()) { showToast('Name is required'); return }
      setAddingSaving(true)
      try {
        const res = await fetch(`${API_BASE}/admin/restaurants`, {
          method: 'POST', headers: adminHeaders(), body: JSON.stringify(newForm)
        })
        if (res.ok) {
          const { restaurant } = await res.json()
          setDbRestaurants(prev => [restaurant, ...prev])
          setNewForm({ name: '', address: '', city: '', state: '', cuisine: '', cover_photo_url: '', website: '', lunch_url: '', dinner_url: '', drinks_url: '', pdf_url: '' })
          setAddingNew(false)
          showToast('Restaurant added!')
        } else {
          const { error } = await res.json()
          showToast(`Error: ${error}`)
        }
      } catch (err) {
        showToast('Server offline — could not add restaurant')
      } finally {
        setAddingSaving(false)
      }
    }

    return (
      <div className="admin-fade">
        <SectionHeader title="Restaurant Manager" sub={`${filteredRestaurants.length} restaurants • ${localRestaurantNames.length} with local menus`} />

        <div style={{ marginBottom: 16 }}>
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:          <button className="admin-btn-amber" style={{ padding:'8px 14px', borderRadius: 8, fontSize: 12, display:'flex', alignItems:'center', gap: 6, flexShrink: 0 }} onClick={() => { setAddingNew(true); setEditing(null) }}>
            <Plus size={12} />Add Restaurant
          </button>
'absolute', left: 12, top:'50%', transform:'translateY(-50%)', color: C.text3 }} />
            <input className="admin-input" style={{ paddingLeft: 34 }} placeholder="Search restaurants…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          </div>
        </div>

        {editing ? (
          <div style={{ background: C.surface, border:`1px solid ${C.amber}44`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16 }}>
              <div className="admin-syne" style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Edit: {editing}</div>
              <button className="admin-btn-ghost" style={{ padding:'6px 12px', borderRadius: 6, fontSize: 12 }} onClick={() => setEditing(null)}>Cancel</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 6 }}>DISPLAY NAME</label>
                <input className="admin-input" value={form.name || ''} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 6 }}>HERO IMAGE URL</label>
                <input className="admin-input" value={form.heroImage || ''} onChange={e => setForm(p => ({...p, heroImage: e.target.value}))} placeholder="https://…" />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 6 }}>DESCRIPTION</label>
                <textarea className="admin-input" value={form.description || ''} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={3} style={{ resize:'vertical', fontFamily:'Figtree,sans-serif' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap: 8, marginTop: 14 }}>
              <button className="admin-btn-amber" style={{ padding:'8px 18px', borderRadius: 8, fontSize: 13 }} onClick={saveEdit}>
                <Save size={13} style={{ display:'inline', marginRight: 6 }} />Save Changes
              </button>
              {editingId && (
                <button
                  className="admin-btn-ghost"
                  style={{ padding:'8px 18px', borderRadius: 8, fontSize: 13, display:'flex', alignItems:'center', gap: 6 }}
                  disabled={saving || scrapingId === editingId}
                  onClick={async () => {
                    await saveEdit()
                    await scrapeNow({ id: editingId, name: form.name })
                  }}
                >
                  <RefreshCw size={13} />
                  {scrapingId === editingId ? 'Queuing…' : 'Save & Scrape'}
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }} className="admin-table">
            <thead style={{ background: C.surface2 }}>
              <tr>
                <th style={{ textAlign:'left' }}>Restaurant</th>
                <th style={{ textAlign:'center' }}>Source</th>
                <th style={{ textAlign:'center' }}>Items</th>
                <th style={{ textAlign:'center' }}>Reviews</th>
                <th style={{ textAlign:'center' }}>Status</th>
                <th style={{ textAlign:'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRestaurants.map((r, i) => {
                const restaurantRatings = allRatings[r.name] || {}
                const reviewCount = Object.values(restaurantRatings).reduce((s, d) => s + (d?.count || 0), 0)
                const isHidden = hidden.includes(r.name)
                const hasMenu = r.source === 'local' || (r.menu?.length > 0)
                return (
                  <tr key={i} style={{ opacity: isHidden ? .45 : 1 }}>
                    <td>
                      <div style={{ fontWeight: 600, color: C.text }}>{r.name}</div>
                      {r.address && <div style={{ fontSize: 11, color: C.text3 }}>{r.address}</div>}
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <Badge color={r.source === 'local' ? C.emerald : C.blue}>{r.source === 'local' ? 'Local' : 'Yelp'}</Badge>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <span className="admin-mono" style={{ fontSize: 13, color: hasMenu ? C.text : C.rose }}>
                        {r.source === 'local' ? localMenuData[r.name]?.length || 0 : r.items || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <span className="admin-mono" style={{ fontSize: 13, color: C.text2 }}>{reviewCount}</span>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <Badge color={isHidden ? C.text3 : C.emerald}>{isHidden ? 'Hidden' : 'Active'}</Badge>
                    </td>
                    <td style={{ textAlign:'right' }}>
                      <div style={{ display:'flex', gap: 6, justifyContent:'flex-end' }}>
                        <button title="Edit" className="admin-btn-ghost" style={{ padding:'5px 8px', borderRadius: 6, fontSize: 11 }} onClick={() => { startEdit(r); setSelectedRestaurantForItems(r.name) }}>
                          <Edit3 size={12} />
                        </button>
                        <button title={isHidden ? 'Show' : 'Hide'} className="admin-btn-ghost" style={{ padding:'5px 8px', borderRadius: 6, fontSize: 11 }} onClick={() => toggleHidden(r.name)}>
                          {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button title="View menu items" className="admin-btn-ghost" style={{ padding:'5px 8px', borderRadius: 6, fontSize: 11 }} onClick={() => { setSelectedRestaurantForItems(r.name); setActive('menu-items') }}>
                          <UtensilsCrossed size={12} />
                        </button>
                        {r.id && (
                          <button
                            title={r.website || r.dinner_url || r.lunch_url ? 'Scrape menu using saved URL' : 'Scrape menu (will discover URL)'}
                            className="admin-btn-ghost"
                            style={{ padding:'5px 8px', borderRadius: 6, fontSize: 11, opacity: scrapingId === r.id ? 0.5 : 1 }}
                            disabled={scrapingId === r.id}
                            onClick={() => scrapeNow(r)}
                          >
                            <RefreshCw size={12} style={scrapingId === r.id ? { animation:'spin 1s linear infinite' } : {}} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     SECTION: MENU ITEMS
  ══════════════════════════════════════════════════════ */
  const MenuItemsSection = () => {
    const selRestaurant = selectedRestaurantForItems || null
    const setSelRestaurant = useCallback((nextRestaurant) => {
      setSelectedRestaurantForItems(nextRestaurant || null)
    }, [setSelectedRestaurantForItems])
    const [items, setItems] = useState([])
    const [itemsLoading, setItemsLoading] = useState(false)
    const [editItem, setEditItem] = useState(null)
    const [editItemId, setEditItemId] = useState(null)
    const [itemForm, setItemForm] = useState({})
    const [addingNew, setAddingNew] = useState(false)
    const [newItemForm, setNewItemForm] = useState({ name: '', description: '', price: '', section_name: '', category: '' })
    const [saving, setSaving] = useState(false)
    const [quickSectionSavingKey, setQuickSectionSavingKey] = useState(null)
    const [sectionFilter, setSectionFilter] = useState('all')
    const [sortMode, setSortMode] = useState('course')
    const [editSaveState, setEditSaveState] = useState('idle')
    const MENU_DISPLAY_PREF_KEY_PREFIX = 'admin-menu-display-prefs-'
    const MENU_SNAPSHOT_KEY_PREFIX = 'admin-menu-snapshot-'
    const autoSaveTimerRef = useRef(null)
    const lastSavedItemSnapshotRef = useRef('')
    const editLookupNameRef = useRef('')

    const menuDisplayPrefKeys = useMemo(() => {
      if (!selRestaurant) return []
      const keys = [String(selRestaurant).trim()]
      const matchedRestaurant = dbRestaurants.find((restaurant) => restaurant.id === selRestaurant)
      if (matchedRestaurant?.name) keys.push(String(matchedRestaurant.name).trim())
      return [...new Set(keys.filter(Boolean))]
    }, [dbRestaurants, selRestaurant])

    const menuOverrideKeys = useMemo(() => {
      if (!selRestaurant) return []
      const keys = [String(selRestaurant).trim()]
      const matchedRestaurant = dbRestaurants.find((restaurant) => restaurant.id === selRestaurant)
      if (matchedRestaurant?.name) keys.push(String(matchedRestaurant.name).trim())
      return [...new Set(keys.filter(Boolean))]
    }, [dbRestaurants, selRestaurant])

    const readMenuApprovalState = useCallback(() => {
      if (!selRestaurant || menuOverrideKeys.length === 0) return { approvedItems: {}, approvedAt: '' }
      const approvedItems = {}
      let approvedAt = ''

      for (const key of menuOverrideKeys) {
        const storageKey = `admin-menu-approval-${key}`
        const parsed = (() => {
          try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
        })()
        const record = parsed && typeof parsed === 'object' ? parsed : {}
        const map = record?.approvedItems && typeof record.approvedItems === 'object' ? record.approvedItems : {}
        for (const [itemKey, value] of Object.entries(map)) {
          if (!itemKey || !value || typeof value !== 'object') continue
          approvedItems[itemKey] = { ...(approvedItems[itemKey] || {}), ...value }
        }
        const candidateApprovedAt = String(record?.approvedAt || '').trim()
        if (candidateApprovedAt && (!approvedAt || candidateApprovedAt > approvedAt)) {
          approvedAt = candidateApprovedAt
        }
      }

      return { approvedItems, approvedAt }
    }, [menuOverrideKeys, selRestaurant])

    const [approvedItemsByKey, setApprovedItemsByKey] = useState({})
    const [menuApprovedAt, setMenuApprovedAt] = useState('')
    const [approvingFullMenu, setApprovingFullMenu] = useState(false)
    const [resettingSections, setResettingSections] = useState(false)

    const getApprovalItemKey = useCallback((item) => {
      const itemId = String(item?.id || '').trim()
      if (itemId) return `id:${itemId}`
      const itemName = String(item?.name || '').trim().toLowerCase()
      if (itemName) return `name:${itemName}`
      return ''
    }, [])

    const writeMenuApprovalState = useCallback((nextApprovedItems, approvedAt = '') => {
      if (!selRestaurant || menuOverrideKeys.length === 0) return
      const payload = JSON.stringify({
        approvedItems: nextApprovedItems && typeof nextApprovedItems === 'object' ? nextApprovedItems : {},
        approvedAt: String(approvedAt || '').trim()
      })
      for (const key of menuOverrideKeys) {
        localStorage.setItem(`admin-menu-approval-${key}`, payload)
      }
      window.dispatchEvent(new Event('adminMenuApprovalChanged'))
    }, [menuOverrideKeys, selRestaurant])

    const isItemApproved = useCallback((item) => {
      const approvalKey = getApprovalItemKey(item)
      if (!approvalKey) return false
      return Boolean(approvedItemsByKey?.[approvalKey]?.approved)
    }, [approvedItemsByKey, getApprovalItemKey])

    const approvedItemCount = useMemo(() => {
      if (!Array.isArray(items) || items.length === 0) return 0
      return items.reduce((count, item) => (isItemApproved(item) ? count + 1 : count), 0)
    }, [isItemApproved, items])

    const allItemsApproved = items.length > 0 && approvedItemCount === items.length

    const approveWholeMenu = useCallback(() => {
      if (!selRestaurant || items.length === 0) return
      const confirmed = window.confirm(`Approve all ${items.length} menu items for this restaurant?`)
      if (!confirmed) return

      setApprovingFullMenu(true)
      try {
        const approvedAt = new Date().toISOString()
        const nextApprovedItems = {}
        for (const item of items) {
          const key = getApprovalItemKey(item)
          if (!key) continue
          nextApprovedItems[key] = {
            approved: true,
            approvedAt,
            name: item?.name || ''
          }
        }

        // Snapshot current section assignments for every item so user-side grouping
        // stays aligned with the approved admin categorization.
        for (const key of menuOverrideKeys) {
          const storageKey = `admin-item-overrides-${key}`
          const overrides = (() => {
            try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
          })()

          for (const item of items) {
            const itemName = String(item?.name || '').trim()
            if (!itemName) continue

            const sectionName = String(item?.section_name || item?.category || 'Uncategorized').trim() || 'Uncategorized'
            const patch = {
              name: itemName,
              section_name: sectionName,
              category: sectionName
            }

            overrides[itemName] = { ...(overrides[itemName] || {}), ...patch }

            const itemId = String(item?.id || '').trim()
            if (itemId) {
              const idKey = `__id:${itemId}`
              overrides[idKey] = { ...(overrides[idKey] || {}), ...patch }
            }
          }

          localStorage.setItem(storageKey, JSON.stringify(overrides))
        }

        setApprovedItemsByKey(nextApprovedItems)
        setMenuApprovedAt(approvedAt)
        writeMenuApprovalState(nextApprovedItems, approvedAt)
        window.dispatchEvent(new Event('itemOverridesChanged'))
        showToast(`Approved ${items.length} menu items and locked current sections`)
      } finally {
        setApprovingFullMenu(false)
      }
    }, [getApprovalItemKey, items, menuOverrideKeys, selRestaurant, showToast, writeMenuApprovalState])

    const persistMenuSnapshot = useCallback((sourceItems = items) => {
      if (!selRestaurant || menuOverrideKeys.length === 0 || itemsLoading) return
      const normalizedItems = (Array.isArray(sourceItems) ? sourceItems : []).map((item) => {
        const section = String(item?.section_name || item?.category || 'Uncategorized').trim() || 'Uncategorized'
        return {
          ...item,
          section_name: section,
          category: section
        }
      })
      const payload = JSON.stringify({
        savedAt: new Date().toISOString(),
        items: normalizedItems
      })
      for (const key of menuOverrideKeys) {
        localStorage.setItem(`${MENU_SNAPSHOT_KEY_PREFIX}${key}`, payload)
      }
      window.dispatchEvent(new Event('adminMenuSnapshotChanged'))
    }, [items, itemsLoading, menuOverrideKeys, selRestaurant])

    const resetAllSectionsToUncategorized = useCallback(async () => {
      if (!selRestaurant || items.length === 0) return
      const confirmed = window.confirm(`Reset all ${items.length} items to "Uncategorized"?`)
      if (!confirmed) return

      const nextSection = 'Uncategorized'
      const sectionPayload = { section_name: nextSection, category: nextSection }
      const nextItems = items.map((item) => ({ ...item, ...sectionPayload }))

      setResettingSections(true)
      setItems(nextItems)
      if (editItem) {
        setItemForm((prev) => ({ ...prev, section_name: nextSection, category: nextSection }))
      }

      try {
        const isUUID = /^[0-9a-f-]{36}$/i.test(String(selRestaurant || ''))
        const dbItems = isUUID ? items.filter((item) => String(item?.id || '').trim()) : []

        if (dbItems.length > 0) {
          const settled = await Promise.allSettled(
            dbItems.map((item) => fetch(`${API_BASE}/admin/menu-items/${item.id}`, {
              method: 'PUT',
              headers: adminHeaders(),
              body: JSON.stringify(sectionPayload)
            }))
          )

          const failedCount = settled.reduce((count, result) => {
            if (result.status === 'rejected') return count + 1
            return result.value?.ok ? count : count + 1
          }, 0)

          if (failedCount > 0) {
            showToast(`Reset locally for all items (${failedCount} server save failures)`)
          } else {
            showToast(`Reset ${items.length} items to Uncategorized`)
          }
        } else {
          showToast(`Reset ${items.length} items to Uncategorized`)
        }
      } catch {
        showToast('Reset applied locally (server offline)')
      } finally {
        for (const key of menuOverrideKeys) {
          const storageKey = `admin-item-overrides-${key}`
          const overrides = (() => {
            try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
          })()

          for (const item of nextItems) {
            const itemName = String(item?.name || '').trim()
            if (!itemName) continue

            const patch = {
              name: itemName,
              section_name: nextSection,
              category: nextSection
            }

            overrides[itemName] = { ...(overrides[itemName] || {}), ...patch }
            const itemId = String(item?.id || '').trim()
            if (itemId) {
              const idKey = `__id:${itemId}`
              overrides[idKey] = { ...(overrides[idKey] || {}), ...patch }
            }
          }

          localStorage.setItem(storageKey, JSON.stringify(overrides))
        }

        window.dispatchEvent(new Event('itemOverridesChanged'))
        persistMenuSnapshot(nextItems)
        setResettingSections(false)
      }
    }, [adminHeaders, editItem, items, menuOverrideKeys, persistMenuSnapshot, selRestaurant, showToast])

    const readUserMenuOverrides = useCallback(() => {
      if (!selRestaurant || menuOverrideKeys.length === 0) return { byName: {}, byId: {} }
      const byName = {}
      const byId = {}
      for (const key of menuOverrideKeys) {
        const storageKey = `admin-item-overrides-${key}`
        const overrides = (() => {
          try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
        })()
        for (const [entryKey, patch] of Object.entries(overrides || {})) {
          if (!entryKey || !patch || typeof patch !== 'object') continue
          if (String(entryKey).startsWith('__id:')) {
            const itemId = String(entryKey).slice(5).trim()
            if (!itemId) continue
            byId[itemId] = { ...(byId[itemId] || {}), ...patch }
            continue
          }
          byName[entryKey] = { ...(byName[entryKey] || {}), ...patch }
        }
      }
      return { byName, byId }
    }, [menuOverrideKeys, selRestaurant])

    const applyUserMenuOverrides = useCallback((rawItems = []) => {
      const overrides = readUserMenuOverrides()
      if (!Array.isArray(rawItems) || rawItems.length === 0) return []
      const byName = overrides?.byName || {}
      const byId = overrides?.byId || {}
      if (Object.keys(byName).length === 0 && Object.keys(byId).length === 0) return rawItems

      return rawItems.map((item) => {
        const itemId = String(item?.id || '').trim()
        const itemName = String(item?.name || '').trim()
        const patch = (itemId && byId[itemId]) || byName[itemName]
        if (!patch || typeof patch !== 'object') return item
        const next = { ...item, ...patch }
        if (patch.section_name && !patch.category) next.category = patch.section_name
        if (!patch.section_name && patch.category) next.section_name = patch.category
        return next
      })
    }, [readUserMenuOverrides])

    const syncUserMenuOverride = useCallback(({ lookupName, nextName, patch, itemId = null }) => {
      if (!selRestaurant || menuOverrideKeys.length === 0 || !patch || typeof patch !== 'object') return
      const fromName = String(lookupName || '').trim()
      const toName = String(nextName || fromName || '').trim()
      if (!toName) return
      const normalizedItemId = String(itemId || '').trim()
      const idKey = normalizedItemId ? `__id:${normalizedItemId}` : ''

      for (const key of menuOverrideKeys) {
        const storageKey = `admin-item-overrides-${key}`
        const overrides = (() => {
          try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
        })()
        if (fromName && fromName !== toName) {
          overrides[fromName] = { ...(overrides[fromName] || {}), ...patch, name: toName }
        }
        overrides[toName] = { ...(overrides[toName] || {}), ...patch }
        if (idKey) {
          overrides[idKey] = { ...(overrides[idKey] || {}), ...patch, name: toName }
        }
        localStorage.setItem(storageKey, JSON.stringify(overrides))
      }

      window.dispatchEvent(new Event('itemOverridesChanged'))
    }, [menuOverrideKeys, selRestaurant])

    const saveDisplayPrefs = useCallback((nextSortMode, nextSectionFilter) => {
      if (!selRestaurant || menuDisplayPrefKeys.length === 0) return
      const payload = JSON.stringify({
        sortMode: String(nextSortMode || 'course'),
        sectionFilter: String(nextSectionFilter || 'all')
      })
      for (const key of menuDisplayPrefKeys) {
        localStorage.setItem(`${MENU_DISPLAY_PREF_KEY_PREFIX}${key}`, payload)
      }
      window.dispatchEvent(new Event('adminMenuPrefsChanged'))
    }, [menuDisplayPrefKeys, selRestaurant])

    const handleSortModeChange = useCallback((value) => {
      const nextSortMode = value || 'course'
      setSortMode(nextSortMode)
      saveDisplayPrefs(nextSortMode, sectionFilter)
    }, [saveDisplayPrefs, sectionFilter])

    const handleSectionFilterChange = useCallback((value) => {
      const nextSectionFilter = value || 'all'
      setSectionFilter(nextSectionFilter)
      saveDisplayPrefs(sortMode, nextSectionFilter)
    }, [saveDisplayPrefs, sortMode])

    const sectionCourseOrder = useMemo(() => ([
      { rank: 1, regex: /(to start|starter|starters|appetizer|appetizers|small plate|small plates|raw|shared|shareables?)/i },
      { rank: 2, regex: /(soup|soups|salad|salads)/i },
      { rank: 3, regex: /(sandwich|sandwiches|burger|burgers|taco|tacos|wrap|wraps)/i },
      { rank: 4, regex: /(entree|entrees|main|mains|pasta|pastas|pizza|pizzas|grill|from the grill|signature)/i },
      { rank: 5, regex: /(vegetable|vegetables|side|sides)/i },
      { rank: 6, regex: /(dessert|desserts|sweet|sweets)/i },
      { rank: 7, regex: /(drink|drinks|beverage|beverages|cocktail|cocktails|wine|beer)/i },
      { rank: 8, regex: /(kids|children)/i }
    ]), [])

    const normalizeSection = useCallback((item = {}) => {
      return String(item.section_name || item.category || 'Uncategorized').trim() || 'Uncategorized'
    }, [])

    const sectionSortRank = useCallback((sectionName = '') => {
      const name = String(sectionName || '').trim()
      for (const entry of sectionCourseOrder) {
        if (entry.regex.test(name)) return entry.rank
      }
      return 99
    }, [sectionCourseOrder])

    const parsePriceValue = useCallback((price) => {
      if (price == null || price === '') return null
      if (typeof price === 'number') return Number.isFinite(price) ? price : null
      const parsed = parseFloat(String(price).replace(/[^0-9.]/g, ''))
      return Number.isFinite(parsed) ? parsed : null
    }, [])

    const sectionOptions = useMemo(() => {
      const unique = new Set()
      for (const item of items) unique.add(normalizeSection(item))
      return [...unique].sort((a, b) => {
        const byRank = sectionSortRank(a) - sectionSortRank(b)
        if (byRank !== 0) return byRank
        return a.localeCompare(b)
      })
    }, [items, normalizeSection, sectionSortRank])

    const sectionDropdownOptions = useMemo(() => {
      const commonSections = [
        'Starters',
        'Entrees',
        'Sides',
        'Salads',
        'Sandwiches',
        'Desserts',
        'Drinks',
        'Kids',
        'Uncategorized'
      ]
      const merged = new Set([...commonSections, ...sectionOptions])
      const editSection = String(itemForm.section_name || '').trim()
      const newSection = String(newItemForm.section_name || '').trim()
      if (editSection) merged.add(editSection)
      if (newSection) merged.add(newSection)
      return [...merged]
        .map((section) => String(section || '').trim())
        .filter(Boolean)
        .sort((a, b) => {
          const byRank = sectionSortRank(a) - sectionSortRank(b)
          if (byRank !== 0) return byRank
          return a.localeCompare(b)
        })
    }, [itemForm.section_name, newItemForm.section_name, sectionOptions, sectionSortRank])

    const displayItems = useMemo(() => {
      let next = [...items]
      if (sectionFilter !== 'all') {
        next = next.filter((item) => normalizeSection(item) === sectionFilter)
      }

      next.sort((a, b) => {
        const aSection = normalizeSection(a)
        const bSection = normalizeSection(b)

        if (sortMode === 'section_asc') {
          const bySection = aSection.localeCompare(bSection)
          if (bySection !== 0) return bySection
          return String(a.name || '').localeCompare(String(b.name || ''))
        }

        if (sortMode === 'section_desc') {
          const bySection = bSection.localeCompare(aSection)
          if (bySection !== 0) return bySection
          return String(a.name || '').localeCompare(String(b.name || ''))
        }

        if (sortMode === 'name_asc') {
          return String(a.name || '').localeCompare(String(b.name || ''))
        }

        if (sortMode === 'name_desc') {
          return String(b.name || '').localeCompare(String(a.name || ''))
        }

        if (sortMode === 'price_low') {
          const aPrice = parsePriceValue(a.price)
          const bPrice = parsePriceValue(b.price)
          if (aPrice == null && bPrice == null) return String(a.name || '').localeCompare(String(b.name || ''))
          if (aPrice == null) return 1
          if (bPrice == null) return -1
          if (aPrice !== bPrice) return aPrice - bPrice
          return String(a.name || '').localeCompare(String(b.name || ''))
        }

        if (sortMode === 'price_high') {
          const aPrice = parsePriceValue(a.price)
          const bPrice = parsePriceValue(b.price)
          if (aPrice == null && bPrice == null) return String(a.name || '').localeCompare(String(b.name || ''))
          if (aPrice == null) return 1
          if (bPrice == null) return -1
          if (aPrice !== bPrice) return bPrice - aPrice
          return String(a.name || '').localeCompare(String(b.name || ''))
        }

        const byCourse = sectionSortRank(aSection) - sectionSortRank(bSection)
        if (byCourse !== 0) return byCourse
        const bySection = aSection.localeCompare(bSection)
        if (bySection !== 0) return bySection
        return String(a.name || '').localeCompare(String(b.name || ''))
      })

      return next
    }, [items, normalizeSection, parsePriceValue, sectionFilter, sectionSortRank, sortMode])

    useEffect(() => {
      if (!selRestaurant || menuDisplayPrefKeys.length === 0) {
        setSortMode('course')
        setSectionFilter('all')
        return
      }

      let loadedPrefs = null
      for (const key of menuDisplayPrefKeys) {
        try {
          const raw = localStorage.getItem(`${MENU_DISPLAY_PREF_KEY_PREFIX}${key}`)
          if (!raw) continue
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') {
            loadedPrefs = parsed
            break
          }
        } catch {}
      }

      const nextSortMode = typeof loadedPrefs?.sortMode === 'string' ? loadedPrefs.sortMode : 'course'
      const nextSectionFilter = typeof loadedPrefs?.sectionFilter === 'string' ? loadedPrefs.sectionFilter : 'all'
      setSortMode(nextSortMode || 'course')
      setSectionFilter(nextSectionFilter || 'all')
    }, [menuDisplayPrefKeys, selRestaurant])

    // Load menu items when restaurant changes
    useEffect(() => {
      if (!selRestaurant) return
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      setEditItem(null)
      setEditItemId(null)
      setEditSaveState('idle')
      loadItems(selRestaurant)
    }, [selRestaurant])

    async function loadItems(restaurantId) {
      setItemsLoading(true)
      setItems([])
      try {
        // If it looks like a UUID, use the DB endpoint
        const isUUID = /^[0-9a-f-]{36}$/i.test(restaurantId)
        if (isUUID) {
          const res = await fetch(`${API_BASE}/admin/menu-items/restaurant/${restaurantId}`, { headers: adminHeaders() })
          if (res.ok) {
            const { items: dbItems } = await res.json()
            setItems(applyUserMenuOverrides(dbItems || []))
            setItemsLoading(false)
            return
          }
        }
        // Fallback to local data by name
        const localItems = localMenuData[restaurantId] || []
        const ratings = allRatings[restaurantId] || {}
        setItems(applyUserMenuOverrides(localItems.map(item => ({
          ...item,
          avg_rating: ratings[item.name]?.average ?? null,
          review_count: ratings[item.name]?.reviews?.length ?? 0,
        }))))
      } catch {} finally {
        setItemsLoading(false)
      }
    }

    useEffect(() => {
      if (!selRestaurant) return
      const refreshFromOverrides = () => {
        setItems(prev => applyUserMenuOverrides(prev))
      }
      const handleStorage = (event) => {
        const storageKey = String(event?.key || '')
        if (storageKey.startsWith('admin-item-overrides-')) {
          refreshFromOverrides()
        }
      }

      window.addEventListener('itemOverridesChanged', refreshFromOverrides)
      window.addEventListener('storage', handleStorage)
      return () => {
        window.removeEventListener('itemOverridesChanged', refreshFromOverrides)
        window.removeEventListener('storage', handleStorage)
      }
    }, [applyUserMenuOverrides, selRestaurant])

    useEffect(() => {
      if (!selRestaurant) {
        setApprovedItemsByKey({})
        setMenuApprovedAt('')
        return
      }

      const restoreApprovalState = () => {
        const state = readMenuApprovalState()
        setApprovedItemsByKey(state?.approvedItems || {})
        setMenuApprovedAt(state?.approvedAt || '')
      }
      const onStorage = (event) => {
        const storageKey = String(event?.key || '')
        if (storageKey.startsWith('admin-menu-approval-')) {
          restoreApprovalState()
        }
      }

      restoreApprovalState()
      window.addEventListener('storage', onStorage)
      window.addEventListener('adminMenuApprovalChanged', restoreApprovalState)
      return () => {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('adminMenuApprovalChanged', restoreApprovalState)
      }
    }, [readMenuApprovalState, selRestaurant])

    useEffect(() => {
      if (!selRestaurant) return
      persistMenuSnapshot(items)
    }, [items, persistMenuSnapshot, selRestaurant])

    const startEditItem = (item) => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      const initialForm = {
        name: item.name || '',
        price: item.price || '',
        description: item.description || '',
        section_name: item.section_name || item.category || '',
        is_available: item.is_available !== false,
      }
      setEditItem(item.name)
      setEditItemId(item.id || null)
      editLookupNameRef.current = item.name || ''
      lastSavedItemSnapshotRef.current = JSON.stringify(initialForm)
      setEditSaveState('idle')
      setItemForm(initialForm)
    }

    const saveItemEdit = async ({ closeEditor = false, silent = false } = {}) => {
      if (!editItem) return false
      const snapshot = JSON.stringify(itemForm || {})
      if (snapshot === lastSavedItemSnapshotRef.current) {
        if (closeEditor) setEditItem(null)
        setEditSaveState('saved')
        return true
      }

      const lookupName = editLookupNameRef.current || editItem
      const nextLookupName = String(itemForm.name || lookupName || '').trim() || lookupName
      const localPatch = {
        ...itemForm,
        name: nextLookupName,
        section_name: itemForm.section_name || '',
        category: itemForm.section_name || itemForm.category || ''
      }
      const applyLocalFallback = (message) => {
        editLookupNameRef.current = nextLookupName
        setEditItem(nextLookupName)
        setItems(prev => prev.map(x => {
          if ((editItemId && x.id === editItemId) || x.name === lookupName || x.name === nextLookupName) {
            return { ...x, ...localPatch }
          }
          return x
        }))
        syncUserMenuOverride({
          lookupName,
          nextName: nextLookupName,
          patch: localPatch,
          itemId: editItemId || null
        })
        lastSavedItemSnapshotRef.current = snapshot
        setEditSaveState('saved')
        if (!silent && message) showToast(message)
        return true
      }

      setSaving(true)
      setEditSaveState('saving')
      try {
        if (editItemId) {
          const res = await fetch(`${API_BASE}/admin/menu-items/${editItemId}`, {
            method: 'PUT', headers: adminHeaders(), body: JSON.stringify(itemForm)
          })
          if (res.ok) {
            const { item } = await res.json()
            setItems(prev => prev.map(x => x.id === editItemId ? { ...x, ...item } : x))
            const savedLookupName = String(item?.name || nextLookupName || '').trim() || nextLookupName
            editLookupNameRef.current = savedLookupName
            syncUserMenuOverride({
              lookupName,
              nextName: savedLookupName,
              itemId: item?.id || editItemId || null,
              patch: {
                name: savedLookupName,
                description: item?.description ?? itemForm.description ?? '',
                price: item?.price ?? itemForm.price ?? '',
                section_name: item?.section_name ?? itemForm.section_name ?? item?.category ?? '',
                category: item?.category ?? itemForm.section_name ?? '',
                is_available: item?.is_available ?? itemForm.is_available
              }
            })
            if (item?.name) {
              editLookupNameRef.current = item.name
              setEditItem(item.name)
            }
            lastSavedItemSnapshotRef.current = snapshot
            setEditSaveState('saved')
            if (!silent) showToast('Item saved to server')
          } else {
            return applyLocalFallback('Saved locally (server error)')
          }
        } else {
          // Local override fallback
          return applyLocalFallback('Item saved locally')
        }
        return true
      } catch {
        if (editItemId) return applyLocalFallback('Saved locally (server offline)')
        setEditSaveState('error')
        if (!silent) showToast('Error saving item')
        return false
      } finally {
        setSaving(false)
        if (closeEditor) setEditItem(null)
      }
    }

    const itemSectionSaveKey = useCallback((item) => {
      return String(item?.id || item?.name || '')
    }, [])

    const quickChangeItemSection = useCallback(async (item, nextSectionRaw) => {
      if (!item) return
      const nextSection = String(nextSectionRaw || '').trim()
      if (!nextSection) return
      if (normalizeSection(item) === nextSection) return

      const sectionPayload = { section_name: nextSection, category: nextSection }
      const saveKey = itemSectionSaveKey(item)
      const lookupName = item.name || ''
      const nextLookupName = lookupName
      const applyLocalSectionFallback = (message) => {
        syncUserMenuOverride({
          lookupName,
          nextName: nextLookupName,
          patch: sectionPayload,
          itemId: item?.id || null
        })
        if (item.id) {
          setItems(prev => prev.map(x => x.id === item.id ? { ...x, ...sectionPayload } : x))
        } else {
          setItems(prev => prev.map(x => x.name === item.name ? { ...x, ...sectionPayload } : x))
        }
        if (message) showToast(message)
      }
      setQuickSectionSavingKey(saveKey)

      try {
        if (item.id) {
          const res = await fetch(`${API_BASE}/admin/menu-items/${item.id}`, {
            method: 'PUT',
            headers: adminHeaders(),
            body: JSON.stringify(sectionPayload)
          })

          if (!res.ok) {
            applyLocalSectionFallback('Saved locally (server error)')
            return
          }

          const payload = await res.json().catch(() => ({}))
          const savedItem = payload?.item || {}
          setItems(prev => prev.map(x => x.id === item.id ? { ...x, ...sectionPayload, ...savedItem } : x))
          const dbNextLookupName = String(savedItem?.name || item.name || '').trim() || lookupName
          syncUserMenuOverride({
            lookupName,
            nextName: dbNextLookupName,
            itemId: item?.id || null,
            patch: {
              name: dbNextLookupName,
              section_name: savedItem?.section_name ?? nextSection,
              category: savedItem?.category ?? nextSection
            }
          })
          showToast('Section updated')
        } else {
          applyLocalSectionFallback('Section updated locally')
        }

        if (editItemId && item.id && editItemId === item.id) {
          setItemForm(prev => ({ ...prev, section_name: nextSection }))
        } else if (!item.id && editItem && (editLookupNameRef.current === item.name || editItem === item.name)) {
          setItemForm(prev => ({ ...prev, section_name: nextSection }))
        }
      } catch {
        applyLocalSectionFallback('Saved locally (server offline)')
      } finally {
        setQuickSectionSavingKey(null)
      }
    }, [adminHeaders, editItem, editItemId, itemSectionSaveKey, normalizeSection, showToast, syncUserMenuOverride])

    useEffect(() => {
      if (!editItem) return
      if (saving) return

      const snapshot = JSON.stringify(itemForm || {})
      if (!lastSavedItemSnapshotRef.current) {
        lastSavedItemSnapshotRef.current = snapshot
        return
      }
      if (snapshot === lastSavedItemSnapshotRef.current) return

      setEditSaveState('pending')
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => {
        saveItemEdit({ silent: true })
      }, 650)

      return () => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      }
    }, [editItem, itemForm, saving])

    const deleteItem = async (item) => {
      if (!window.confirm(`Delete "${item.name}"?`)) return
      if (item.id) {
        const res = await fetch(`${API_BASE}/admin/menu-items/${item.id}`, { method: 'DELETE', headers: adminHeaders() })
        if (res.ok) {
          setItems(prev => prev.filter(x => x.id !== item.id))
          showToast('Item deleted', 'danger')
          return
        }
      }
      setItems(prev => prev.filter(x => x.name !== item.name))
      showToast('Item removed locally', 'danger')
    }

    const addNewItem = async () => {
      if (!newItemForm.name.trim()) return showToast('Name is required')
      setSaving(true)
      try {
        const isUUID = /^[0-9a-f-]{36}$/i.test(selRestaurant)
        if (isUUID) {
          const res = await fetch(`${API_BASE}/admin/menu-items/restaurant/${selRestaurant}`, {
            method: 'POST', headers: adminHeaders(), body: JSON.stringify(newItemForm)
          })
          if (res.ok) {
            const { item } = await res.json()
            setItems(prev => [...prev, item])
            setNewItemForm({ name: '', description: '', price: '', section_name: '', category: '' })
            setAddingNew(false)
            showToast('Item added to server')
          } else {
            showToast('Server error adding item')
          }
        } else {
          showToast('Select a DB restaurant to add items')
        }
      } catch { showToast('Error adding item') } finally {
        setSaving(false)
      }
    }

    // Build restaurant list from DB + local
    const allRestList = useMemo(() => {
      const list = []
      dbRestaurants.forEach(r => list.push({ id: r.id, label: r.name }))
      localRestaurantNames.forEach(name => {
        if (!dbRestaurants.find(r => r.name === name)) list.push({ id: name, label: name + ' (local)' })
      })
      return list
    }, [dbRestaurants])

    const TAG_OPTS = ['vegetarian', 'healthy', 'spicy', 'new']
    const editSaveText =
      saving || editSaveState === 'saving'
        ? 'Saving changes...'
        : editSaveState === 'pending'
          ? 'Unsaved changes...'
          : editSaveState === 'saved'
            ? 'Saved automatically'
            : editSaveState === 'error'
              ? 'Save failed - retry on next change'
              : 'Auto-save enabled'
    const editSaveColor =
      saving || editSaveState === 'saving'
        ? C.amber
        : editSaveState === 'pending'
          ? C.text2
          : editSaveState === 'saved'
            ? C.emerald
            : editSaveState === 'error'
              ? C.rose
              : C.text3

    return (
      <div className="admin-fade">
        <SectionHeader title="Menu Items" sub="Manage menu items across all restaurants — changes go live immediately" />

        {/* Restaurant selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 6 }}>SELECT RESTAURANT</label>
          <select className="admin-input" style={{ maxWidth: 400 }} value={selRestaurant || ''} onChange={e => setSelRestaurant(e.target.value || null)}>
            <option value="">— Choose a restaurant —</option>
            {allRestList.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>

        {selRestaurant && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: C.text2 }}>
                {displayItems.length}
                {displayItems.length !== items.length ? ` of ${items.length}` : ''}
                {` items${itemsLoading ? ' (loading...)' : ''}`}
              </div>
              {items.length > 0 && (
                <div className="admin-mono" style={{ fontSize: 11, color: allItemsApproved ? C.emerald : C.text3, marginTop: 3 }}>
                  {approvedItemCount}/{items.length} approved
                  {menuApprovedAt ? ` • ${new Date(menuApprovedAt).toLocaleString()}` : ''}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap: 8 }}>
              <button
                className="admin-btn-amber"
                style={{ padding:'6px 12px', borderRadius: 8, fontSize: 12, display:'flex', alignItems:'center', gap: 6 }}
                onClick={approveWholeMenu}
                disabled={itemsLoading || items.length === 0 || approvingFullMenu}
              >
                <CheckCircle size={12} />
                {allItemsApproved ? 'Menu Approved' : approvingFullMenu ? 'Approving…' : 'Approve Full Menu'}
              </button>
              <button
                className="admin-btn-danger"
                style={{ padding:'6px 12px', borderRadius: 8, fontSize: 12, display:'flex', alignItems:'center', gap: 6 }}
                onClick={resetAllSectionsToUncategorized}
                disabled={itemsLoading || items.length === 0 || resettingSections || saving}
              >
                <Minus size={12} />
                {resettingSections ? 'Resetting…' : 'Reset Sections'}
              </button>
              <button className="admin-btn-ghost" style={{ padding:'6px 12px', borderRadius: 8, fontSize: 12, display:'flex', alignItems:'center', gap: 6 }} onClick={() => loadItems(selRestaurant)}>
                <RefreshCw size={12} />Refresh
              </button>
              <button className="admin-btn-amber" style={{ padding:'6px 12px', borderRadius: 8, fontSize: 12, display:'flex', alignItems:'center', gap: 6 }} onClick={() => setAddingNew(true)}>
                <Plus size={12} />Add Item
              </button>
            </div>
          </div>
        )}

        {selRestaurant && items.length > 0 && (
          <div style={{ display:'flex', gap: 10, marginBottom: 14, flexWrap:'wrap' }}>
            <div style={{ minWidth: 220, flex: '1 1 220px', maxWidth: 320 }}>
              <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>SORT</label>
              <select className="admin-input" value={sortMode} onChange={e => handleSortModeChange(e.target.value)}>
                <option value="course">Course Order (Starters - Entrees - Sides)</option>
                <option value="section_asc">Section (A-Z)</option>
                <option value="section_desc">Section (Z-A)</option>
                <option value="name_asc">Item Name (A-Z)</option>
                <option value="name_desc">Item Name (Z-A)</option>
                <option value="price_low">Price (Low - High)</option>
                <option value="price_high">Price (High - Low)</option>
              </select>
            </div>
            <div style={{ minWidth: 220, flex: '1 1 220px', maxWidth: 320 }}>
              <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>FILTER SECTION</label>
              <select className="admin-input" value={sectionFilter} onChange={e => handleSectionFilterChange(e.target.value)}>
                <option value="all">All Sections</option>
                {sectionOptions.map(section => <option key={section} value={section}>{section}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Add new item form */}
        {addingNew && (
          <div style={{ background: C.surface, border:`1px solid ${C.emerald}44`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 14 }}>
              <div className="admin-syne" style={{ fontSize: 14, fontWeight: 700, color: C.emerald }}>Add New Item</div>
              <button className="admin-btn-ghost" style={{ padding:'5px 10px', borderRadius: 6, fontSize: 12 }} onClick={() => setAddingNew(false)}>Cancel</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>NAME *</label>
                <input className="admin-input" value={newItemForm.name} onChange={e => setNewItemForm(p=>({...p, name:e.target.value}))} placeholder="e.g. Truffle Fries" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>PRICE</label>
                <input className="admin-input" value={newItemForm.price} onChange={e => setNewItemForm(p=>({...p, price:e.target.value}))} placeholder="12.99" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>SECTION / CATEGORY</label>
                <select className="admin-input" value={newItemForm.section_name || ''} onChange={e => setNewItemForm(p=>({...p, section_name:e.target.value, category: e.target.value}))}>
                  <option value="">Choose section</option>
                  {sectionDropdownOptions.map(section => <option key={section} value={section}>{section}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>DESCRIPTION</label>
                <textarea className="admin-input" value={newItemForm.description} onChange={e => setNewItemForm(p=>({...p, description:e.target.value}))} rows={2} style={{ resize:'vertical', fontFamily:'Figtree,sans-serif' }} />
              </div>
            </div>
            <button className="admin-btn-amber" style={{ padding:'8px 18px', borderRadius: 8, fontSize: 13 }} onClick={addNewItem} disabled={saving}>
              <Plus size={13} style={{ display:'inline', marginRight: 6 }} />{saving ? 'Adding…' : 'Add to Server'}
            </button>
          </div>
        )}

        {editItem && (
          <div style={{ background: C.surface, border:`1px solid ${C.amber}44`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 14 }}>
              <div className="admin-syne" style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Edit: {editItem}</div>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <span className="admin-mono" style={{ fontSize: 11, color: editSaveColor }}>{editSaveText}</span>
                <button
                  className="admin-btn-ghost"
                  style={{ padding:'5px 10px', borderRadius: 6, fontSize: 12 }}
                  onClick={() => {
                    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
                    setEditItem(null)
                    setEditSaveState('idle')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>NAME</label>
                <input className="admin-input" value={itemForm.name || ''} onChange={e => setItemForm(p=>({...p, name:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>PRICE</label>
                <input className="admin-input" value={itemForm.price || ''} onChange={e => setItemForm(p=>({...p, price:e.target.value}))} placeholder="12.99" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>SECTION / CATEGORY</label>
                <select className="admin-input" value={itemForm.section_name || ''} onChange={e => setItemForm(p=>({...p, section_name:e.target.value}))}>
                  <option value="">Choose section</option>
                  {sectionDropdownOptions.map(section => <option key={section} value={section}>{section}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <input type="checkbox" id="is_avail" checked={itemForm.is_available !== false} onChange={e => setItemForm(p=>({...p, is_available: e.target.checked}))} style={{ accentColor: C.amber }} />
                <label htmlFor="is_avail" style={{ fontSize: 13, color: C.text, cursor:'pointer' }}>Available on menu</label>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.06em', display:'block', marginBottom: 5 }}>DESCRIPTION</label>
                <textarea className="admin-input" value={itemForm.description || ''} onChange={e => setItemForm(p=>({...p, description:e.target.value}))} rows={2} style={{ resize:'vertical', fontFamily:'Figtree,sans-serif' }} />
              </div>
            </div>
            <button className="admin-btn-amber" style={{ padding:'8px 18px', borderRadius: 8, fontSize: 13 }} onClick={() => saveItemEdit({ silent: false })} disabled={saving}>
              <Save size={13} style={{ display:'inline', marginRight: 6 }} />{saving ? 'Saving…' : 'Save to Server'}
            </button>
          </div>
        )}

        <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, overflow:'hidden' }}>
          {!selRestaurant ? (
            <div style={{ padding: 40, textAlign:'center', color: C.text3 }}>Select a restaurant above to manage its menu</div>
          ) : itemsLoading ? (
            <div style={{ padding: 40, textAlign:'center', color: C.text3 }}>Loading menu items...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 40, textAlign:'center', color: C.text3 }}>No menu items found — use "Add Item" to add some</div>
          ) : displayItems.length === 0 ? (
            <div style={{ padding: 40, textAlign:'center', color: C.text3 }}>No items match the selected section filter</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }} className="admin-table">
              <thead style={{ background: C.surface2 }}>
                <tr>
                  <th style={{ textAlign:'left' }}>Item</th>
                  <th style={{ textAlign:'left' }}>Section</th>
                  <th style={{ textAlign:'center' }}>Price</th>
                  <th style={{ textAlign:'center' }}>Avg Rating</th>
                  <th style={{ textAlign:'center' }}>Reviews</th>
                  <th style={{ textAlign:'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, i) => (
                  <tr key={item.id || i} style={{ opacity: item.is_available === false ? .45 : 1 }}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap' }}>
                        <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{item.name}</div>
                        {isItemApproved(item) && (
                          <span
                            className="admin-tag"
                            style={{ background: `${C.emerald}22`, color: C.emerald, border: `1px solid ${C.emerald}44`, cursor: 'default' }}
                          >
                            Approved
                          </span>
                        )}
                      </div>
                      {item.description && <div style={{ fontSize: 11, color: C.text3, marginTop: 2, maxWidth: 280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.description}</div>}
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                        <select
                          className="admin-input"
                          style={{ minWidth: 150, padding:'5px 8px', fontSize: 12 }}
                          value={normalizeSection(item)}
                          onChange={e => quickChangeItemSection(item, e.target.value)}
                          disabled={saving || quickSectionSavingKey === itemSectionSaveKey(item)}
                        >
                          {sectionDropdownOptions.map(section => <option key={section} value={section}>{section}</option>)}
                        </select>
                        {quickSectionSavingKey === itemSectionSaveKey(item) && (
                          <span className="admin-mono" style={{ fontSize: 10, color: C.text3 }}>Saving...</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <span className="admin-mono" style={{ color: C.text2 }}>{item.price ? `$${Number(item.price).toFixed(2)}` : '—'}</span>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      {item.avg_rating != null
                        ? <span className="admin-mono" style={{ color: item.avg_rating >= 4 ? C.emerald : item.avg_rating >= 3 ? C.amber : C.rose, fontWeight: 700 }}>{Number(item.avg_rating).toFixed(1)}</span>
                        : <span style={{ color: C.text3 }}>—</span>}
                    </td>
                    <td style={{ textAlign:'center' }}><span className="admin-mono" style={{ color: C.text2 }}>{item.review_count || 0}</span></td>
                    <td style={{ textAlign:'right' }}>
                      <div style={{ display:'flex', gap: 5, justifyContent:'flex-end' }}>
                        <button title="Edit" className="admin-btn-ghost" style={{ padding:'5px 7px', borderRadius: 6 }} onClick={() => startEditItem(item)}>
                          <Edit3 size={12} />
                        </button>
                        <button title="Delete" className="admin-btn-danger" style={{ padding:'5px 7px', borderRadius: 6 }} onClick={() => deleteItem(item)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     SECTION: USERS
  ══════════════════════════════════════════════════════ */
  const UsersSection = () => {
    const [localUsers, setLocalUsers] = useState(dbUsers)

    useEffect(() => { setLocalUsers(dbUsers) }, [dbUsers])

    const updateUserRole = async (u, newRole) => {
      try {
        const res = await fetch(`${API_BASE}/admin/users/${u.id}`, {
          method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ role: newRole })
        })
        if (res.ok) {
          setLocalUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
          showToast(`User role set to ${newRole}`)
        } else {
          showToast('Failed to update user')
        }
      } catch {
        showToast('Server offline')
      }
    }

    const flagSuspicious = async (u) => {
      // Increase bot_score to flag as suspicious
      const newBotScore = u.bot_score > 0.7 ? 0.0 : 0.9
      try {
        const res = await fetch(`${API_BASE}/admin/users/${u.id}`, {
          method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ bot_score: newBotScore })
        })
        if (res.ok) {
          setLocalUsers(prev => prev.map(x => x.id === u.id ? { ...x, bot_score: newBotScore } : x))
          showToast(newBotScore > 0.5 ? 'User flagged as suspicious' : 'User flag cleared')
        }
      } catch { showToast('Server offline') }
    }

    const resetCredibility = async (u) => {
      try {
        const res = await fetch(`${API_BASE}/admin/users/${u.id}`, {
          method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ credibility_score: 1.0, bot_score: 0.0 })
        })
        if (res.ok) {
          setLocalUsers(prev => prev.map(x => x.id === u.id ? { ...x, credibility_score: 1.0, bot_score: 0.0 } : x))
          showToast('User credibility reset')
        }
      } catch { showToast('Server offline') }
    }

    const displayUsers = localUsers.length > 0 ? localUsers : []

    return (
      <div className="admin-fade">
        <SectionHeader title="Users" sub={`${displayUsers.length} registered users`} />
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 12 }}>
          <button className="admin-btn-ghost" style={{ padding:'6px 12px', borderRadius: 8, fontSize: 12, display:'flex', alignItems:'center', gap: 6 }} onClick={loadUsersFromServer}>
            <RefreshCw size={12} />{dbUsersLoading ? 'Loading…' : 'Refresh Users'}
          </button>
        </div>
        <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, overflow:'hidden' }}>
          {dbUsersLoading ? (
            <div style={{ padding: 40, textAlign:'center', color: C.text3 }}>Loading users from database…</div>
          ) : displayUsers.length === 0 ? (
            <div style={{ padding: 40, textAlign:'center', color: C.text3 }}>No users found in database</div>
          ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }} className="admin-table">
            <thead style={{ background: C.surface2 }}>
              <tr>
                <th style={{ textAlign:'left' }}>User</th>
                <th style={{ textAlign:'center' }}>Role</th>
                <th style={{ textAlign:'center' }}>Ratings</th>
                <th style={{ textAlign:'center' }}>Trust Score</th>
                <th style={{ textAlign:'center' }}>Status</th>
                <th style={{ textAlign:'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayUsers.map((u, i) => {
                const isSuspicious = u.bot_score > 0.7
                const initial = (u.name || u.email || '?').charAt(0).toUpperCase()
                return (
                  <tr key={u.id || i}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius:'50%', background:`linear-gradient(135deg,${C.amber},${C.amberDim})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 12, fontWeight: 700, color: '#09090b', flexShrink: 0 }}>
                          {initial}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{u.name || '—'}</div>
                          <div style={{ fontSize: 11, color: C.text3 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <Badge color={isSuspicious ? C.rose : C.blue}>{u.role || 'user'}</Badge>
                    </td>
                    <td style={{ textAlign:'center' }}><span className="admin-mono" style={{ color: C.text2 }}>{u.ratings_count ?? '—'}</span></td>
                    <td style={{ textAlign:'center' }}>
                      <span className="admin-mono" style={{ color: u.credibility_score >= 1.5 ? C.emerald : u.credibility_score >= 0.8 ? C.amber : C.rose }}>
                        {u.credibility_score != null ? Number(u.credibility_score).toFixed(2) : '—'}
                      </span>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <Badge color={isSuspicious ? C.rose : C.emerald}>
                        {isSuspicious ? 'Suspicious' : 'Active'}
                      </Badge>
                    </td>
                    <td style={{ textAlign:'right' }}>
                      <div style={{ display:'flex', gap: 5, justifyContent:'flex-end' }}>
                        <button title={u.bot_score > 0.7 ? 'Clear flag' : 'Flag as suspicious'} className="admin-btn-ghost" style={{ padding:'5px 7px', borderRadius: 6 }} onClick={() => flagSuspicious(u)}>
                          <AlertTriangle size={12} color={u.bot_score > 0.7 ? C.amber : C.text3} />
                        </button>
                        <button title="Reset credibility to 1.0" className="admin-btn-ghost" style={{ padding:'5px 7px', borderRadius: 6 }} onClick={() => resetCredibility(u)}>
                          <RefreshCw size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          )}
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     SECTION: MODERATION
  ══════════════════════════════════════════════════════ */
  const ModerationSection = () => {
    const flags = Array.isArray(menuItemFlags) ? menuItemFlags : []
    const reports = Array.isArray(reviewReports) ? reviewReports : []

    const updateFlagStatus = async (flagId, status) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/menu-item-flags/${flagId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status })
        })
        if (res.ok) {
          const updated = await res.json()
          setMenuItemFlags((prev) => prev.map((f) => (String(f.id) === String(flagId) ? updated : f)))
          showToast('Menu flag updated')
          return
        }
      } catch (e) {}

      setMenuItemFlags((prev) => prev.map((f) => (String(f.id) === String(flagId) ? { ...f, status } : f)))
      showToast('Menu flag updated (local)')
    }

    const updateReportStatus = async (reportId, status) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/review-reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status })
        })
        if (res.ok) {
          const updated = await res.json()
          setReviewReports((prev) => prev.map((r) => (String(r.id) === String(reportId) ? updated : r)))
          showToast('Review report updated')
          return
        }
      } catch (e) {}

      setReviewReports((prev) => prev.map((r) => (String(r.id) === String(reportId) ? { ...r, status } : r)))
      showToast('Review report updated (local)')
    }

    return (
      <div className="admin-fade">
        <SectionHeader title="Moderation" sub="Manage flagged content and user reports" />

        <div style={{ display:'flex', gap: 12, marginBottom: 20 }}>
          <StatCard label="Menu Flags" value={flags.length} icon={Flag} color={C.rose} />
          <StatCard label="Review Reports" value={reports.length} icon={MessageSquare} color={C.amber} />
          <StatCard label="Banned Users" value={moderation.banned.length} icon={ShieldOff} color={C.rose} />
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 12 }}>
          <button
            className="admin-btn-ghost"
            style={{ padding:'6px 12px', borderRadius: 8, fontSize: 12 }}
            onClick={fetchModerationQueue}
            disabled={moderationLoading}
          >
            {moderationLoading ? 'Refreshing…' : 'Refresh Queue'}
          </button>
        </div>

        <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, overflow:'hidden', marginBottom: 16 }}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}` }}>
            <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase' }}>Menu Item Flags</div>
          </div>
          {flags.length === 0 ? (
            <div style={{ padding: 40, textAlign:'center', color: C.text3 }}>
              <CheckCircle size={32} color={C.emerald} style={{ display:'block', margin:'0 auto 10px' }} />
              <div style={{ fontSize: 13 }}>No flagged menu items</div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }} className="admin-table">
              <thead style={{ background: C.surface2 }}>
                <tr>
                  <th style={{ textAlign:'left' }}>Item</th>
                  <th style={{ textAlign:'left' }}>Restaurant</th>
                  <th style={{ textAlign:'left' }}>Reason</th>
                  <th style={{ textAlign:'center' }}>Status</th>
                  <th style={{ textAlign:'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.id || `${f.restaurant_name}-${f.item_name}` }>
                    <td style={{ fontWeight: 600, color: C.text }}>{f.item_name || f.item || f.dish}</td>
                    <td style={{ color: C.text2 }}>{f.restaurant_name || f.restaurant || '—'}</td>
                    <td><Badge color={C.rose}>{f.reason || 'Reported'}</Badge></td>
                    <td style={{ textAlign:'center', fontSize: 11, color: C.text3 }}>{f.status || 'open'}</td>
                    <td style={{ textAlign:'right' }}>
                      <button className="admin-btn-ghost" style={{ padding:'5px 8px', borderRadius: 6, fontSize: 11, marginRight: 6 }} onClick={() => updateFlagStatus(f.id, 'resolved')}>
                        Resolve
                      </button>
                      <button className="admin-btn-ghost" style={{ padding:'5px 8px', borderRadius: 6, fontSize: 11 }} onClick={() => updateFlagStatus(f.id, 'dismissed')}>
                        Dismiss
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}` }}>
            <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase' }}>Review Reports</div>
          </div>
          {reports.length === 0 ? (
            <div style={{ padding: 40, textAlign:'center', color: C.text3 }}>
              <CheckCircle size={32} color={C.emerald} style={{ display:'block', margin:'0 auto 10px' }} />
              <div style={{ fontSize: 13 }}>No review reports</div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }} className="admin-table">
              <thead style={{ background: C.surface2 }}>
                <tr>
                  <th style={{ textAlign:'left' }}>Dish</th>
                  <th style={{ textAlign:'left' }}>Reason</th>
                  <th style={{ textAlign:'center' }}>Status</th>
                  <th style={{ textAlign:'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id || `${r.dish_name}-${r.created_at}` }>
                    <td style={{ fontWeight: 600, color: C.text }}>{r.dish_name || 'Review'}</td>
                    <td><Badge color={C.amber}>{r.reason || 'Reported'}</Badge></td>
                    <td style={{ textAlign:'center', fontSize: 11, color: C.text3 }}>{r.status || 'open'}</td>
                    <td style={{ textAlign:'right' }}>
                      <button className="admin-btn-ghost" style={{ padding:'5px 8px', borderRadius: 6, fontSize: 11, marginRight: 6 }} onClick={() => updateReportStatus(r.id, 'resolved')}>
                        Resolve
                      </button>
                      <button className="admin-btn-ghost" style={{ padding:'5px 8px', borderRadius: 6, fontSize: 11 }} onClick={() => updateReportStatus(r.id, 'dismissed')}>
                        Dismiss
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     SECTION: ANALYTICS
  ══════════════════════════════════════════════════════ */
  const AnalyticsSection = () => (
    <div className="admin-fade">
      <SectionHeader title="Analytics" sub="Platform performance and engagement metrics" />

      <div style={{ display:'flex', gap: 12, marginBottom: 20, flexWrap:'wrap' }}>
        <StatCard label="Total Dishes Tracked" value={analytics.totalDishes} icon={UtensilsCrossed} color={C.amber} />
        <StatCard label="Total Reviews" value={analytics.totalReviews} icon={Star} color={C.purple} />
        <StatCard label="Avg Platform Rating" value={analytics.avgRating > 0 ? analytics.avgRating.toFixed(2) : '—'} icon={Award} color={C.emerald} />
        <StatCard label="Posts This Week" value={analytics.weekPosts} icon={TrendingUp} color={C.blue} sub={`+${analytics.todayPosts} today`} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Top 10 dishes by reviews */}
        <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 16 }}>Top Dishes by Reviews</div>
          {analytics.topDishes.length > 0 ? (
            <BarChart data={analytics.topDishes.map(d => ({ label: d.name, value: d.reviews }))} color={C.purple} />
          ) : <div style={{ fontSize: 13, color: C.text3, textAlign:'center', padding: 20 }}>Rate some dishes to see data</div>}
        </div>

        {/* Highest rated dishes */}
        <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 16 }}>Highest Rated Dishes</div>
          {analytics.highestRated.length > 0 ? (
            <div>
              {analytics.highestRated.map((d,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap: 12, padding:'10px 0', borderBottom: i < analytics.highestRated.length-1 ? `1px solid ${C.border}` : 'none' }}>
                  <span className="admin-mono" style={{ fontSize: 18, fontWeight: 700, color: C.text3, width: 24, flexShrink: 0 }}>#{i+1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: C.text3 }}>{d.restaurant}</div>
                  </div>
                  <div className="admin-mono" style={{ fontSize: 14, fontWeight: 700, color: d.avg >= 8 ? C.emerald : C.amber }}>{d.avg.toFixed(1)}</div>
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize: 13, color: C.text3, textAlign:'center', padding: 20 }}>No ratings yet</div>}
        </div>
      </div>

      {/* Activity by restaurant */}
      <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 16 }}>Restaurant Engagement</div>
        {analytics.topRestaurants.length > 0 ? (
          <BarChart data={analytics.topRestaurants} color={C.blue} />
        ) : <div style={{ fontSize: 13, color: C.text3, textAlign:'center', padding: 20 }}>No data yet</div>}
      </div>
    </div>
  )

  /* ══════════════════════════════════════════════════════
     SECTION: ALGORITHM
  ══════════════════════════════════════════════════════ */
  const AlgorithmSection = () => {
    const [cfg, setCfg] = useState(algoConfig)

    const totalWeights = cfg.ratingWeight + cfg.recencyWeight + cfg.popularityWeight
    const weightError = totalWeights !== 100

    const updateWeight = (key, val) => {
      setCfg(p => ({ ...p, [key]: Number(val) }))
    }

    return (
      <div className="admin-fade">
        <SectionHeader title="Algorithm Controls" sub="Tune the ranking and recommendation engine without touching code" />

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
          {/* Weight controls */}
          <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 16 }}>Ranking Weights</div>

            <div style={{ marginBottom: 20 }}>
              {[
                { key:'ratingWeight', label:'Rating Weight', color:C.amber },
                { key:'recencyWeight', label:'Recency Weight', color:C.emerald },
                { key:'popularityWeight', label:'Popularity Weight', color:C.purple }
              ].map(({ key, label, color }) => (
                <div key={key} style={{ marginBottom: 20 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: C.text }}>{label}</span>
                    <span className="admin-mono" style={{ fontSize: 14, fontWeight: 700, color }}>{cfg[key]}%</span>
                  </div>
                  <input type="range" className="admin-slider" min="0" max="100" value={cfg[key]} onChange={e => updateWeight(key, e.target.value)} style={{ accentColor: color }} />
                </div>
              ))}
              {weightError && (
                <div style={{ background:`${C.rose}18`, border:`1px solid ${C.rose}44`, borderRadius: 8, padding:'8px 12px', fontSize: 12, color: C.rose }}>
                  Weights sum to {totalWeights}% — should equal 100%
                </div>
              )}
              {!weightError && (
                <div style={{ background:`${C.emerald}18`, border:`1px solid ${C.emerald}44`, borderRadius: 8, padding:'8px 12px', fontSize: 12, color: C.emerald }}>
                  Weights balanced at 100%
                </div>
              )}
            </div>

            <button className="admin-btn-amber" style={{ padding:'10px 20px', borderRadius: 8, fontSize: 13, width:'100%' }} onClick={() => saveAlgo(cfg)}>
              <Save size={13} style={{ display:'inline', marginRight: 6 }} />Save Algorithm Config
            </button>
          </div>

          {/* Boolean toggles */}
          <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 14 }}>Feature Flags</div>
            <Toggle value={cfg.trendingBoost} onChange={v => setCfg(p=>({...p,trendingBoost:v}))} label="Trending Boost" sub="Amplify rising dishes in rankings" />
            <Toggle value={cfg.newDishBoost} onChange={v => setCfg(p=>({...p,newDishBoost:v}))} label="New Dish Boost" sub="Surface recently added items" />
            <Toggle value={cfg.bayesianSmoothing} onChange={v => setCfg(p=>({...p,bayesianSmoothing:v}))} label="Bayesian Smoothing" sub="Balance items with few ratings" color={C.purple} />
            <Toggle value={cfg.personalizedFeed ?? false} onChange={v => setCfg(p=>({...p,personalizedFeed:v}))} label="Personalized Feed" sub="Show content based on user history" color={C.blue} />

            {/* Preview of current config */}
            <div style={{ marginTop: 16, background: C.surface2, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, letterSpacing:'.08em', marginBottom: 8 }}>CURRENT CONFIG PREVIEW</div>
              <pre className="admin-mono" style={{ fontSize: 11, color: C.text2, margin: 0, overflow:'auto' }}>
                {JSON.stringify(cfg, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     SECTION: MONETIZATION
  ══════════════════════════════════════════════════════ */
  const MonetizationSection = () => {
    const [cfg, setCfg] = useState(monoConfig)
    const [newFeatured, setNewFeatured] = useState('')
    const [newBoosted, setNewBoosted] = useState('')

    return (
      <div className="admin-fade">
        <SectionHeader title="Monetization Controls" sub="Future-proof revenue levers — configure now, flip on when ready" />

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
          <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 14 }}>Revenue Features</div>
            <Toggle value={cfg.featuredEnabled} onChange={v => setCfg(p=>({...p,featuredEnabled:v}))} label="Featured Restaurants" sub="Paid placement at top of feed" color={C.amber} />
            <Toggle value={cfg.boostEnabled} onChange={v => setCfg(p=>({...p,boostEnabled:v}))} label="Dish Boosts" sub="Paid boost for specific menu items" color={C.amber} />
            <Toggle value={cfg.sponsoredBadge} onChange={v => setCfg(p=>({...p,sponsoredBadge:v}))} label="Sponsored Badges" sub="Visual badge on paid content" color={C.purple} />
            <Toggle value={cfg.adPlacements} onChange={v => setCfg(p=>({...p,adPlacements:v}))} label="Ad Placements" sub="Banner ads in feed between restaurants" color={C.blue} />

            <button className="admin-btn-amber" style={{ padding:'10px 20px', borderRadius: 8, fontSize: 13, width:'100%', marginTop: 16 }} onClick={() => saveMono(cfg)}>
              <Save size={13} style={{ display:'inline', marginRight: 6 }} />Save Config
            </button>
          </div>

          <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 14 }}>Featured Restaurants</div>
            <div style={{ display:'flex', gap: 8, marginBottom: 10 }}>
              <input className="admin-input" style={{ flex:1 }} placeholder="Restaurant name…" value={newFeatured} onChange={e=>setNewFeatured(e.target.value)} />
              <button className="admin-btn-amber" style={{ padding:'8px 14px', borderRadius: 8, fontSize: 12, flexShrink: 0 }} onClick={() => {
                if (!newFeatured) return
                const updated = { ...cfg, featuredRestaurants: [...(cfg.featuredRestaurants||[]), newFeatured] }
                setCfg(updated); saveMono(updated); setNewFeatured('')
              }}>Add</button>
            </div>
            {(cfg.featuredRestaurants||[]).length === 0
              ? <div style={{ fontSize: 12, color: C.text3 }}>No featured restaurants yet</div>
              : (cfg.featuredRestaurants||[]).map((r,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.text }}>{r}</span>
                  <button className="admin-btn-ghost" style={{ padding:'4px 8px', borderRadius: 6, fontSize: 11 }} onClick={() => {
                    const updated = { ...cfg, featuredRestaurants: cfg.featuredRestaurants.filter((_,j)=>j!==i) }
                    setCfg(updated); saveMono(updated)
                  }}><X size={12}/></button>
                </div>
              ))
            }

            <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', margin:'20px 0 14px' }}>Boosted Dishes</div>
            <div style={{ display:'flex', gap: 8, marginBottom: 10 }}>
              <input className="admin-input" style={{ flex:1 }} placeholder="Dish name…" value={newBoosted} onChange={e=>setNewBoosted(e.target.value)} />
              <button className="admin-btn-amber" style={{ padding:'8px 14px', borderRadius: 8, fontSize: 12, flexShrink: 0 }} onClick={() => {
                if (!newBoosted) return
                const updated = { ...cfg, boostedDishes: [...(cfg.boostedDishes||[]), newBoosted] }
                setCfg(updated); saveMono(updated); setNewBoosted('')
              }}>Add</button>
            </div>
            {(cfg.boostedDishes||[]).length === 0
              ? <div style={{ fontSize: 12, color: C.text3 }}>No boosted dishes yet</div>
              : (cfg.boostedDishes||[]).map((d,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.text }}>{d}</span>
                  <button className="admin-btn-ghost" style={{ padding:'4px 8px', borderRadius: 6, fontSize: 11 }} onClick={() => {
                    const updated = { ...cfg, boostedDishes: cfg.boostedDishes.filter((_,j)=>j!==i) }
                    setCfg(updated); saveMono(updated)
                  }}><X size={12}/></button>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     SECTION: SYSTEM
  ══════════════════════════════════════════════════════ */
  const SystemSection = () => {
    const [refreshing, setRefreshing] = useState(false)
    const [lsStats, setLsStats] = useState({})

    useEffect(() => {
      const stats = {}
      Object.keys(localStorage).forEach(k => {
        const val = localStorage.getItem(k) || ''
        stats[k] = (val.length / 1024).toFixed(2)
      })
      setLsStats(stats)
    }, [])

    const refresh = async () => {
      setRefreshing(true)
      await checkApiHealth()
      setRefreshing(false)
      showToast('Health check complete')
    }

    const lsKeys = Object.keys(lsStats).sort((a,b) => Number(lsStats[b]) - Number(lsStats[a])).slice(0, 15)
    const totalKB = Object.values(lsStats).reduce((s, v) => s + Number(v), 0)

    return (
      <div className="admin-fade">
        <SectionHeader title="System" sub="Infrastructure health and data storage" />

        <div style={{ display:'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex:1, background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
              <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase' }}>Backend API</div>
              <button className="admin-btn-ghost" style={{ padding:'6px 12px', borderRadius: 8, fontSize: 12, display:'flex', alignItems:'center', gap: 6 }} onClick={refresh}>
                <RefreshCw size={12} className={refreshing ? 'admin-live-dot' : ''} />Refresh
              </button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 10 }}>
              <div className={refreshing ? 'admin-live-dot' : ''} style={{ width: 10, height: 10, borderRadius:'50%', background: apiHealth === true ? C.emerald : apiHealth === false ? C.rose : C.amber }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: apiHealth === true ? C.emerald : apiHealth === false ? C.rose : C.amber }}>
                {apiHealth === null ? 'Checking…' : apiHealth ? 'Healthy' : 'Offline'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.text3 }}>Endpoint: <span className="admin-mono" style={{ color: C.text2 }}>{API_BASE}</span></div>
            <div style={{ marginTop: 14 }}>
              {[
                { label: 'Health endpoint', path:'/api/health' },
                { label: 'Restaurants', path:'/api/restaurants' },
                { label: 'Nearby restaurants', path:'/api/nearby-restaurants' },
              ].map(({ label, path }) => (
                <div key={path} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize: 12 }}>
                  <span style={{ color: C.text2 }}>{label}</span>
                  <span className="admin-mono" style={{ color: C.text3 }}>{path}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex:1, background: C.surface, border:`1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.text2, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 14 }}>Local Storage</div>
            <div className="admin-mono" style={{ fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 4 }}>{totalKB.toFixed(1)} KB</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 14 }}>{Object.keys(lsStats).length} keys stored</div>
            <div className="admin-scroll" style={{ maxHeight: 180, overflowY:'auto' }}>
              {lsKeys.map(k => (
                <div key={k} style={{ display:'flex', alignItems:'center', gap: 8, padding:'5px 0', borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ flex:1, fontSize: 11, color: C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k}</div>
                  <div style={{ width: 60, height: 5, background: C.surface2, borderRadius: 3 }}>
                    <div style={{ height:'100%', width:`${Math.min((Number(lsStats[k])/Math.max(...Object.values(lsStats).map(Number)))*100,100)}%`, background: C.amber, borderRadius: 3 }} />
                  </div>
                  <span className="admin-mono" style={{ fontSize: 10, color: C.text3, width: 42, textAlign:'right' }}>{lsStats[k]} KB</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ background:`${C.rose}08`, border:`1px solid ${C.rose}22`, borderRadius: 12, padding: 20 }}>
          <div className="admin-syne" style={{ fontSize: 13, fontWeight: 700, color: C.rose, letterSpacing:'.06em', textTransform:'uppercase', marginBottom: 14 }}>Danger Zone</div>
          <div style={{ display:'flex', gap: 10, flexWrap:'wrap' }}>
            {[
              { label:'Clear Restaurant Cache', key:'nearby-yelp-restaurants', desc:'Removes Yelp restaurant cache' },
              { label:'Clear All Ratings', key:'RATINGS_ALL', desc:'Deletes all dish ratings' },
              { label:'Clear Community Posts', key:'community-posts', desc:'Removes all community posts' },
            ].map(({ label, key, desc }) => (
              <button key={key} className="admin-btn-danger" style={{ padding:'8px 16px', borderRadius: 8, fontSize: 12 }} onClick={() => {
                if (!window.confirm(`Really clear: ${label}?`)) return
                if (key === 'RATINGS_ALL') {
                  Object.keys(localStorage).filter(k => k.startsWith('dishRatings-')).forEach(k => localStorage.removeItem(k))
                  setAllRatings({})
                } else {
                  localStorage.removeItem(key)
                  if (key === 'nearby-yelp-restaurants') setCachedRestaurants([])
                  if (key === 'community-posts') setCommunityPosts([])
                }
                showToast(`Cleared: ${label}`, 'danger')
              }}>
                <Trash2 size={12} style={{ display:'inline', marginRight: 5 }} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ─── Section router ─── */
  const sections = {
    dashboard:    <DashboardSection />,
    restaurants:  <RestaurantsSection />,
    'menu-items': <MenuItemsSection />,
    users:        <UsersSection />,
    moderation:   <ModerationSection />,
    analytics:    <AnalyticsSection />,
    algorithm:    <AlgorithmSection />,
    monetization: <MonetizationSection />,
    system:       <SystemSection />,
  }

  /* ─── Render ─── */
  return (
    <div className="admin-panel" style={{ position:'fixed', inset: 0, background: C.bg, color: C.text, display:'flex', flexDirection:'column', zIndex: 9999, fontFamily:'Figtree,sans-serif' }}>
      <style>{FONT_STYLE}</style>

      {/* Top bar */}
      <div style={{ height: 52, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', flexShrink: 0, background: C.surface }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div className="admin-syne" style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>Admin Console</div>
          <div style={{ width: 6, height: 6, borderRadius:'50%', background: C.border }} />
          <div style={{ fontSize: 12, color: C.text3 }}>TasteTrails v1</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 6, fontSize: 12, color: C.text3 }}>
            <div className="admin-live-dot" style={{ width: 6, height: 6, borderRadius:'50%', background: apiHealth === true ? C.emerald : C.rose }} />
            {apiHealth === true ? 'Backend online' : 'Backend offline'}
          </div>
          <button onClick={onClose} style={{ background:`${C.rose}18`, border:`1px solid ${C.rose}44`, color: C.rose, borderRadius: 8, padding:'6px 14px', fontSize: 12, fontWeight: 700, cursor:'pointer', display:'flex', alignItems:'center', gap: 6, transition:'.15s' }}>
            <X size={13} />Exit Admin
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display:'flex', overflow:'hidden' }}>
        <Sidebar />
        <main className="admin-scroll" style={{ flex: 1, overflowY:'auto', padding: 28 }}>
          {sections[active] || <DashboardSection />}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom: 24, right: 24, zIndex: 10000,
          background: toast.type === 'danger' ? `${C.rose}22` : `${C.emerald}22`,
          border: `1px solid ${toast.type === 'danger' ? C.rose : C.emerald}44`,
          color: toast.type === 'danger' ? C.rose : C.emerald,
          borderRadius: 10, padding:'10px 18px', fontSize: 13, fontWeight: 600,
          display:'flex', alignItems:'center', gap: 8, backdropFilter:'blur(8px)',
          animation: 'adminFadeIn .2s ease'
        }}>
          <CheckCircle size={14} />{toast.msg}
        </div>
      )}
    </div>
  )
}
