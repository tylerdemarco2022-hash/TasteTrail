import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import StarRating from './StarRating'
import MenuCard from './MenuCard'
import { posts, restaurants as allRestaurants } from '../data'
import Reviews from './Reviews'
import ItemRating from './ItemRating'
import { API_BASE } from "../config";
import { inferDietTags } from '../utils/dietTags';
import { menuData as localMenuData } from '../menuData';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuidLike(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

function toSectionsFromCategories(categories) {
  if (!Array.isArray(categories)) return []
  return categories
    .map((cat) => ({
      name: cat?.name || cat?.category || 'Menu',
      items: Array.isArray(cat?.items) ? cat.items : []
    }))
    .filter((section) => section.items.length > 0)
}

function toSectionsFromFlatItems(items) {
  if (!Array.isArray(items) || items.length === 0) return []
  const groups = new Map()
  for (const rawItem of items) {
    if (!rawItem) continue
    const category = rawItem.section_name || rawItem.category || rawItem.section || 'Menu'
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category).push(rawItem)
  }
  return Array.from(groups.entries()).map(([name, groupedItems]) => ({
    name,
    items: groupedItems
  }))
}

function normalizeMenuPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { name: '', sections: [] }
  }

  const payloadName = payload.name || payload.restaurant || ''
  const payloadId = payload.id || payload.restaurant_id || null

  const directSections = Array.isArray(payload.sections) ? payload.sections : []
  if (directSections.length > 0) {
    return {
      id: payloadId,
      name: payloadName,
      restaurant: payload.restaurant || payloadName,
      sections: toSectionsFromCategories(directSections)
    }
  }

  const rawMenu = Array.isArray(payload.menu) ? payload.menu : []
  if (rawMenu.length > 0) {
    const looksLikeSectionGroups = rawMenu.some((entry) => Array.isArray(entry?.items))
    return {
      id: payloadId,
      name: payloadName,
      restaurant: payload.restaurant || payloadName,
      sections: looksLikeSectionGroups
        ? toSectionsFromCategories(rawMenu)
        : toSectionsFromFlatItems(rawMenu)
    }
  }

  if (Array.isArray(payload.categories) && payload.categories.length > 0) {
    return {
      id: payloadId,
      name: payloadName,
      restaurant: payload.restaurant || payloadName,
      sections: toSectionsFromCategories(payload.categories)
    }
  }

  return {
    id: payloadId,
    name: payloadName,
    restaurant: payload.restaurant || payloadName,
    sections: []
  }
}

function countSectionItems(sections) {
  if (!Array.isArray(sections)) return 0
  return sections.reduce((sum, section) => sum + (Array.isArray(section?.items) ? section.items.length : 0), 0)
}

function readAdminToken() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return ''
  return String(localStorage.getItem('admin-token') || 'dev-token-change-me').trim()
}

function toSectionsFromAdminItems(items = [], activeType = '') {
  if (!Array.isArray(items) || items.length === 0) return []

  const normalizedType = String(activeType || '').trim().toLowerCase()
  const typedItems = normalizedType
    ? items.filter((item) => String(item?.menu_type || '').trim().toLowerCase() === normalizedType)
    : []
  const sourceItems = typedItems.length > 0 ? typedItems : items

  const grouped = new Map()
  for (const rawItem of sourceItems) {
    if (!rawItem || typeof rawItem !== 'object') continue

    const sectionName = String(rawItem.section_name || rawItem.category || 'Uncategorized').trim() || 'Uncategorized'
    const normalizedItem = {
      ...rawItem,
      section_name: sectionName,
      category: String(rawItem.category || sectionName).trim() || sectionName
    }

    if (!grouped.has(sectionName)) grouped.set(sectionName, [])
    grouped.get(sectionName).push(normalizedItem)
  }

  return Array.from(grouped.entries()).map(([name, sectionItems]) => ({
    name,
    category: name,
    items: sectionItems
  }))
}

function toFetchErrorMessage(error) {
  const text = String(error?.message || error || '')
  if (/failed to fetch|networkerror|load failed/i.test(text)) {
    return `Cannot reach backend at ${API_BASE}. Start the backend with: npm run server`
  }
  return `Menu fetch error: ${text || 'Unknown error'}`
}

const ADMIN_MENU_PREFS_PREFIX = 'admin-menu-display-prefs-'
const ADMIN_ITEM_OVERRIDES_PREFIX = 'admin-item-overrides-'
const ADMIN_MENU_SNAPSHOT_PREFIX = 'admin-menu-snapshot-'
const ADMIN_SORT_MODES = new Set([
  'course',
  'section_asc',
  'section_desc',
  'name_asc',
  'name_desc',
  'price_low',
  'price_high'
])
const ADMIN_SECTION_COURSE_ORDER = [
  { rank: 1, regex: /(to start|starter|starters|appetizer|appetizers|small plate|small plates|raw|shared|shareables?)/i },
  { rank: 2, regex: /(soup|soups|salad|salads)/i },
  { rank: 3, regex: /(sandwich|sandwiches|burger|burgers|taco|tacos|wrap|wraps)/i },
  { rank: 4, regex: /(entree|entrees|main|mains|pasta|pastas|pizza|pizzas|grill|from the grill|signature)/i },
  { rank: 5, regex: /(vegetable|vegetables|side|sides)/i },
  { rank: 6, regex: /(dessert|desserts|sweet|sweets)/i },
  { rank: 7, regex: /(drink|drinks|beverage|beverages|cocktail|cocktails|wine|beer)/i },
  { rank: 8, regex: /(kids|children)/i }
]

function normalizeLookupToken(value) {
  return String(value || '').trim().toLowerCase()
}

function getLookupValueVariants(value) {
  const base = String(value || '').trim()
  if (!base) return []

  const variants = [base]
  const collapsed = base.replace(/\s+/g, ' ').trim()
  if (collapsed && collapsed !== base) variants.push(collapsed)

  const beforeParen = collapsed.split('(')[0]?.trim()
  if (beforeParen && beforeParen !== collapsed) variants.push(beforeParen)

  const beforeComma = collapsed.split(',')[0]?.trim()
  if (beforeComma && beforeComma !== collapsed) variants.push(beforeComma)

  const beforeDash = collapsed.split(/\s[-\u2013\u2014|]\s/)[0]?.trim()
  if (beforeDash && beforeDash !== collapsed) variants.push(beforeDash)

  return variants
}

function safeParseObject(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

function getUniqueLookupCandidates(values = []) {
  const seen = new Set()
  const unique = []
  for (const value of values) {
    const variants = getLookupValueVariants(value)
    for (const variant of variants) {
      const token = normalizeLookupToken(variant)
      if (!token || seen.has(token)) continue
      seen.add(token)
      unique.push(variant)
    }
  }
  return unique
}

function readMatchingStorageObjects(prefix, rawCandidates) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return []
  const candidates = getUniqueLookupCandidates(rawCandidates)
  if (candidates.length === 0) return []

  const matches = []
  const seenStorageKeys = new Set()

  for (const candidate of candidates) {
    const storageKey = `${prefix}${candidate}`
    const parsed = safeParseObject(localStorage.getItem(storageKey))
    if (parsed) {
      matches.push({ storageKey, value: parsed })
      seenStorageKeys.add(storageKey)
    }
  }

  const normalizedCandidates = new Set(candidates.map((candidate) => normalizeLookupToken(candidate)))
  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index)
    if (!storageKey || seenStorageKeys.has(storageKey) || !storageKey.startsWith(prefix)) continue
    const suffix = storageKey.slice(prefix.length)
    if (!normalizedCandidates.has(normalizeLookupToken(suffix))) continue
    const parsed = safeParseObject(localStorage.getItem(storageKey))
    if (!parsed) continue
    matches.push({ storageKey, value: parsed })
    seenStorageKeys.add(storageKey)
  }

  return matches
}

function readAdminDisplayPrefs(rawCandidates) {
  const matches = readMatchingStorageObjects(ADMIN_MENU_PREFS_PREFIX, rawCandidates)
  if (matches.length === 0) {
    return { sortMode: null, sectionFilter: 'all' }
  }

  let sortMode = null
  let sectionFilter = 'all'
  for (const match of matches) {
    const candidateSortMode = typeof match.value?.sortMode === 'string' ? match.value.sortMode : null
    if (ADMIN_SORT_MODES.has(candidateSortMode)) {
      sortMode = candidateSortMode
    }
    const candidateSectionFilter = typeof match.value?.sectionFilter === 'string' && match.value.sectionFilter.trim()
      ? match.value.sectionFilter.trim()
      : ''
    if (candidateSectionFilter) {
      sectionFilter = candidateSectionFilter
    }
  }

  return {
    sortMode,
    sectionFilter
  }
}

function readAdminItemOverrides(rawCandidates) {
  const matches = readMatchingStorageObjects(ADMIN_ITEM_OVERRIDES_PREFIX, rawCandidates)
  const byName = {}
  const byId = {}

  for (const match of matches) {
    for (const [entryKey, override] of Object.entries(match.value)) {
      if (!entryKey || !override || typeof override !== 'object' || Array.isArray(override)) continue
      if (String(entryKey).startsWith('__id:')) {
        const itemId = String(entryKey).slice(5).trim()
        if (!itemId) continue
        byId[itemId] = { ...(byId[itemId] || {}), ...override }
        continue
      }
      byName[entryKey] = { ...(byName[entryKey] || {}), ...override }
    }
  }

  return { byName, byId }
}

function readAdminMenuSnapshot(rawCandidates, activeType = '') {
  const matches = readMatchingStorageObjects(ADMIN_MENU_SNAPSHOT_PREFIX, rawCandidates)
  if (matches.length === 0) return []

  let chosenItems = []
  let chosenSavedAt = ''

  for (const match of matches) {
    const value = match?.value && typeof match.value === 'object' ? match.value : {}
    const items = Array.isArray(value?.items) ? value.items : []
    if (items.length === 0) continue

    const savedAt = String(value?.savedAt || value?.updatedAt || '').trim()
    if (!chosenSavedAt || (savedAt && savedAt > chosenSavedAt)) {
      chosenItems = items
      chosenSavedAt = savedAt
      continue
    }
    if (!savedAt && chosenItems.length === 0) {
      chosenItems = items
    }
  }

  return toSectionsFromAdminItems(chosenItems, activeType)
}

function getSectionCourseRank(sectionName = '') {
  const name = String(sectionName || '').trim()
  for (const entry of ADMIN_SECTION_COURSE_ORDER) {
    if (entry.regex.test(name)) return entry.rank
  }
  return 99
}

