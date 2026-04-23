import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, SectionList, FlatList, ScrollView, Pressable,
  ActivityIndicator, Image, Modal, TextInput, Alert,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform
} from 'react-native'
import { ArrowLeft, Star, Search, X, Filter } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { emit } from '../utils/eventEmitter'

// ─── Menu normalization (pure JS, portable from web) ───────────────────────

function toSectionsFromCategories(categories) {
  if (!Array.isArray(categories)) return []
  return categories
    .map(cat => ({ name: cat?.name || cat?.category || 'Menu', items: Array.isArray(cat?.items) ? cat.items : [] }))
    .filter(s => s.items.length > 0)
}

function toSectionsFromFlatItems(items) {
  if (!Array.isArray(items) || items.length === 0) return []
  const groups = new Map()
  for (const item of items) {
    if (!item) continue
    const cat = item.section_name || item.category || item.section || 'Menu'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat).push(item)
  }
  return Array.from(groups.entries()).map(([name, groupItems]) => ({ name, items: groupItems }))
}

function normalizeMenuPayload(payload) {
  if (!payload || typeof payload !== 'object') return { name: '', sections: [] }
  const name = payload.name || payload.restaurant || ''
  const id = payload.id || payload.restaurant_id || null
  const restaurant = payload.restaurant || name

  if (Array.isArray(payload.sections) && payload.sections.length > 0) {
    return { id, name, restaurant, sections: toSectionsFromCategories(payload.sections) }
  }
  if (Array.isArray(payload.menu) && payload.menu.length > 0) {
    const looksGrouped = payload.menu.some(e => Array.isArray(e?.items))
    return {
      id, name, restaurant,
      sections: looksGrouped ? toSectionsFromCategories(payload.menu) : toSectionsFromFlatItems(payload.menu)
    }
  }
  if (Array.isArray(payload.categories) && payload.categories.length > 0) {
    return { id, name, restaurant, sections: toSectionsFromCategories(payload.categories) }
  }
  return { id, name, restaurant, sections: [] }
}

function getItemPrice(item) {
  if (!item) return null
  const p = item.price ?? item.price_number ?? item.price_usd ?? item.amount ?? null
  if (p == null) return null
  const n = typeof p === 'string' ? parseFloat(p.replace(/[^0-9.]/g, '')) : parseFloat(p)
  return isNaN(n) ? null : n
}

function formatPrice(item) {
  const n = getItemPrice(item)
  return n != null ? `$${n.toFixed(2)}` : null
}

// ─── MenuItemCard ──────────────────────────────────────────────────────────

function MenuItemCard({ item, onRate, restaurantName }) {
  const name = item.dish_name || item.name || item.title || 'Item'
  const description = item.description || item.desc || ''
  const price = formatPrice(item)
  const rating = item.rating ?? item.avg_rating

  return (
    <Pressable
      onPress={() => onRate(item)}
      className="bg-white border-b border-gray-50 px-4 py-3"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-semibold text-gray-900 mb-0.5">{name}</Text>
          {description ? (
            <Text className="text-xs text-gray-400 leading-relaxed" numberOfLines={2}>{description}</Text>
          ) : null}
          <View className="flex-row items-center mt-1.5 gap-3">
            {price ? <Text className="text-sm font-bold text-orange-600">{price}</Text> : null}
            {rating != null && !isNaN(parseFloat(rating)) && parseFloat(rating) > 0 ? (
              <View className="flex-row items-center">
                <Star size={11} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-xs text-gray-600 ml-0.5">{parseFloat(rating).toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={() => onRate(item)}
          className="bg-orange-50 rounded-xl px-2 py-1 items-center"
        >
          <Star size={14} color="#f97316" />
          <Text className="text-xs text-orange-600 font-semibold mt-0.5">Rate</Text>
        </Pressable>
      </View>
    </Pressable>
  )
}

// ─── Rate Item Modal ──────────────────────────────────────────────────────

function RateItemModal({ item, restaurantName, visible, onClose, onSave }) {
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')

  useEffect(() => {
    if (visible) { setRating(0); setReview('') }
  }, [visible, item])

  if (!item) return null
  const name = item.dish_name || item.name || item.title || 'Item'

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-lg font-bold text-gray-900 flex-1 mr-3" numberOfLines={1}>{name}</Text>
                  <Pressable onPress={onClose}><X size={20} color="#6b7280" /></Pressable>
                </View>
                <Text className="text-sm text-gray-400 mb-5">{restaurantName}</Text>

                {/* Star picker */}
                <Text className="text-sm font-semibold text-gray-700 mb-2">Your Rating</Text>
                <View className="flex-row mb-5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Pressable key={n} onPress={() => setRating(n)} className="mr-2">
                      <Star size={32} color="#f59e0b" fill={n <= rating ? '#f59e0b' : 'none'} />
                    </Pressable>
                  ))}
                </View>

                <Text className="text-sm font-semibold text-gray-700 mb-2">Review (optional)</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f9fafb', color: '#1f2937', marginBottom: 20 }}
                  placeholder="What did you think?"
                  placeholderTextColor="#9ca3af"
                  value={review}
                  onChangeText={setReview}
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={Keyboard.dismiss}
                />

                <View className="flex-row gap-3">
                  <Pressable onPress={onClose} className="flex-1 border border-gray-200 rounded-xl py-3 items-center">
                    <Text className="text-gray-600 font-semibold">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onSave(item, rating, review)}
                    disabled={rating === 0}
                    className={`flex-1 rounded-xl py-3 items-center ${rating > 0 ? 'bg-orange-500' : 'bg-gray-200'}`}
                  >
                    <Text className={`font-bold ${rating > 0 ? 'text-white' : 'text-gray-400'}`}>Save Rating</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Main MenuView Screen ─────────────────────────────────────────────────