function parseMenuItemPrice(price) {
  if (price == null || price === '') return null
  if (typeof price === 'number') return Number.isFinite(price) ? price : null
  const parsed = parseFloat(String(price).replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function applyAdminMenuPresentation(rawSections, prefs, overrideMap) {
  if (!Array.isArray(rawSections) || rawSections.length === 0) return []

  const overrideByNameLookup = new Map()
  const overrideByIdLookup = new Map()
  const nameOverrides = (() => {
    if (overrideMap?.byName && typeof overrideMap.byName === 'object') return overrideMap.byName
    return overrideMap && typeof overrideMap === 'object' ? overrideMap : {}
  })()
  const idOverrides = overrideMap?.byId && typeof overrideMap.byId === 'object' ? overrideMap.byId : {}

  for (const [itemName, override] of Object.entries(nameOverrides || {})) {
    if (String(itemName).startsWith('__id:')) continue
    const token = normalizeLookupToken(itemName)
    if (!token || !override || typeof override !== 'object' || Array.isArray(override)) continue
    overrideByNameLookup.set(token, { ...(overrideByNameLookup.get(token) || {}), ...override })
  }
  for (const [itemId, override] of Object.entries(idOverrides || {})) {
    const idToken = String(itemId || '').trim()
    if (!idToken || !override || typeof override !== 'object' || Array.isArray(override)) continue
    overrideByIdLookup.set(idToken, { ...(overrideByIdLookup.get(idToken) || {}), ...override })
  }
  for (const [entryKey, override] of Object.entries(nameOverrides || {})) {
    if (!String(entryKey).startsWith('__id:')) continue
    const idToken = String(entryKey).slice(5).trim()
    if (!idToken || !override || typeof override !== 'object' || Array.isArray(override)) continue
    overrideByIdLookup.set(idToken, { ...(overrideByIdLookup.get(idToken) || {}), ...override })
  }
  const sortMode = ADMIN_SORT_MODES.has(prefs?.sortMode) ? prefs.sortMode : null
  const sectionFilter = String(prefs?.sectionFilter || 'all').trim()
  const normalizedSectionFilter = normalizeLookupToken(sectionFilter)
  const hasSectionFilter = Boolean(normalizedSectionFilter && normalizedSectionFilter !== 'all')

  if (overrideByNameLookup.size === 0 && overrideByIdLookup.size === 0 && !sortMode && !hasSectionFilter) {
    return rawSections
  }

  const flattenedItems = []
  rawSections.forEach((section, sectionIndex) => {
    const sectionName = String(section?.name || section?.category || 'Menu').trim() || 'Menu'
    const sectionItems = Array.isArray(section?.items) ? section.items : []
    sectionItems.forEach((item, itemIndex) => {
      if (!item || typeof item !== 'object') return
      const itemIdToken = String(item?.id || '').trim()
      const itemToken = getMenuItemSortName(item)
      const override = (itemIdToken && overrideByIdLookup.get(itemIdToken)) || (itemToken ? overrideByNameLookup.get(itemToken) : null)
      const mergedItem = override ? { ...item, ...override } : { ...item }
      if (override && typeof override === 'object') {
        const overrideSectionName = String(override.section_name || '').trim()
        const overrideCategory = String(override.category || '').trim()
        if (!overrideSectionName && overrideCategory) mergedItem.section_name = overrideCategory
        if (overrideSectionName && !overrideCategory) mergedItem.category = overrideSectionName
      }
      const finalSectionName = String(
        mergedItem.section_name || mergedItem.category || mergedItem.section || sectionName
      ).trim() || 'Menu'

      flattenedItems.push({
        ...mergedItem,
        __sectionName: finalSectionName,
        __sectionOrder: sectionIndex,
        __itemOrder: itemIndex
      })
    })
  })

  if (flattenedItems.length === 0) return []

  const filteredItems = hasSectionFilter
    ? flattenedItems.filter((item) => normalizeLookupToken(item.__sectionName) === normalizedSectionFilter)
    : flattenedItems

  const grouped = new Map()
  for (const item of filteredItems) {
    if (!grouped.has(item.__sectionName)) grouped.set(item.__sectionName, [])
    grouped.get(item.__sectionName).push(item)
  }

  let sections = Array.from(grouped.entries()).map(([name, items]) => ({ name, items }))

  if (sortMode === 'section_asc') {
    sections.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortMode === 'section_desc') {
    sections.sort((a, b) => b.name.localeCompare(a.name))
  } else if (sortMode === 'course') {
    sections.sort((a, b) => {
      const byCourse = getSectionCourseRank(a.name) - getSectionCourseRank(b.name)
      if (byCourse !== 0) return byCourse
      return a.name.localeCompare(b.name)
    })
  }

  return sections.map((section) => {
    const nextItems = [...section.items]
    if (sortMode === 'name_asc') {
      nextItems.sort((a, b) => getMenuItemSortName(a).localeCompare(getMenuItemSortName(b)))
    } else if (sortMode === 'name_desc') {
      nextItems.sort((a, b) => getMenuItemSortName(b).localeCompare(getMenuItemSortName(a)))
    } else if (sortMode === 'price_low') {
      nextItems.sort((a, b) => {
        const aPrice = parseMenuItemPrice(a.price)
        const bPrice = parseMenuItemPrice(b.price)
        if (aPrice == null && bPrice == null) return getMenuItemSortName(a).localeCompare(getMenuItemSortName(b))
        if (aPrice == null) return 1
        if (bPrice == null) return -1
        if (aPrice !== bPrice) return aPrice - bPrice
        return getMenuItemSortName(a).localeCompare(getMenuItemSortName(b))
      })
    } else if (sortMode === 'price_high') {
      nextItems.sort((a, b) => {
        const aPrice = parseMenuItemPrice(a.price)
        const bPrice = parseMenuItemPrice(b.price)
        if (aPrice == null && bPrice == null) return getMenuItemSortName(a).localeCompare(getMenuItemSortName(b))
        if (aPrice == null) return 1
        if (bPrice == null) return -1
        if (aPrice !== bPrice) return bPrice - aPrice
        return getMenuItemSortName(a).localeCompare(getMenuItemSortName(b))
      })
    } else {
      nextItems.sort((a, b) => {
        if (a.__itemOrder !== b.__itemOrder) return a.__itemOrder - b.__itemOrder
        return getMenuItemSortName(a).localeCompare(getMenuItemSortName(b))
      })
    }

    return {
      name: section.name,
      items: nextItems.map((item) => {
        const { __sectionName, __sectionOrder, __itemOrder, ...cleanItem } = item
        return cleanItem
      })
    }
  })
}

const MENU_TAB_RULES = [
  // DEPRECATED: This is no longer used
  // Categories are now preserved from the original menu structure
  // No automatic classification happens
]

const MENU_TAB_ORDER = [
  // DEPRECATED: Dynamic ordering based on section appearance
  // Sections now appear in the order they were scraped
]

const COMMUNITY_POSTS_KEY = 'community-posts'

function getCurrentFeedUser() {
  try {
    const rawProfile = localStorage.getItem('user_profile')
    const profile = rawProfile ? JSON.parse(rawProfile) : null
    const id = String(profile?.id || 'user1')
    const name = String(profile?.name || 'You')
    const avatarRaw = localStorage.getItem(`taste-trails-avatar:${id}`)
    const avatar = avatarRaw ? JSON.parse(avatarRaw) : 'https://i.pravatar.cc/64?img=1'
    return { id, name, avatar: avatar || 'https://i.pravatar.cc/64?img=1' }
  } catch {
    return { id: 'user1', name: 'You', avatar: 'https://i.pravatar.cc/64?img=1' }
  }
}

function getMenuItemSortName(item = {}) {
  return String(item?.name || item?.dish_name || item?.dish || item?.title || '').trim().toLowerCase()
}

function getMenuCategoryMeta(item = {}, sectionName = '') {
  // Prefer using the item's category field directly (from restaurant's menu)
  const itemCategory = String(item?.category || '').trim()
  if (itemCategory) {
    return { key: itemCategory.toLowerCase().replace(/\s+/g, '_'), label: itemCategory }
  }
  
  // Fallback to section name if item has no category
  const sectionText = String(sectionName || '').trim()
  if (sectionText) {
    return { key: sectionText.toLowerCase().replace(/\s+/g, '_'), label: sectionText }
  }

  return { key: 'menu', label: 'Menu' }
}

export default function MenuView({ post, onBack, showAI }) {
  const [aiMenu, setAiMenu] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRating, setNewRating] = useState(4)
  const [newImage, setNewImage] = useState(null)
  const [newPrice, setNewPrice] = useState(2)
  const [savedItemsState, setSavedItemsState] = useState([])
  const profileId = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('user_profile')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.id) return String(parsed.id)
      }
    } catch (e) {}
    return localStorage.getItem('currentProfileId') || 'guest'
  }, [])
  const flagStorageKey = React.useMemo(() => `menu-item-flags:${profileId}`, [profileId])
  const [flaggedItems, setFlaggedItems] = useState(() => {
    try {
      const raw = localStorage.getItem(flagStorageKey)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })
  
  // Dish summary modal state
  const [showSummary, setShowSummary] = useState(false)
  const [summaryDish, setSummaryDish] = useState(null)
  const [dishDescription, setDishDescription] = useState('')
  
  // Menu fetching state
  const [fetchedMenu, setFetchedMenu] = useState(null)
  const [menuLoading, setMenuLoading] = useState(false)
  
  // Dish rating state
  const [dishRatings, setDishRatings] = useState({}) // dishName -> { totalRating, count, userRating }
  const [ratingDish, setRatingDish] = useState(null) // Currently rating dish
  const [userDishRating, setUserDishRating] = useState(5) // User's rating input (1-10)
  const [showItemRating, setShowItemRating] = useState(false)
  const [ratingItem, setRatingItem] = useState(null)
  const [activeCategoryTab, setActiveCategoryTab] = useState('all')
  const [activeFilter, setActiveFilter] = useState(null) // Quick filter state
  const [expandedSections, setExpandedSections] = useState({ drinks: false }) // Track which sections are expanded
  const didAutoGenerateMenu = useRef(false)
  const sectionRefs = useRef({})

  const [menuData, setMenuData] = useState(null); // New: menuData state for backend menu response

  // Menu type state (breakfast, lunch, dinner, drinks)
  const [availableTypes, setAvailableTypes] = useState([]);
  const [activeType, setActiveType] = useState(null);
  const [adminMenuSyncVersion, setAdminMenuSyncVersion] = useState(0)


  // Load dietary preferences on mount
  const [dietaryPreferences, setDietaryPreferences] = useState(() => {
    try {
      const prefs = localStorage.getItem('dietary_preferences')
      return prefs ? JSON.parse(prefs) : []
    } catch {
      return []
    }
  })

  if (!post) return null

  const restaurantName = post.restaurant || post.name || ''
  const restaurantId = React.useMemo(() => {
    if (isUuidLike(post?.restaurant_id)) return post.restaurant_id
    if (isUuidLike(post?.id)) return post.id
    return null
  }, [post?.restaurant_id, post?.id])
  const adminLookupCandidates = React.useMemo(() => {
    const keys = [
      restaurantId,
      post?.restaurant_id,
      post?.id,
      restaurantName,
      menuData?.id,
      menuData?.name,
      menuData?.restaurant
    ]
    return getUniqueLookupCandidates(keys)
  }, [restaurantId, post?.restaurant_id, post?.id, restaurantName, menuData?.id, menuData?.name, menuData?.restaurant])
  const adminDisplayPrefs = React.useMemo(() => {
    return readAdminDisplayPrefs(adminLookupCandidates)
  }, [adminLookupCandidates, adminMenuSyncVersion])
  const adminItemOverrides = React.useMemo(() => {
    return readAdminItemOverrides(adminLookupCandidates)
  }, [adminLookupCandidates, adminMenuSyncVersion])
  const adminSnapshotSections = React.useMemo(() => {
    return readAdminMenuSnapshot(adminLookupCandidates, activeType)
  }, [adminLookupCandidates, adminMenuSyncVersion, activeType])

  const persistFlaggedItems = (updater) => {
    setFlaggedItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem(flagStorageKey, JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  const buildFlagKey = (item) => {
    const baseId = item?.id || item?.name || 'unknown'
    const restId = restaurantId || post?.id || 'unknown'
    return `${restId}::${String(baseId).toLowerCase()}`
  }

  const isItemFlagged = (item) => Boolean(flaggedItems?.[buildFlagKey(item)])

  const saveLocalMenuFlag = (payload) => {
    try {
      const raw = localStorage.getItem('menu-item-flag-queue')
      const existing = raw ? JSON.parse(raw) : []
      const next = [payload, ...(Array.isArray(existing) ? existing : [])]
      localStorage.setItem('menu-item-flag-queue', JSON.stringify(next))
    } catch (e) {}
  }

  const handleFlagMenuItem = async (item) => {
    const reason = window.prompt('What seems wrong with this item? (e.g., not food, wrong name, missing price)')
    if (!reason) return

    const flagKey = buildFlagKey(item)
    persistFlaggedItems((prev) => ({
      ...prev,
      [flagKey]: {
        flagged_at: Date.now(),
        reason: reason.trim()
      }
    }))

    const payload = {
      menu_item_id: item?.id || null,
      restaurant_id: restaurantId,
      restaurant_name: restaurantName,
      item_name: item?.name || item?.dish_name || item?.dish || 'Unknown item',
      reason: reason.trim(),
      details: item?.description || null
    }

    try {
      const res = await fetch(`${API_BASE}/api/menu-item-flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        saveLocalMenuFlag(payload)
      }
    } catch (e) {
      saveLocalMenuFlag(payload)
    }
  }

  const saveLocalReviewReport = (payload) => {
    try {
      const raw = localStorage.getItem('review-report-queue')
      const existing = raw ? JSON.parse(raw) : []
      const next = [payload, ...(Array.isArray(existing) ? existing : [])]
      localStorage.setItem('review-report-queue', JSON.stringify(next))
    } catch (e) {}
  }

  const handleReportReview = async (dish, review) => {
    const reason = window.prompt('Why are you reporting this review?')
    if (!reason) return

    const payload = {
      menu_item_id: dish?.id || null,
      restaurant_id: restaurantId,
      restaurant_name: restaurantName,
      dish_name: dish?.name || null,
      rating_value: Number(review?.rating) || null,
      comment: review?.comment || null,
      reason: reason.trim(),
      details: review?.timestamp ? `reviewed_at:${review.timestamp}` : null
    }

    try {
      const res = await fetch(`${API_BASE}/api/review-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        saveLocalReviewReport(payload)
      }
    } catch (e) {
      saveLocalReviewReport(payload)
    }
  }

  // Load dish ratings from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem(`dishRatings-${post.restaurant || post.name}`)
    if (saved) {
      try {
        const loaded = JSON.parse(saved)
        setDishRatings(loaded)
        const dishCount = Object.keys(loaded).length
        const totalReviews = Object.values(loaded).reduce((sum, dish) => sum + (dish.count || 0), 0)
        console.log(`📖 Loaded ${totalReviews} reviews for ${dishCount} dishes from localStorage`)
      } catch (e) {
        console.warn('Failed to load dish ratings:', e)
      }
    }
  }, [post.restaurant, post.name])

  // Hydrate menu items with stored review data whenever dishRatings changes
  React.useEffect(() => {
    if (!dishRatings || Object.keys(dishRatings).length === 0) return

    const hydrateItemWithReviews = (item) => {
      const itemName = item?.name || item?.dish_name || item?.dish || ''
      const dishData = dishRatings[itemName]
      
      if (!dishData || !dishData.count) return item

      // Update item with complete review data from localStorage
      return {
        ...item,
        avg_rating: Number(dishData.average.toFixed(1)),
        rating: Number(dishData.average.toFixed(1)),
        rating_bayesian: Number(dishData.average.toFixed(1)),
        rating_count: dishData.count,
        ratings_count: dishData.count,
        all_reviews: dishData.reviews
      }
    }

    // Hydrate all menu sources
    if (Array.isArray(fetchedMenu) && fetchedMenu.length > 0) {
      setFetchedMenu(prev => prev.map(hydrateItemWithReviews))
    }
    if (Array.isArray(aiMenu) && aiMenu.length > 0) {
      setAiMenu(prev => prev.map(hydrateItemWithReviews))
    }
    if (menuData?.sections) {
      setMenuData(prev => ({
        ...prev,
        sections: prev.sections.map(section => ({
          ...section,
          items: section.items.map(hydrateItemWithReviews)
        }))
      }))
    }
  }, [dishRatings]) // Re-run when dishRatings changes (on load or after rating)

  React.useEffect(() => {
    // Fetch available menu types when component/restaurant changes
    if (restaurantName) {
      fetchMenuTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantName])

  React.useEffect(() => {
    // Refetch menu when active type changes
    if ((restaurantId || restaurantName) && activeType) {
      fetchMenuFromBackend({ restaurantId, restaurantName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType])
  async function triggerMenuScrape() {
    console.log('🔄 Triggering menu scrape for:', post.restaurant || post.name)
    setMenuLoading(true)
    try {
      const restaurantName = post.restaurant || post.name
      const location = post.location || 'Charlotte, NC'
      
      // Try full pipeline first
      const res = await fetch(
        `${API_BASE}/api/restaurant/${encodeURIComponent(restaurantName)}/full-menu?location=${encodeURIComponent(location)}&parseWithAI=true&enrichDescriptions=true`
      )
      
      const data = await res.json()
      
      if (data.success && data.categories && data.categories.length > 0) {
        console.log('✅ Scraped', data.itemCount, 'items from', data.source)
        // Flatten categories into items array
        const allItems = data.categories.flatMap(cat => 
          cat.items.map(item => ({ 
            name: item.name, 
            price: item.price,
            description: item.description,
            category: cat.category 
          }))
        )
        setFetchedMenu(allItems)
      } else if (data.needsOCR && data.pdfPath) {
        console.log('⚠️ PDF detected, needs OCR processing')
        alert(`PDF menu found! Path: ${data.pdfPath}\nYou can send this to OCR for processing.`)
      } else {
        console.warn('Scrape failed:', data.error)
        alert(`Could not fetch menu: ${data.error}`)
      }
    } catch (e) {
      console.error('Scrape error:', e.message)
      alert(`Error scraping menu: ${e.message}`)
    }
    setMenuLoading(false)
  }

  async function autoFetchFullMenu() {
    console.log('🤖 Auto-fetching menu from web...')
    setMenuLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auto-fetch-menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: post.restaurant || post.name,
          location: post.location || 'Charlotte, NC'
        })
      })
      
      const data = await res.json()
      
      if (data.status === 'SUCCESS' && data.menuData) {
        // Flatten all categories into one array
        const allItems = data.menuData.flatMap(cat => 
          cat.items.map(item => ({ ...item, category: cat.category }))
        )
        console.log('✅ Auto-fetched', allItems.length, 'items from web')
        setFetchedMenu(allItems)
      } else if (data.status === 'NEEDS_OCR') {
        alert('This restaurant has a PDF menu. Please check: ' + data.url)
      } else {
        console.warn('Auto-fetch failed:', data.status)
      }
    } catch (e) {
      console.error('Auto-fetch error:', e.message)
    }
    setMenuLoading(false)
  }

  async function fetchMenuFromBackend({ restaurantId, restaurantName }) {
    setMenuLoading(true);
    try {
      let data = null;
      let normalized = { name: restaurantName || '', sections: [] };

      // Build the type parameter for API calls
      const typeParam = activeType ? `&type=${activeType}` : '';

      if (restaurantId) {
        console.log("Menu fetch by ID:", restaurantId, "Type:", activeType);
        const idUrl = `${API_BASE}/api/restaurants/${restaurantId}/full-menu?type=${activeType || 'dinner'}`;
        const idRes = await fetch(idUrl);
        if (idRes.ok) {
          data = await idRes.json();
          normalized = normalizeMenuPayload(data);
        } else {
          console.warn("ID menu fetch failed:", idRes.status);
        }
      }

      if (normalized.sections.length === 0 && restaurantName) {
        console.log("Menu fetch by name fallback:", restaurantName, "Type:", activeType);
        const nameUrl = `${API_BASE}/api/restaurants/${encodeURIComponent(restaurantName)}?type=${activeType || 'dinner'}`;
        const nameRes = await fetch(nameUrl);
        if (nameRes.ok) {
          data = await nameRes.json();
          normalized = normalizeMenuPayload(data);
        } else {
          console.warn("Name menu fetch failed:", nameRes.status);
        }
      }

      // Admin-side source of truth: if admin token exists and restaurant ID is known,
      // prefer the same menu_items dataset used by Admin Panel.
      const adminToken = readAdminToken()
      const resolvedRestaurantId = String(restaurantId || normalized?.id || data?.id || '').trim()
      if (adminToken && isUuidLike(resolvedRestaurantId)) {
        try {
          const adminRes = await fetch(`${API_BASE}/admin/menu-items/restaurant/${resolvedRestaurantId}`, {
            headers: { 'x-admin-token': adminToken }
          })
          if (adminRes.ok) {
            const adminPayload = await adminRes.json().catch(() => ({}))
            const adminItems = Array.isArray(adminPayload?.items) ? adminPayload.items : []
            const adminSections = toSectionsFromAdminItems(adminItems, activeType)
            if (adminSections.length > 0) {
              normalized = {
                ...normalized,
                id: resolvedRestaurantId,
                name: normalized?.name || restaurantName || '',
                restaurant: normalized?.restaurant || restaurantName || '',
                sections: adminSections
              }
              console.log('[MenuView] Using admin menu items source for user display:', {
                restaurantId: resolvedRestaurantId,
                sections: adminSections.length,
                items: countSectionItems(adminSections)
              })
            }
          }
        } catch (adminErr) {
          console.warn('[MenuView] Admin source fetch failed, falling back to public menu source:', adminErr?.message || adminErr)
        }
      }

      const currentCount = countSectionItems(normalized.sections);
      if (restaurantName && currentCount < 8) {
        console.log("Menu appears incomplete, refreshing source scrape for:", restaurantName);
        const refreshUrl = `${API_BASE}/api/restaurants/${encodeURIComponent(restaurantName)}?refresh=1&type=${activeType || 'dinner'}`;
        const refreshRes = await fetch(refreshUrl);
        if (refreshRes.ok) {
          const refreshedData = await refreshRes.json();
          const refreshed = normalizeMenuPayload(refreshedData);
          const refreshedCount = countSectionItems(refreshed.sections);
          if (refreshedCount > currentCount) {
            normalized = refreshed;
          }
        } else {
          console.warn("Refresh scrape failed:", refreshRes.status);
        }
      }

      // Fallback to local static menu data if backend returned nothing
      if (normalized.sections.length === 0 && restaurantName) {
        const localKey = Object.keys(localMenuData).find(
          k => k.toLowerCase() === restaurantName.toLowerCase()
        )
        if (localKey && Array.isArray(localMenuData[localKey])) {
          const localSections = toSectionsFromFlatItems(localMenuData[localKey])
          if (localSections.length > 0) {
            console.log(`Using local menu fallback for "${restaurantName}" (${localKey})`)
            normalized = { name: restaurantName, sections: localSections }
          }
        }
      }

      console.log("Normalized fetched menu:", normalized);
      setMenuData(normalized);
    } catch (e) {
      console.error("Menu fetch error:", e.message);
      // Try local menu fallback before showing error
      const localKey = Object.keys(localMenuData).find(
        k => k.toLowerCase() === restaurantName.toLowerCase()
      )
      if (localKey && Array.isArray(localMenuData[localKey])) {
        const localSections = toSectionsFromFlatItems(localMenuData[localKey])
        if (localSections.length > 0) {
          console.log(`Using local menu fallback for "${restaurantName}" after error`)
          setMenuData({ name: restaurantName, sections: localSections })
          setMenuLoading(false)
          return
        }
      }
      alert(toFetchErrorMessage(e));
      setMenuData({ name: restaurantName || '', sections: [] });
    }
    setMenuLoading(false);
  }

  async function fetchMenuTypes() {
    // Fetch available menu types for this restaurant by name
    if (!restaurantName) return;
    
    console.log('🔍 fetchMenuTypes() called for restaurant:', restaurantName);
    
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/${encodeURIComponent(restaurantName)}/types`);
      if (res.ok) {
        const data = await res.json();
        console.log('TYPES API RESPONSE:', data);
        console.log('📋 Available menu types:', data.available_types);
        setAvailableTypes(data.available_types || []);
        
        // Auto-select logic:
        // - If only 1 type exists → select it
        // - Else if 'dinner' is available → select 'dinner'
        // - Else select first available type
        if (data.available_types && data.available_types.length > 0) {
          if (data.available_types.length === 1) {
            setActiveType(data.available_types[0]);
            console.log('🔄 Only one menu type available, auto-selecting:', data.available_types[0]);
          } else if (data.available_types.includes('dinner')) {
            setActiveType('dinner');
            console.log('🔄 Multiple types available, defaulting to dinner');
          } else {
            setActiveType(data.available_types[0]);
            console.log('🔄 Multiple types available, selecting first:', data.available_types[0]);
          }
        }
      } else {
        console.warn('Failed to fetch menu types. Status:', res.status);
        console.log('API Response was not ok');
        setAvailableTypes(['dinner']);
        setActiveType('dinner');
      }
    } catch (e) {
      console.error('Error fetching menu types:', e.message);
      setAvailableTypes(['dinner']);
      setActiveType('dinner');
    }
  }

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('savedItems')) || [];
    setSavedItemsState(saved);
  }, []);

  React.useEffect(() => {
    const refreshAdminView = () => setAdminMenuSyncVersion((prev) => prev + 1)
    const onStorage = (event) => {
      const storageKey = String(event?.key || '')
      if (!storageKey) return
      if (
        storageKey.startsWith(ADMIN_MENU_PREFS_PREFIX) ||
        storageKey.startsWith(ADMIN_ITEM_OVERRIDES_PREFIX) ||
        storageKey.startsWith(ADMIN_MENU_SNAPSHOT_PREFIX)
      ) {
        refreshAdminView()
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('adminMenuPrefsChanged', refreshAdminView)
    window.addEventListener('itemOverridesChanged', refreshAdminView)
    window.addEventListener('adminMenuSnapshotChanged', refreshAdminView)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('adminMenuPrefsChanged', refreshAdminView)
      window.removeEventListener('itemOverridesChanged', refreshAdminView)
      window.removeEventListener('adminMenuSnapshotChanged', refreshAdminView)
    }
  }, [])

  async function aiFindMenu() {
    setLoading(true)
    // look for a matching post with a menu
    const needle = (post.restaurant || post.name || '').toLowerCase()
    const found = posts.find((p) => (p.restaurant || p.name || '').toLowerCase().includes(needle))
    if (found && found.menu && found.menu.length) {
      // simulate AI returning structured menu
      setAiMenu(found.menu)
      setLoading(false)
      return
    }

    // Do not generate placeholder menu items; show explicit "Could not find menu" instead.
    setAiMenu([])
    setLoading(false)
  }

  const displayMenu =
    (Array.isArray(fetchedMenu) && fetchedMenu.length ? fetchedMenu : null) ||
    (Array.isArray(aiMenu) && aiMenu.length ? aiMenu : null) ||
    (Array.isArray(post.menu) && post.menu.length ? post.menu : [])
  // Show menu URL if available
  const menuUrl = post.menu_url || post.menuUrl || post.url || null;

  const normalizeMenuItems = (menu) => {
    if (Array.isArray(menu)) {
      return menu.flatMap((entry) => {
        if (typeof entry === 'string' || entry?.name || entry?.dish_name || entry?.dish || entry?.title) {
          return [entry]
        }
        if (Array.isArray(entry?.items)) return entry.items
        return []
      })
    }
    if (menu && Array.isArray(menu.categories)) {
      return menu.categories.flatMap((cat) => cat.items || [])
    }
    return []
  }

  const effectiveMenu = React.useMemo(() => {
    return normalizeMenuItems(displayMenu)
  }, [displayMenu])

  const fallbackSections = React.useMemo(() => {
    return toSectionsFromFlatItems(effectiveMenu)
  }, [effectiveMenu])

  const rawDisplaySections = React.useMemo(() => {
    if (Array.isArray(adminSnapshotSections) && adminSnapshotSections.length > 0) {
      return adminSnapshotSections
    }
    if (Array.isArray(menuData?.sections) && menuData.sections.length > 0) {
      return menuData.sections
    }
    return fallbackSections
  }, [adminSnapshotSections, menuData, fallbackSections])

  const displaySections = React.useMemo(() => {
    return applyAdminMenuPresentation(rawDisplaySections, adminDisplayPrefs, adminItemOverrides)
  }, [rawDisplaySections, adminDisplayPrefs, adminItemOverrides])

  const displayItemCount = React.useMemo(() => {
    return countSectionItems(displaySections)
  }, [displaySections])
  
  React.useEffect(() => {
    console.log('MenuView state - Fetched:', fetchedMenu?.length || 0, 'AI:', aiMenu?.length || 0, 'Post:', post.menu?.length || 0, 'Display:', effectiveMenu.length, 'MenuLoading:', menuLoading)
  }, [effectiveMenu, fetchedMenu, aiMenu, post.menu, menuLoading])

  React.useEffect(() => {
    if (menuLoading || didAutoGenerateMenu.current) return
    const hasItems =
      (Array.isArray(fetchedMenu) && fetchedMenu.length > 0) ||
      (Array.isArray(aiMenu) && aiMenu.length > 0) ||
      (Array.isArray(post.menu) && post.menu.length > 0)
    if (!hasItems) {
      didAutoGenerateMenu.current = true
      aiFindMenu()
    }
  }, [menuLoading, fetchedMenu, aiMenu, post.menu, post.restaurant, post.name])

  async function handleAddItem() {
    if (!newName) return
    const item = { name: newName, rating: newRating, price: newPrice }
    if (newImage) item.image = newImage

    // update local display
    const next = [item, ...effectiveMenu]
    setAiMenu ? setAiMenu(next) : (post.menu = next)

    // also try to update central restaurants list if possible
    try {
      const needle = (post.restaurant || post.name || '').toLowerCase()
      const r = allRestaurants.find((x) => (x.name || '').toLowerCase().includes(needle))
      if (r) {
        r.menu = r.menu || []
        r.menu.unshift(item)
      }
    } catch (e) {}

    // reset and close
    setNewName('')
    setNewRating(4)
    setNewPrice(2)
    setNewImage(null)
    setShowAddItem(false)
  }

  const toggleSaveItem = async (item) => {
    const saved = JSON.parse(localStorage.getItem('savedItems')) || [];
    const isSaved = saved.some((savedItem) => savedItem.name === item.name);

    if (isSaved) {
      // Remove item from savedItems
      const updatedSaved = saved.filter((savedItem) => savedItem.name !== item.name);
      localStorage.setItem('savedItems', JSON.stringify(updatedSaved));
      console.log('Unsaved item:', item); // Log the unsaved item
      
      // Remove from database
      try {
        await fetch(`${API_BASE}/api/saved-items`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: localStorage.getItem('currentProfileId') || 'defaultProfile',
            restaurant_name: post.restaurant || post.name,
            item_name: item.name
          })
        });
      } catch (e) {
        console.error('Failed to remove from database:', e);
      }
    } else {
      // Add item to savedItems
      const profileId = localStorage.getItem('currentProfileId') || 'defaultProfile';
      saved.push({ ...item, restaurant: post.restaurant || post.name, profileId });
      localStorage.setItem('savedItems', JSON.stringify(saved));
      console.log('Saved item:', item); // Log the saved item
      
      // Save to database
      try {
        await fetch(`${API_BASE}/api/saved-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: localStorage.getItem('currentProfileId') || 'defaultProfile',
            restaurant_id: post.id || post.yelpId || null,
            restaurant_name: post.restaurant || post.name,
            item_name: item.name,
            item_rating: item.rating,
            item_image: item.image
          })
        });
      } catch (e) {
        console.error('Failed to save to database:', e);
      }
    }

    // Emit custom event to notify other components
    const event = new Event('savedItemsUpdated');
    window.dispatchEvent(event);

    setSavedItemsState(JSON.parse(localStorage.getItem('savedItems')));
  };

  const isItemSaved = (item) => {
    return savedItemsState.some((savedItem) => savedItem.name === item.name);
  };

  const generateDishSummary = (dishName, restaurantName) => {
    // Simple AI-like description generator based on dish name keywords
    const descriptions = {
      // Asian dishes
      'bao': 'Soft, fluffy steamed buns filled with savory ingredients. A popular street food originating from China, these pillowy buns offer a perfect balance of texture and flavor.',
      'biryani': 'A fragrant rice dish layered with aromatic spices, herbs, and tender meat or vegetables. This beloved South Asian specialty is slow-cooked to perfection, creating complex flavors in every bite.',
      'ramen': 'Japanese noodle soup featuring rich broth, springy noodles, and various toppings. Each bowl is a comforting combination of umami flavors and satisfying textures.',
      'sushi': 'Traditional Japanese dish of vinegared rice paired with fresh fish, vegetables, or other ingredients. An art form that celebrates simplicity and freshness.',
      'pad thai': 'Stir-fried rice noodles with eggs, vegetables, and protein in a sweet-savory tamarind sauce. Thailand\'s most famous street food, perfectly balanced in flavor.',
      'pho': 'Vietnamese noodle soup with aromatic broth, rice noodles, herbs, and meat. A warming, fragrant bowl that\'s both light and deeply satisfying.',
      
      // Italian dishes
      'pizza': 'Classic Italian flatbread topped with tomato sauce, cheese, and various toppings, baked to perfection. Crispy crust meets melty cheese in this universally loved comfort food.',
      'pasta': 'Italian noodles served with a variety of sauces and ingredients. From creamy carbonara to rich bolognese, each pasta dish tells a delicious story.',
      'risotto': 'Creamy Italian rice dish cooked slowly with broth and finished with butter and cheese. Each grain is tender yet firm, creating a luxurious texture.',
      'lasagna': 'Layered pasta dish with meat sauce, cheese, and bechamel. Baked until bubbly and golden, it\'s the ultimate comfort food.',
      
      // American dishes
      'burger': 'Juicy grilled patty served in a soft bun with fresh toppings. A classic American favorite that\'s endlessly customizable and always satisfying.',
      'steak': 'Premium cut of beef grilled or pan-seared to your preference. Rich, savory, and tender, it\'s a timeless choice for meat lovers.',
      'bbq': 'Slow-smoked meats with tangy or sweet sauce. This American tradition delivers fall-off-the-bone tenderness and deep, smoky flavors.',
      'wings': 'Crispy chicken wings tossed in flavorful sauce. Perfect for sharing, these bite-sized treats pack big flavor in every piece.',
      'sandwich': 'Layered ingredients between slices of bread. Simple yet versatile, sandwiches can be customized to any taste preference.',
      
      // Mexican dishes
      'taco': 'Mexican tortilla filled with seasoned meat, vegetables, and toppings. A handheld delight bursting with fresh flavors and textures.',
      'burrito': 'Large flour tortilla wrapped around rice, beans, meat, and toppings. Hearty and filling, it\'s a complete meal in portable form.',
      'quesadilla': 'Grilled tortilla filled with melted cheese and other ingredients. Crispy on the outside, gooey on the inside.',
      
      // Breakfast items
      'toast': 'Toasted bread topped with spreads or ingredients. Simple yet versatile, from classic avocado to sweet fruit toppings.',
      'pancake': 'Fluffy griddle cakes served with syrup and toppings. A breakfast classic that\'s light, airy, and delicious.',
      'omelette': 'Beaten eggs cooked and folded with various fillings. Customizable and protein-packed to start your day right.',
      'waffle': 'Crispy on the outside, fluffy inside breakfast treat. Golden-brown with signature pockets perfect for holding syrup.',
      
      // Desserts
      'cake': 'Sweet baked dessert with layers of flavor and frosting. From chocolate to vanilla, each slice is a celebration.',
      'ice cream': 'Frozen dessert made from cream, sugar, and flavorings. Smooth, creamy, and refreshing in countless varieties.',
      'brownie': 'Rich, fudgy chocolate dessert square. Dense and decadent, perfect for chocolate lovers.',
      
      // Drinks
      'tea': 'Aromatic beverage brewed from tea leaves. Can be served hot or cold, plain or sweetened.',
      'coffee': 'Brewed beverage from roasted coffee beans. Rich, energizing, and available in countless preparations.',
      'smoothie': 'Blended drink of fruits, vegetables, and liquids. Refreshing and nutritious in a glass.',
      'bubble tea': 'Sweet tea-based drink with chewy tapioca pearls. Fun, flavorful, and endlessly customizable.',
      
      // Salads & Healthy
      'salad': 'Fresh vegetables and greens with dressing. Light, crisp, and full of vitamins and nutrients.',
      'bowl': 'Grain or protein base topped with vegetables and sauce. Healthy, balanced, and Instagram-worthy.',
      
      // Seafood
      'salmon': 'Rich, flaky fish packed with omega-3s. Grilled, baked, or raw, it\'s both delicious and nutritious.',
      'shrimp': 'Sweet, tender shellfish prepared in countless ways. From grilled to fried, these little bites pack big flavor.',
    }
    
    const lowerDish = dishName.toLowerCase()
    
    // Check for matching keywords
    for (const [keyword, description] of Object.entries(descriptions)) {
      if (lowerDish.includes(keyword)) {
        return description
      }
    }
    
    // Default description
    return `${dishName} is a signature dish at ${restaurantName}. This carefully crafted item combines fresh ingredients and expert preparation to deliver a memorable dining experience. Each element is thoughtfully selected to create a harmonious balance of flavors and textures that will delight your palate.`
  }

  const submitDishRating = async (dish, rating) => {
    // Resolve user ID from multiple possible localStorage sources
    let userId = localStorage.getItem('currentUserId');
    if (!userId) {
      try {
        const profile = JSON.parse(localStorage.getItem('user_profile') || 'null');
        userId = profile?.id || null;
      } catch {}
    }
    if (!userId) {
      try {
        const profile = JSON.parse(localStorage.getItem('selectedUserProfile') || 'null');
        userId = profile?.id || null;
      } catch {}
    }

    console.log('🔍 [Rating Debug]', {
      userId,
      dishId: dish?.id,
      dishName: dish?.name,
      ratingValue: rating,
      API_BASE
    });

    if (!userId) {
      console.error("❌ Not logged in - no user ID found in localStorage");
      alert("You must be logged in to rate.");
      return;
    }

    if (!dish?.id) {
      console.error("❌ Dish ID is missing:", dish);
      alert("Dish data is missing. Please try again.");
      return;
    }

    try {
      const payload = {
        dish_id: dish.id,
        user_id: userId,
        rating: Number(rating),
        dish_name: dish.name || dish.dish_name || '',
        restaurant_name: post?.restaurant || post?.name || ''
      };

      console.log('📤 [Rating] Sending payload:', payload);
      console.log('📤 [Rating] To URL:', `${API_BASE}/api/ratings`);
      
      const response = await fetch(`${API_BASE}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('📥 [Rating] Response status:', response.status);
      console.log('📥 [Rating] Response OK:', response.ok);
      
      if (!response.ok) {
        const text = await response.text()
        console.log("❌ [Rating] RAW RESPONSE:", text.slice(0, 500))
        let err
        try {
          err = JSON.parse(text)
        } catch (e) {
          console.error("❌ [Rating] NOT JSON RESPONSE:", text.slice(0, 200))
          throw e
        }
        console.error("❌ [Rating] Failed:", err);
        alert("Rating failed: " + (err?.error || "Unknown error"));
        return;
      }

      const data = await response.json();
      console.log('✅ [Rating] Success! Saved:', data);
      
      // Refetch menu data after successful rating submission
      await fetchMenuFromBackend({ restaurantId, restaurantName });

      setShowItemRating(false);
      setRatingItem(null);
      alert(`✅ Rating saved! Check the "Top Dishes" section to see it on the leaderboard.`);
    } catch (error) {
      console.error("❌ [Rating] Network error:", error);
      alert("An error occurred while submitting your rating. Check browser console for details.");
    }
  }

  const submitFakeRatings = async () => {
    const menuItems = Array.isArray(effectiveMenu) ? effectiveMenu.filter((item) => item && item.id) : []
    console.log('Menu items:', menuItems)
    if (!menuItems.length) {
      return
    }

    const userId = localStorage.getItem('currentUserId')
    if (!userId) {
      console.warn('No currentUserId found for fake ratings')
      return
    }

    const fakeRatings = menuItems.slice(0, 3).map((item, index) => ({
      dish_id: item.id,
      user_id: userId,
      rating: Math.max(1, Math.min(5, 5 - index))
    }))

    for (const fakeRating of fakeRatings) {
      try {
        console.log('Submitting rating payload:', fakeRating)
        const response = await fetch(`${API_BASE}/api/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fakeRating),
        });

        if (!response.ok) {
          const text = await response.text()
          console.log("RAW FETCH RESPONSE:", text.slice(0, 200))
          let err
          try {
            err = JSON.parse(text)
          } catch (e) {
            console.error("NOT JSON RESPONSE:", text.slice(0, 200))
            throw e
          }
          console.error('Fake rating submission failed:', err);
        } else {
          console.log('Fake rating submitted successfully:', fakeRating);
        }
      } catch (error) {
        console.error('Error submitting fake rating:', error);
      }
    }
  };

  // Call the function to submit fake ratings for testing
  const didSubmitFakeRatings = useRef(false)
  useEffect(() => {
    if (didSubmitFakeRatings.current) return
    if (!Array.isArray(effectiveMenu) || !effectiveMenu.length) return
    didSubmitFakeRatings.current = true
    submitFakeRatings()
  }, [effectiveMenu]);

  const getAverageDishRating = (dishName) => {
    const data = dishRatings[dishName]
    if (!data || !data.average) return null
    return data.average.toFixed(1)
  }

  const getDishRatingCount = (dishName) => {
    const data = dishRatings[dishName]
    return data ? data.count : 0
  }

  const getFakeItemRating = (itemName) => {
    const seed = String(itemName || 'item').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
    const rating = 6.8 + (seed % 28) / 10
    const count = 3 + (seed % 37)
    return { rating: rating.toFixed(1), count }
  }

  const getDisplayItemRating = (item) => {
    const localCount = getDishRatingCount(item?.name)
    if (localCount > 0) {
      const avg = getAverageDishRating(item?.name) || '0.0'
      return {
        rating: avg,
        count: localCount,
        isFake: false
      }
    }
    const ratingValue = Number(item?.rating_bayesian || 0)
    const ratingCount = Number(item?.rating_count || 0)
    if (ratingCount > 0) {
      return {
        rating: ratingValue ? ratingValue.toFixed(1) : '0.0',
        count: ratingCount,
        isFake: false
      }
    }
    const fake = getFakeItemRating(item?.name)
    return { rating: fake.rating, count: fake.count, isFake: true }
  }

  const handleShowSummary = (item) => {
    console.log('handleShowSummary called with item:', item);
    const dishName = item?.name || item?.dish_name || item?.dish || item?.title || 'Dish';
    const restaurantName = post?.restaurant || post?.name || 'this restaurant';
    setSummaryDish({ ...item, name: dishName });
    const rawDescription = item?.description || item?.desc || item?.details || '';
    const description = rawDescription.trim()
      ? rawDescription.trim()
      : generateDishSummary(dishName, restaurantName);
    console.log('Generated description:', description);
    setDishDescription(description);
    setShowSummary(true);
    console.log('Modal state set - showSummary: true, summaryDish:', dishName);
  }

  const getPriceDisplay = (price) => {
    if (!price) return '$8.99'
    // If it's a number under 10, treat it as price level and convert to actual price
    if (typeof price === 'number' && price <= 10) {
      const priceMap = { 1: 6.99, 2: 9.99, 3: 14.99, 4: 19.99, 5: 29.99 }
      return '$' + (priceMap[Math.round(price)] || 9.99).toFixed(2)
    }
    // If it's already a price string or larger number, return formatted
    if (typeof price === 'string') return price
    return '$' + Number(price).toFixed(2)
  }

  const getCategory = (name = '') => {
    const n = name.toLowerCase()
    if (/(pizza|margherita|pepperoni|formaggi)/.test(n)) return 'Pizza'
    if (/(pasta|lasagna|carbonara|fettuccine|ravioli|risotto|spaghetti|penne)/.test(n)) return 'Pasta'
    if (/(bao|dumpling|noodle|ramen|pho|pad thai|spring roll|biryani|curry|korma|tikka)/.test(n)) return 'Asian'
    if (/(burger|sandwich|wings|fries|steak|bbq|mac and cheese)/.test(n)) return 'American'
    if (/(salad|bowl|toast|quinoa|acai|smoothie)/.test(n)) return 'Salads & Bowls'
    if (/(dessert|cake|tiramisu|brownie|ice cream|pudding)/.test(n)) return 'Desserts'
    if (/(coffee|tea|latte|smoothie|shake|drink|lemonade)/.test(n)) return 'Drinks'
    if (/(seafood|shrimp|salmon|fish|calamari)/.test(n)) return 'Seafood'
    return 'Other'
  }

  // Helper to get tags (prefer item.tags, fallback to inferred)
  const getTags = React.useCallback((item) => {
    return Array.isArray(item?.tags) && item.tags.length > 0 ? item.tags : inferDietTags(item)
  }, [])

  // Check if an item matches user's dietary preferences
  const matchesDietaryPreferences = React.useCallback((item) => {
    // If user selected "none" or no preferences, show all items
    if (!dietaryPreferences || dietaryPreferences.length === 0 || dietaryPreferences.includes('none')) {
      return true
    }

    const tags = getTags(item)
    
    // If user selected vegetarian or vegan
    if (dietaryPreferences.includes('vegetarian') || dietaryPreferences.includes('vegan')) {
      return tags.includes('vegetarian')
    }

    return true
  }, [dietaryPreferences, getTags])

  // Helper function to check if item matches filter criteria
  const itemMatchesFilter = React.useCallback((item, filter) => {
    // First check if item matches dietary preferences
    if (!matchesDietaryPreferences(item)) return false
    
    if (!filter) return true
    
    const tags = getTags(item)
    
    switch (filter) {
      case 'TOP_RATED':
        return true // Show all items, sorted by rating (real or fake fallback)

      case 'MOST_ORDERED':
        return true // Show all items, sorted by review count (real or fake fallback)
        
      case 'HEALTHY':
        return tags.includes('healthy')
        
      case 'VEGETARIAN':
        return tags.includes('vegetarian')
        
      case 'SPICY':
        return tags.includes('spicy')
        
      case 'NEW': {
        // If is_new flag exists, use it; otherwise check created_at (last 14 days)
        if (item?.is_new === true) return true
        if (item?.created_at) {
          const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000)
          return new Date(item.created_at).getTime() >= cutoff
        }
        return false
      }
        
      default:
        return true
    }
  }, [getTags, matchesDietaryPreferences])

  // Build user-visible sections directly from resolved section data.
  // This keeps Admin section assignments as the source of truth.
  const categorySections = React.useMemo(() => {
    const grouped = new Map()

    for (const section of displaySections) {
      const sectionItems = Array.isArray(section?.items) ? section.items : []
      const fallbackSectionName = String(section?.name || section?.category || 'Menu').trim() || 'Menu'

      for (const item of sectionItems) {
        if (!item || item.isSubheader) continue
        if (!itemMatchesFilter(item, activeFilter)) continue

        const resolvedSectionName = String(
          item?.section_name || item?.category || item?.section || fallbackSectionName
        ).trim() || fallbackSectionName
        const sectionKey = resolvedSectionName.toLowerCase().replace(/\s+/g, '_')

        if (!grouped.has(sectionKey)) {
          grouped.set(sectionKey, {
            key: sectionKey,
            name: resolvedSectionName,
            items: []
          })
        }

        grouped.get(sectionKey).items.push(item)
      }
    }

    return Array.from(grouped.values()).filter((section) => section.items.length > 0)
  }, [displaySections, activeFilter, itemMatchesFilter]);

  const categoryTabs = React.useMemo(() => {
    const allCount = categorySections.reduce((sum, section) => sum + section.items.length, 0)
    return [
      { key: 'all', label: 'All Items', count: allCount },
      ...categorySections.map((section) => ({
        key: section.key,
        label: section.name,
        count: section.items.length
      }))
    ]
  }, [categorySections])

  // Always show all sections; tabs scroll to the relevant section (DoorDash-style)
  const visibleCategorySections = React.useMemo(() => categorySections, [categorySections])

  React.useEffect(() => {
    if (activeCategoryTab === 'all') return
    const exists = categoryTabs.some((tab) => tab.key === activeCategoryTab)
    if (!exists) setActiveCategoryTab('all')
  }, [activeCategoryTab, categoryTabs])

  const heroImage = post.image || post.image_url || post.imageUrl || post.photo || (post.photos && post.photos[0]) || post.cover || ''
  const heroStyle = heroImage
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.18)), url(${heroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : {
        background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(255,255,255,0.1))'
      }

  const restaurantDescription = post.description || post.about || post.summary || post.caption || 'No description available yet.'

  const handleRatingSubmit = async (reviewData) => {
    // Save to dish ratings
    const restaurantKey = post.restaurant || post.name
    const existing = dishRatings[reviewData.dishName] || { ratings: [], count: 0, sum: 0, reviews: [] }
    
    // Add new rating
    const newRatings = [...(existing.ratings || []), reviewData.rating]
    const newCount = newRatings.length
    const newSum = newRatings.reduce((a, b) => a + b, 0)
    const newAverage = newSum / newCount
    
    // Add review details (store complete review with timestamp, user, comment, photo)
    const newReviews = [...(existing.reviews || []), {
      rating: reviewData.rating,
      comment: reviewData.comment,
      photo: reviewData.photo,
      timestamp: Date.now(),
      dishName: reviewData.dishName
    }]
    
    const updated = {
      ...dishRatings,
      [reviewData.dishName]: {
        ratings: newRatings,
        count: newCount,
        sum: newSum,
        average: newAverage,
        reviews: newReviews
      }
    }
    
    console.log(`✅ Stored review #${newCount} for "${reviewData.dishName}": ${reviewData.rating}/10. New avg: ${newAverage.toFixed(1)}`)
    console.log(`📊 All reviews for "${reviewData.dishName}":`, newReviews)
    
    // 🚀 NEW: Also submit to backend for community leaderboard
    try {
      // Helper function to generate UUID v4-like format
      const generateUUID = () => {
        const chars = '0123456789abcdef';
        let uuid = '';
        for (let i = 0; i < 32; i++) {
          uuid += chars[Math.floor(Math.random() * 16)];
          if (i === 7 || i === 11 || i === 15 || i === 19) {
            uuid += '-';
          }
        }
        return uuid;
      };

      // Helper to check if string is valid UUID format
      const isValidUUID = (str) => {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };
      
      // Try to get user ID from currentUserId, or fall back to selectedUserProfile or user_profile
      let userId = localStorage.getItem('currentUserId')
      if (!userId) {
        // Try selectedUserProfile (from old flow)
        const profileRaw = localStorage.getItem('selectedUserProfile')
        const profile = profileRaw ? JSON.parse(profileRaw) : null
        userId = profile?.id
      }
      if (!userId) {
        // Try user_profile (from auth context)
        const profileRaw = localStorage.getItem('user_profile')
        const profile = profileRaw ? JSON.parse(profileRaw) : null
        userId = profile?.id
      }

      // ⚠️ CRITICAL FIX: If userId is not a valid UUID, generate one
      if (!isValidUUID(userId)) {
        console.warn('⚠️ User ID is not a valid UUID:', userId);
        userId = generateUUID();
        localStorage.setItem('_temp_guest_uuid', userId);
        console.log('📝 Generated valid UUID for user:', userId);
      }
      
      // ratingItem doesn't have an ID because it's from local menu fallback
      // Try to find the dish ID by querying the backend
      let dishId = null
      
      const dishName = ratingItem?.name || reviewData.dishName
      const restaurantName = post?.restaurant || post?.name
      
      if (dishName && restaurantName) {
        try {
          console.log('🔍 Looking up dish ID for:', { dishName, restaurantName })
          // Query the backend to find the menu item ID by restaurant and dish name
          const lookupResponse = await fetch(`${API_BASE}/api/menu-search?restaurant=${encodeURIComponent(restaurantName)}&dish=${encodeURIComponent(dishName)}`, {
            method: 'GET'
          })
          
          if (lookupResponse.ok) {
            const result = await lookupResponse.json()
            if (result.menu_items && result.menu_items.length > 0) {
              dishId = result.menu_items[0].id
              console.log('✅ Found dish ID:', dishId)
            }
          }
        } catch (lookupErr) {
          console.warn('⚠️  Could not lookup dish ID:', lookupErr.message)
        }
      }
      
      // If we still don't have a dish ID, generate a deterministic UUID from composite key
      if (!dishId) {
        // Create a deterministic UUID-like ID from composite key using a better hash approach
        const compositeKey = `${restaurantName}-${dishName}`;
        
        // Create a longer hash by iterating multiple times
        let hash = 5381;
        for (let i = 0; i < compositeKey.length; i++) {
          hash = ((hash << 5) + hash) + compositeKey.charCodeAt(i);
        }
        
        // Convert hash to hex string and pad to 32 chars
        // We'll use multiple iterations to create 32 hex chars from the hash
        let hexStr = '';
        let h = hash;
        for (let i = 0; i < 32; i++) {
          hexStr += Math.abs((h >> (i % 20)) & 0xF).toString(16);
        }
        
        // Format as UUID: 8-4-4-4-12 hex digits
        dishId = `${hexStr.substring(0, 8)}-${hexStr.substring(8, 12)}-${hexStr.substring(12, 16)}-${hexStr.substring(16, 20)}-${hexStr.substring(20, 32)}`;
        console.log('📝 Generated composite UUID for dish:', { dishId, compositeKey })
      }
      
      // 🔍 INSTRUMENTATION: Log payload before sending
      const payload = {
        dish_id: dishId,
        user_id: userId,
        rating: Number(reviewData.rating),
        comment: reviewData.comment,
        dish_name: dishName,
        restaurant_name: restaurantName
      };
      const url = `${API_BASE}/api/ratings`;
      
      console.log('🚀 [FRONTEND] ABOUT TO SEND RATING REQUEST');
      console.log('🚀 [FRONTEND] URL:', url);
      console.log('🚀 [FRONTEND] API_BASE:', API_BASE);
      console.log('🚀 [FRONTEND] Payload:', payload);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      console.log('📥 [FRONTEND] Response status:', response.status);
      console.log('📥 [FRONTEND] Response ok:', response.ok);
      
      if (response.ok) {
        const result = await response.json()
        console.log('✅ [FRONTEND] Backend saved! Response:', result)
        console.log('✅ [FRONTEND] Rating will appear on leaderboard')
      } else {
        const errText = await response.text()
        console.error('❌ [FRONTEND] Backend submission failed!');
        console.error('❌ [FRONTEND] Status:', response.status);
        console.error('❌ [FRONTEND] Error text:', errText.slice(0, 500));
      }
    } catch (err) {
      console.error('❌ [FRONTEND] Exception during backend submission!');
      console.error('❌ [FRONTEND] Error:', err);
      console.error('❌ [FRONTEND] Error message:', err.message);
      console.error('❌ [FRONTEND] Error stack:', err.stack);
    }
    
    setDishRatings(updated)
    localStorage.setItem(`dishRatings-${restaurantKey}`, JSON.stringify(updated))

    // OPTIMISTIC UPDATE: Update menu items in state immediately using COMPLETE review data
    const updateMenuItem = (item) => {
      const itemName = item?.name || item?.dish_name || item?.dish || ''
      if (itemName.toLowerCase() !== reviewData.dishName.toLowerCase()) return item

      // Use the COMPLETE calculated average from ALL stored reviews
      const dishData = updated[reviewData.dishName]
      const trueAverage = dishData.average
      const trueCount = dishData.count

      return {
        ...item,
        my_rating: Number(reviewData.rating),
        avg_rating: Number(trueAverage.toFixed(1)),
        rating: Number(trueAverage.toFixed(1)),
        rating_bayesian: Number(trueAverage.toFixed(1)),
        rating_count: trueCount,
        ratings_count: trueCount,
        // Store all reviews with the item for transparency
        all_reviews: dishData.reviews
      }
    }

    // Update all menu sources
    if (Array.isArray(fetchedMenu)) {
      setFetchedMenu(prev => prev.map(updateMenuItem))
    }
    if (Array.isArray(aiMenu)) {
      setAiMenu(prev => prev.map(updateMenuItem))
    }
    if (Array.isArray(post.menu)) {
      post.menu = post.menu.map(updateMenuItem)
    }
    // Update menuData sections if present
    if (menuData?.sections) {
      setMenuData(prev => ({
        ...prev,
        sections: prev.sections.map(section => ({
          ...section,
          items: section.items.map(updateMenuItem)
        }))
      }))
    }

    // Persist to "My Ratings" for profile tab
    try {
      const rawProfile = localStorage.getItem('user_profile')
      const currentProfile = rawProfile ? JSON.parse(rawProfile) : null
      const currentProfileId = String(currentProfile?.id || 'guest')
      const ratedItemsKey = `my-rated-items:${currentProfileId}`
      const stored = JSON.parse(localStorage.getItem(ratedItemsKey) || '[]')
      const entryId = `${restaurantKey}-${reviewData.dishName}`
      const existingIdx = stored.findIndex((r) => r.entryId === entryId)
      const newEntry = {
        entryId,
        restaurant: restaurantKey,
        dish: reviewData.dishName,
        rating: reviewData.rating,
        image: reviewData.photo || post.image || null,
        comment: reviewData.comment || '',
        timestamp: Date.now()
      }
      if (existingIdx >= 0) {
        stored[existingIdx] = newEntry
      } else {
        stored.unshift(newEntry)
      }
      localStorage.setItem(ratedItemsKey, JSON.stringify(stored))
      window.dispatchEvent(new Event('ratingSaved'))
    } catch (e) {
      console.warn('Failed to persist rated item:', e)
    }

    // Post the rating to community feed so it appears under the Feed tab.
    try {
      const shouldPostToFeed = reviewData?.postTo?.feed !== false
      if (shouldPostToFeed) {
        const rawPosts = localStorage.getItem(COMMUNITY_POSTS_KEY)
        const parsedPosts = rawPosts ? JSON.parse(rawPosts) : []
        const existingPosts = Array.isArray(parsedPosts) ? parsedPosts : []

        const rawGroups = localStorage.getItem('taste-trails-groups')
        const parsedGroups = rawGroups ? JSON.parse(rawGroups) : []
        const groups = Array.isArray(parsedGroups) ? parsedGroups : []

        const legacyGroupId = reviewData?.postTo?.group
        const selectedGroupIdsRaw = Array.isArray(reviewData?.postTo?.groups)
          ? reviewData.postTo.groups
          : (legacyGroupId ? [legacyGroupId] : [])
        const selectedGroupIds = Array.from(
          new Set(selectedGroupIdsRaw.filter((id) => id !== null && id !== undefined && id !== ''))
        )
        const groupNameById = new Map(groups.map((group) => [String(group?.id), group?.name || null]))
        const feedSelfUser = getCurrentFeedUser()

        const baseTime = Date.now()
        const makeFeedPost = (groupId, index) => ({
          id: baseTime + index,
          userId: feedSelfUser.id,
          user_id: feedSelfUser.id,
          user: { name: feedSelfUser.name, avatar: feedSelfUser.avatar },
          restaurant: restaurantKey,
          restaurant_id: restaurantId || post.restaurant_id || null,
          dish: reviewData.dishName || ratingItem?.name || '',
          image: reviewData.photo || ratingItem?.image || post.image || '',
          caption: reviewData.comment || `Rated ${reviewData.dishName}`,
          rating: Number(reviewData.rating) || 0,
          comments: [],
          commentCount: 0,
          timestamp: new Date(baseTime + index).toISOString(),
          groupId: groupId || null,
          groupName: groupId ? (groupNameById.get(String(groupId)) || null) : null
        })

        const postsToAdd = [makeFeedPost(null, 0)]
        selectedGroupIds.forEach((groupId, idx) => {
          postsToAdd.push(makeFeedPost(groupId, idx + 1))
        })

        localStorage.setItem(COMMUNITY_POSTS_KEY, JSON.stringify([...postsToAdd, ...existingPosts]))
        window.dispatchEvent(new Event('postsUpdated'))
      }
    } catch (e) {
      console.warn('Failed to post rating to community feed:', e)
    }

    // Close rating page
    setShowItemRating(false)
    setRatingItem(null)
  }

  async function handleMenuDiscovery() {
    console.log('🔄 Checking menu discovery status for:', post.id);
    setMenuLoading(true);
    try {
      const restaurantId = post.id || '';
      const res = await fetch(`${API_BASE}/api/restaurants/${encodeURIComponent(restaurantId)}/menu-source`);
      const text = await res.text();
      if (!res.ok) {
        console.warn('Menu discovery request failed:', text.slice(0, 200));
        alert(`Error starting menu discovery: ${text.slice(0, 200)}`);
        setMenuLoading(false);
        return;
      }
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error('MENU DISCOVERY PARSE ERROR:', err);
      }
      console.log('Menu discovery response:', data);
      setMenuLoading(false);
    } catch (e) {
      console.error('Error during menu discovery:', e.message);
      alert(`Error during menu discovery: ${e.message}`);
      setMenuLoading(false);
    }
  }

  async function handleMenuButtonClick() {
    console.log('🍽️ Menu button clicked for restaurant:', post.id);
    console.log('handleMenuButtonClick fired with:', post.id);
    setMenuLoading(true);

    try {
      const res = await fetch(`${API_BASE}/restaurants/${post.id}`);
      const restaurant = await res.json();

      if (restaurant.menu_status === "ready") {
        console.log('✅ Menu is ready for:', post.id);
        setFetchedMenu({
          dinner_url: restaurant.dinner_url,
          lunch_url: restaurant.lunch_url,
          drinks_url: restaurant.drinks_url,
          pdf_url: restaurant.pdf_url
        });
        setMenuLoading(false);
        // Redirect to the menu page
        window.location.href = `/restaurants/${post.id}/menu`;
        return;
      }

      console.log('⏳ Menu not ready, triggering discovery for:', post.id);
      const discoveryRes = await fetch(`${API_BASE}/api/restaurants/${encodeURIComponent(post.id)}/menu-source`);
      const discoveryText = await discoveryRes.text();
      if (!discoveryRes.ok) {
        console.warn('Menu discovery request failed:', discoveryText.slice(0, 200));
        alert(`Error starting menu discovery: ${discoveryText.slice(0, 200)}`);
        setMenuLoading(false);
        return;
      }
      let discoveryData = null;
      try {
        discoveryData = JSON.parse(discoveryText);
      } catch (err) {
        console.error('MENU DISCOVERY PARSE ERROR:', err);
      }
      console.log('Menu discovery response:', discoveryData);
      setMenuLoading(false);
    } catch (e) {
      console.error('Error during menu button flow:', e.message);
      alert(`Error during menu button flow: ${e.message}`);
      setMenuLoading(false);
    }
  }

  React.useEffect(() => {
    if (post.menu_status && post.menu_status !== 'ready') {
      handleMenuDiscovery();
    }
  }, [post.menu_status]);

  // Listen for dietary preference changes from Settings
  React.useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dietary_preferences') {
        try {
          const updated = e.newValue ? JSON.parse(e.newValue) : []
          setDietaryPreferences(updated)
        } catch {
          setDietaryPreferences([])
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  if (showItemRating && ratingItem) {
    return (
      <ItemRating
        item={ratingItem}
        restaurant={post.restaurant || post.name}
        onBack={() => {
          setShowItemRating(false)
          setRatingItem(null)
        }}
        onSubmit={handleRatingSubmit}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-100">
      {/* DEBUG: Menu Types */}
      {console.log('AVAILABLE TYPES:', availableTypes)}
      {console.log('ACTIVE TYPE:', activeType)}
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-amber-100 shadow-2xl shadow-amber-100/60 p-6 lg:p-8">
          <div className="overflow-hidden rounded-3xl border border-amber-100 shadow-lg shadow-amber-100/60 mb-6">
            <div className="relative h-56 flex items-end p-6" style={heroStyle}>
              <div className="text-white drop-shadow space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] font-semibold text-amber-100/90">Menu</div>
                <h2 className="text-3xl lg:text-4xl font-black leading-tight">{post.restaurant}</h2>
                <div className="flex gap-2 pt-1">
                  {post.opentable_id ? (
                    <a href={`https://www.opentable.com/restref/client/?rid=${post.opentable_id}&lang=en-US`} target="_blank" rel="noreferrer" className="inline-block bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-sm font-semibold shadow">Reserve with OpenTable</a>
                  ) : (
                    <a href={`https://www.opentable.com/s?dateTime=2026-01-04T19%3A00&covers=2&term=${encodeURIComponent((post.restaurant||'').replace(/\s+/g,'-'))}&metroId=0`} target="_blank" rel="noreferrer" className="inline-block bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-sm font-semibold shadow">Reserve with OpenTable</a>
                  )}
                </div>
                {post.dish && <div className="text-sm text-amber-100/90">Signature: {post.dish}</div>}
                <div className="flex flex-wrap gap-2 text-xs">
                  {menuLoading && (
                    <span className="px-2 py-1 rounded-full bg-white/25">
                      <svg className="animate-spin h-5 w-5 text-amber-500 inline mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Loading menu…
                    </span>
                  )}
                  <span className="px-2 py-1 rounded-full bg-white/25">{displayItemCount} items</span>
                </div>
              </div>
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <button onClick={() => setShowAddItem(true)} className="px-3 py-2 bg-white/90 text-gray-900 border border-white/50 rounded-lg shadow-sm hover:shadow">Add Item</button>
                <button onClick={onBack} className="px-3 py-2 bg-white/70 text-gray-800 rounded-lg border border-white/50 hover:bg-white">Back</button>
              </div>
            </div>
          </div>

      {/* Menu Type Tabs */}
      {console.log('🔍 TAB RENDER CHECK: availableTypes=', availableTypes, ' | length=', availableTypes.length, ' | will render tabs?', availableTypes.length >= 1)}
      {availableTypes.length >= 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 border-b border-amber-200">
          {['breakfast', 'lunch', 'dinner', 'drinks'].map(type => (
            availableTypes.includes(type) && (
              <button
                key={type}
                {...(availableTypes.length > 1 && { onClick: () => setActiveType(type) })}
                className={`px-4 py-2 whitespace-nowrap font-medium capitalize transition-colors ${
                  availableTypes.length === 1
                    ? 'text-amber-600 border-b-2 border-amber-600 bg-white'
                    : activeType === type
                    ? 'text-amber-600 border-b-2 border-amber-600 bg-white hover:text-amber-700'
                    : 'text-gray-600 hover:text-gray-900 bg-gray-50'
                }`}
                aria-pressed={activeType === type}
              >
                {type === 'breakfast' && '🌅 Breakfast'}
                {type === 'lunch' && '🌞 Lunch'}
                {type === 'dinner' && '🌙 Dinner'}
                {type === 'drinks' && '🍹 Drinks'}
              </button>
            )
          ))}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Dietary filters are algorithmically generated and may not reflect kitchen cross-contamination. Always confirm with the restaurant.
      </div>

      {/* Quick Filter Chips - Mobile Optimized */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'linear-gradient(to bottom, white 85%, transparent)', paddingTop: 8, paddingBottom: 12, marginBottom: 16 }}>
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={() => setActiveFilter(activeFilter === 'TOP_RATED' ? null : 'TOP_RATED')}
            aria-label="Filter by top rated items"
            aria-pressed={activeFilter === 'TOP_RATED'}
            style={{
              border: 'none',
              padding: '12px 16px',
              borderRadius: 20,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeFilter === 'TOP_RATED' ? '#f59e0b' : '#f3f3f3',
              color: activeFilter === 'TOP_RATED' ? 'white' : '#374151',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              boxShadow: activeFilter === 'TOP_RATED' ? '0 2px 4px rgba(245, 158, 11, 0.3)' : 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none'
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'TOP_RATED') e.target.style.background = '#e0e0e0'
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'TOP_RATED') e.target.style.background = '#f3f3f3'
            }}
            onTouchStart={(e) => {
              if (activeFilter !== 'TOP_RATED') e.target.style.background = '#e0e0e0'
            }}
            onTouchEnd={(e) => {
              if (activeFilter !== 'TOP_RATED') e.target.style.background = '#f3f3f3'
            }}
          >
            ⭐ Top Rated
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'MOST_ORDERED' ? null : 'MOST_ORDERED')}
            aria-label="Filter by most ordered items"
            aria-pressed={activeFilter === 'MOST_ORDERED'}
            style={{
              border: 'none',
              padding: '12px 16px',
              borderRadius: 20,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeFilter === 'MOST_ORDERED' ? '#f59e0b' : '#f3f3f3',
              color: activeFilter === 'MOST_ORDERED' ? 'white' : '#374151',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              boxShadow: activeFilter === 'MOST_ORDERED' ? '0 2px 4px rgba(245, 158, 11, 0.3)' : 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none'
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'MOST_ORDERED') e.target.style.background = '#e0e0e0'
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'MOST_ORDERED') e.target.style.background = '#f3f3f3'
            }}
            onTouchStart={(e) => {
              if (activeFilter !== 'MOST_ORDERED') e.target.style.background = '#e0e0e0'
            }}
            onTouchEnd={(e) => {
              if (activeFilter !== 'MOST_ORDERED') e.target.style.background = '#f3f3f3'
            }}
          >
            🔥 Most Ordered
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'HEALTHY' ? null : 'HEALTHY')}
            aria-label="Filter by healthy items"
            aria-pressed={activeFilter === 'HEALTHY'}
            style={{
              border: 'none',
              padding: '12px 16px',
              borderRadius: 20,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeFilter === 'HEALTHY' ? '#f59e0b' : '#f3f3f3',
              color: activeFilter === 'HEALTHY' ? 'white' : '#374151',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              boxShadow: activeFilter === 'HEALTHY' ? '0 2px 4px rgba(245, 158, 11, 0.3)' : 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none'
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'HEALTHY') e.target.style.background = '#e0e0e0'
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'HEALTHY') e.target.style.background = '#f3f3f3'
            }}
            onTouchStart={(e) => {
              if (activeFilter !== 'HEALTHY') e.target.style.background = '#e0e0e0'
            }}
            onTouchEnd={(e) => {
              if (activeFilter !== 'HEALTHY') e.target.style.background = '#f3f3f3'
            }}
          >
            🥗 Healthy
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'VEGETARIAN' ? null : 'VEGETARIAN')}
            aria-label="Filter by vegetarian items"
            aria-pressed={activeFilter === 'VEGETARIAN'}
            style={{
              border: 'none',
              padding: '12px 16px',
              borderRadius: 20,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeFilter === 'VEGETARIAN' ? '#f59e0b' : '#f3f3f3',
              color: activeFilter === 'VEGETARIAN' ? 'white' : '#374151',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              boxShadow: activeFilter === 'VEGETARIAN' ? '0 2px 4px rgba(245, 158, 11, 0.3)' : 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none'
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'VEGETARIAN') e.target.style.background = '#e0e0e0'
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'VEGETARIAN') e.target.style.background = '#f3f3f3'
            }}
            onTouchStart={(e) => {
              if (activeFilter !== 'VEGETARIAN') e.target.style.background = '#e0e0e0'
            }}
            onTouchEnd={(e) => {
              if (activeFilter !== 'VEGETARIAN') e.target.style.background = '#f3f3f3'
            }}
          >
            🧀 Vegetarian
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'SPICY' ? null : 'SPICY')}
            aria-label="Filter by spicy items"
            aria-pressed={activeFilter === 'SPICY'}
            style={{
              border: 'none',
              padding: '12px 16px',
              borderRadius: 20,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeFilter === 'SPICY' ? '#f59e0b' : '#f3f3f3',
              color: activeFilter === 'SPICY' ? 'white' : '#374151',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              boxShadow: activeFilter === 'SPICY' ? '0 2px 4px rgba(245, 158, 11, 0.3)' : 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none'
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'SPICY') e.target.style.background = '#e0e0e0'
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'SPICY') e.target.style.background = '#f3f3f3'
            }}
            onTouchStart={(e) => {
              if (activeFilter !== 'SPICY') e.target.style.background = '#e0e0e0'
            }}
            onTouchEnd={(e) => {
              if (activeFilter !== 'SPICY') e.target.style.background = '#f3f3f3'
            }}
          >
            🌶 Spicy
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'NEW' ? null : 'NEW')}
            aria-label="Filter by new items"
            aria-pressed={activeFilter === 'NEW'}
            style={{
              border: 'none',
              padding: '12px 16px',
              borderRadius: 20,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeFilter === 'NEW' ? '#f59e0b' : '#f3f3f3',
              color: activeFilter === 'NEW' ? 'white' : '#374151',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              boxShadow: activeFilter === 'NEW' ? '0 2px 4px rgba(245, 158, 11, 0.3)' : 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none'
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'NEW') e.target.style.background = '#e0e0e0'
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'NEW') e.target.style.background = '#f3f3f3'
            }}
            onTouchStart={(e) => {
              if (activeFilter !== 'NEW') e.target.style.background = '#e0e0e0'
            }}
            onTouchEnd={(e) => {
              if (activeFilter !== 'NEW') e.target.style.background = '#f3f3f3'
            }}
          >
            🆕 New
          </button>

          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              aria-label="Clear all filters"
              style={{
                border: '1px solid #d1d5db',
                padding: '12px 16px',
                borderRadius: 20,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'white',
                color: '#6b7280',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.2s ease',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f9fafb'
                e.target.style.borderColor = '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'white'
                e.target.style.borderColor = '#d1d5db'
              }}
              onTouchStart={(e) => {
                e.target.style.background = '#f9fafb'
                e.target.style.borderColor = '#9ca3af'
              }}
              onTouchEnd={(e) => {
                e.target.style.background = 'white'
                e.target.style.borderColor = '#d1d5db'
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-1">
          {categoryTabs.map((tab) => {
            const isActive = activeCategoryTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveCategoryTab(tab.key)
                  if (tab.key !== 'all' && sectionRefs.current[tab.key]) {
                    sectionRefs.current[tab.key].scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
                className={`px-3 py-2 rounded-full border text-sm font-semibold transition ${
                  isActive
                    ? 'bg-amber-500 text-white border-amber-500 shadow'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-amber-50'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-10">
        {visibleCategorySections.length > 0 ? (
          visibleCategorySections.map(section => {
            const isCollapsible = section.key === 'drinks'
            const isExpanded = expandedSections[section.key] !== false
            const shouldShowItems = !isCollapsible || isExpanded

            return (
              <div
                key={section.key}
                ref={el => { if (el) sectionRefs.current[section.key] = el }}
              >
                {/* Sticky section header */}
                <div
                  className="sticky top-0 z-10 cursor-pointer"
                  onClick={() => {
                    if (isCollapsible) {
                      setExpandedSections(prev => ({
                        ...prev,
                        [section.key]: !prev[section.key]
                      }))
                    }
                  }}
                  style={{
                    background: 'linear-gradient(to bottom, rgba(255,251,235,0.97) 85%, transparent)',
                    paddingTop: 14,
                    paddingBottom: 10,
                    marginLeft: -2,
                    marginRight: -2,
                    paddingLeft: 2,
                    paddingRight: 2,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 21,
                        fontWeight: 700,
                        color: '#111827',
                        letterSpacing: '-0.01em',
                        flex: 1,
                      }}
                    >
                      {section.name}
                    </h2>
                    {isCollapsible && (
                      <span
                        style={{
                          fontSize: 20,
                          marginRight: 8,
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                          display: 'inline-block',
                        }}
                      >
                        ▼
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      height: 1,
                      marginTop: 8,
                      background: 'linear-gradient(to right, #f59e0b55, transparent)',
                    }}
                  />
                </div>

                {/* Items list - only show if expanded */}
                {shouldShowItems && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                    {section.items.map(item => (
                      <MenuCard
                        key={item.id || item.name}
                        item={item}
                        isSaved={isItemSaved(item)}
                        onSave={toggleSaveItem}
                        onFlag={handleFlagMenuItem}
                        isFlagged={isItemFlagged(item)}
                        onRate={(it) => {
                          setRatingItem(it)
                          setShowItemRating(true)
                        }}
                        onShowSummary={handleShowSummary}
                        ratingDisplay={getDisplayItemRating(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="text-gray-500 text-center py-8">Could not find menu</div>
        )}
      </div>

      {showAddItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Add Menu Item</h3>
            <div className="mb-2">
              <label className="block text-sm text-gray-600">Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border p-2 rounded" />
            </div>
            <div className="mb-2">
              <label className="block text-sm text-gray-600">Rating (1-10)</label>
              <div className="flex items-center gap-2">
                <input type="range" min="1" max="10" step="0.1" value={newRating} onChange={(e) => setNewRating(Number(e.target.value))} className="flex-1" />
                <span className="text-sm font-semibold w-8">{newRating.toFixed(1)}</span>
              </div>
            </div>
            <div className="mb-2">
              <label className="block text-sm text-gray-600">Price Level</label>
              <div className="flex items-center gap-2">
                <input type="range" min="1" max="5" step="1" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} className="flex-1" />
                <span className="text-sm font-semibold text-amber-600 w-16">{getPriceDisplay(newPrice)}</span>
              </div>
            </div>
            <div className="mb-2">
              <label className="block text-sm text-gray-600">Image (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => {
                const f = e.target.files && e.target.files[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = (ev) => setNewImage(ev.target.result)
                reader.readAsDataURL(f)
              }} />
              {newImage && <img src={newImage} className="mt-2 w-full h-32 object-cover rounded" alt="preview" />}
            </div>
            <div className="flex justify-end space-x-2 mt-3">
              <button onClick={() => setShowAddItem(false)} className="px-3 py-2 bg-gray-100 rounded">Cancel</button>
              <button onClick={handleAddItem} className="px-3 py-2 bg-yellow-500 text-white rounded">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Dish Summary Modal */}
      {showSummary && summaryDish && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {summaryDish.image && <img src={summaryDish.image} alt="" className="w-16 h-16 object-cover rounded" />}
                <div>
                  <h3 className="text-xl font-bold">
                    {summaryDish.name || summaryDish.dish_name || summaryDish.title || 'Dish'}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    {(() => {
                      const ratingInfo = getDisplayItemRating(summaryDish);
                      if (ratingInfo.count === 0) {
                        return <span className="text-sm text-gray-400">No ratings yet</span>;
                      }
                      return <>
                        <StarRating value={Number(ratingInfo.rating)} />
                        <span className="text-lg font-bold text-blue-600">{Number(ratingInfo.rating).toFixed(1)}</span>
                        <span className="text-yellow-400">⭐</span>
                        <span className="text-xs text-gray-500">/10</span>
                      </>;
                    })()}
                    {summaryDish.price && <span className="text-sm font-semibold text-amber-600">{getPriceDisplay(summaryDish.price)}</span>}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowSummary(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            

            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">📖 About this dish</h4>
              <p className="text-gray-600 leading-relaxed">{dishDescription}</p>
            </div>

            {/* Dish Rating and Actions */}
            <div className="mb-4 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {(() => {
                  const ratingInfo = getDisplayItemRating(summaryDish);
                  if (ratingInfo.count === 0) {
                    return <span className="text-sm text-gray-400">No ratings yet</span>;
                  }
                  return <>
                    <span className="text-lg font-bold text-blue-600">{Number(ratingInfo.rating).toFixed(1)}</span>
                    <span className="text-yellow-400">⭐</span>
                    <span className="text-xs text-gray-500">/10</span>
                  </>;
                })()}
                <button
                  className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-semibold"
                  onClick={() => {
                    setShowSummary(false);
                    setShowItemRating(true);
                    setRatingItem(summaryDish);
                  }}
                >
                  Rate this dish
                </button>
                <button
                  className="ml-2 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs font-semibold"
                  onClick={() => alert('Comments coming soon!')}
                >
                  Comments
                </button>
              </div>
            </div>

            {Array.isArray(summaryDish?.all_reviews) && summaryDish.all_reviews.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent reviews</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {summaryDish.all_reviews
                    .slice(-5)
                    .reverse()
                    .map((review, idx) => (
                      <div key={`${summaryDish.name || 'dish'}-${idx}`} className="border border-gray-100 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">
                            Rating {Number(review?.rating || 0).toFixed(1)}/10
                          </span>
                          <button
                            type="button"
                            onClick={() => handleReportReview(summaryDish, review)}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            Report
                          </button>
                        </div>
                        {review?.comment && (
                          <p className="text-xs text-gray-600 mt-1">{review.comment}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowSummary(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setShowSummary(false)
                  toggleSaveItem(summaryDish)
                }}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                {isItemSaved(summaryDish) ? 'Unsave' : 'Save to Favorites'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dish Rating Page */}
      {showItemRating && ratingItem && (
        <ItemRating
          item={ratingItem}
          restaurant={fetchedMenu || {}}
          onBack={() => { setShowItemRating(false); setRatingItem(null); }}
          onSubmit={() => { setShowItemRating(false); setRatingItem(null); }}
        />
      )}

        </div>
      </div>
    </div>
  )
}