export default function MenuViewScreen({ navigation, route }) {
  const restaurant = route.params?.restaurant || {}
  const { getAuthHeaders, profile } = useAuth()
  const insets = useSafeAreaInsets()

  const restaurantId = restaurant.id || restaurant.restaurant_id || restaurant.place_id
  const restaurantName = restaurant.name || restaurant.restaurant || 'Restaurant'

  const [menuData, setMenuData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState(null)
  const [ratingItem, setRatingItem] = useState(null)
  const [savedRatings, setSavedRatings] = useState({})

  useEffect(() => {
    fetchMenu()
    loadSavedRatings()
  }, [restaurantId])

  async function loadSavedRatings() {
    try {
      const raw = await AsyncStorage.getItem(`dishRatings-${restaurantName}`)
      if (raw) setSavedRatings(JSON.parse(raw))
    } catch {}
  }

  async function fetchMenu() {
    setLoading(true)
    setPending(false)
    const cacheKey = `menu-${restaurantId || restaurantName}`
    try {
      // Load cache immediately for instant display
      const cached = await AsyncStorage.getItem(cacheKey)
      if (cached) {
        setMenuData(normalizeMenuPayload(JSON.parse(cached)))
        setLoading(false)
      }

      const headers = await getAuthHeaders()

      // UUID-based: /api/restaurants/:id/full-menu
      // Name-based: /api/restaurants/:name  (also triggers scrape if not in DB)
      const isUUID = restaurantId && /^[0-9a-fA-F-]{36}$/.test(String(restaurantId))
      const url = isUUID
        ? `${API_BASE_URL}/api/restaurants/${restaurantId}/full-menu`
        : `${API_BASE_URL}/api/restaurants/${encodeURIComponent(restaurantName)}`

      const res = await fetch(url, { headers })
      if (res.ok) {
        const data = await res.json()
        setMenuData(normalizeMenuPayload({ ...restaurant, ...data }))
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data))
        if (data.menuPending) setPending(true)
      } else if (!cached) {
        setMenuData(normalizeMenuPayload(restaurant))
      }
    } catch (e) {
      console.warn('Menu fetch error:', e.message)
      if (!menuData) setMenuData(normalizeMenuPayload(restaurant))
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveRating(item, rating, review) {
    const name = item.dish_name || item.name || item.title || 'Item'
    const updated = {
      ...savedRatings,
      [name]: { rating, review, timestamp: Date.now(), total: rating, count: 1 }
    }
    setSavedRatings(updated)
    await AsyncStorage.setItem(`dishRatings-${restaurantName}`, JSON.stringify(updated))

    // Save to rated gallery (local)
    try {
      const key = `my-rated-items:${profile?.id}`
      const raw = await AsyncStorage.getItem(key)
      const existing = raw ? JSON.parse(raw) : []
      const filtered = existing.filter(i => !(i.name === name && i.restaurant === restaurantName))
      const newEntry = { name, restaurant: restaurantName, rating, review, timestamp: Date.now() }
      await AsyncStorage.setItem(key, JSON.stringify([newEntry, ...filtered]))
      emit('ratingSaved', newEntry)
    } catch {}

    // POST to backend so it shows in Top Dishes
    try {
      const headers = await getAuthHeaders()
      await fetch(`${API_BASE_URL}/api/ratings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dish_id: item.id || name,
          dish_name: name,
          restaurant_name: restaurantName,
          rating,
          comment: review || '',
          user_id: profile?.id,
        }),
      })
    } catch {}

    setRatingItem(null)
    Alert.alert('Rating saved!', `You gave ${name} ${rating} star${rating !== 1 ? 's' : ''}.`)
  }

  const sections = menuData?.sections || []
  const filteredSections = searchQuery.trim()
    ? sections.map(s => ({
        ...s,
        items: s.items.filter(i => {
          const n = (i.dish_name || i.name || i.title || '').toLowerCase()
          const d = (i.description || '').toLowerCase()
          const q = searchQuery.toLowerCase()
          return n.includes(q) || d.includes(q)
        })
      })).filter(s => s.items.length > 0)
    : sections

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-4 pt-3 pb-2 shadow-sm">
        <View className="flex-row items-center mb-2">
          <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
            <ArrowLeft size={22} color="#374151" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{restaurantName}</Text>
            {restaurant.cuisine ? (
              <Text className="text-xs text-gray-400">{restaurant.cuisine}</Text>
            ) : null}
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2">
          <Search size={15} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-sm text-gray-800"
            placeholder="Search menu items…"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={15} color="#9ca3af" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Section tabs */}
      {sections.length > 1 && (
        <View className="bg-white border-b border-gray-100">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 8 }}>
            <Pressable
              onPress={() => setActiveSection(null)}
              className={`mr-2 px-3 py-1.5 rounded-full border ${!activeSection ? 'bg-orange-500 border-orange-500' : 'border-gray-200 bg-white'}`}
            >
              <Text className={`text-xs font-semibold ${!activeSection ? 'text-white' : 'text-gray-600'}`}>All</Text>
            </Pressable>
            {sections.map((s, idx) => (
              <Pressable
                key={`${s.name}-${idx}`}
                onPress={() => setActiveSection(s.name === activeSection ? null : s.name)}
                className={`mr-2 px-3 py-1.5 rounded-full border ${activeSection === s.name ? 'bg-orange-500 border-orange-500' : 'border-gray-200 bg-white'}`}
              >
                <Text className={`text-xs font-semibold ${activeSection === s.name ? 'text-white' : 'text-gray-600'}`}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Pending scrape banner */}
      {pending && (
        <View className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex-row items-center">
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text className="text-amber-700 text-xs ml-2">Menu is being fetched — check back in a moment</Text>
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
          <Text className="mt-3 text-gray-400 text-sm">Loading menu…</Text>
        </View>
      ) : filteredSections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-4xl mb-3">🍽️</Text>
          <Text className="text-gray-500 text-center font-semibold mb-1">
            {searchQuery ? 'No items match your search' : 'No menu available yet'}
          </Text>
          <Text className="text-gray-400 text-center text-sm">
            {searchQuery ? 'Try a different search term' : 'Check back soon — the menu is being added'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={(activeSection
            ? filteredSections.filter(s => s.name === activeSection)
            : filteredSections
          ).map(s => ({ title: s.name, data: s.items }))}
          keyExtractor={(item, idx) => item.id ? String(item.id) : `${item.name || item.dish_name || 'item'}-${idx}`}
          renderSectionHeader={({ section }) => (
            <View className="bg-gray-100 px-4 py-2 border-b border-gray-200">
              <Text className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <MenuItemCard
              item={item}
              restaurantName={restaurantName}
              onRate={(i) => setRatingItem(i)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 30 }}
          stickySectionHeadersEnabled={true}
        />
      )}

      {/* Rating Modal */}
      <RateItemModal
        item={ratingItem}
        restaurantName={restaurantName}
        visible={!!ratingItem}
        onClose={() => setRatingItem(null)}
        onSave={handleSaveRating}
      />
    </View>
  )
}
