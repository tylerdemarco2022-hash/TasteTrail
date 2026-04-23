import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable,
  ActivityIndicator, RefreshControl, ScrollView
} from 'react-native'
import { Search, X, Flame } from 'lucide-react-native'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'
import RestaurantCard from '../components/RestaurantCard'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const CATEGORIES = [
  { label: 'All', icon: '🍽️' },
  { label: 'Casual Dining', icon: '🍽️' },
  { label: 'Fine Dining', icon: '🍷' },
  { label: 'Bar & Grill', icon: '🍺' },
  { label: 'Steakhouse', icon: '🥩' },
  { label: 'Seafood House', icon: '🦞' },
  { label: 'Sushi', icon: '🍣' },
  { label: 'Fast Casual', icon: '🌯' },
]

const CACHE_KEY = 'nearby-restaurants-cache'
const LOCATION_KEY = 'last-location'
const DEFAULT_LOCATION = { latitude: 35.2271, longitude: -80.8431 }

export default function FeedScreen({ navigation }) {
  const { getAuthHeaders } = useAuth()
  const insets = useSafeAreaInsets()

  const [restaurants, setRestaurants] = useState([])
  const [filteredRestaurants, setFilteredRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [topDishes, setTopDishes] = useState([])

  useEffect(() => {
    loadCachedData()
    requestLocationAndFetch()
    fetchTopDishes()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [restaurants, selectedCategory, searchQuery])

  async function fetchTopDishes() {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/api/top-dishes?limit=6&minRatings=1`, { headers })
      if (!res.ok) return
      const data = await res.json()
      setTopDishes(data.topDishes || [])
    } catch {}
  }

  async function loadCachedData() {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        setRestaurants(parsed)
        setLoading(false)
      }
    } catch {}
  }

  async function requestLocationAndFetch() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
        setLocation(coords)
        await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(coords))
        await fetchRestaurants(coords)
      } else {
        const cached = await AsyncStorage.getItem(LOCATION_KEY)
        const coords = cached ? JSON.parse(cached) : DEFAULT_LOCATION
        setLocation(coords)
        await fetchRestaurants(coords)
      }
    } catch {
      await fetchRestaurants(location)
    }
  }

  async function fetchRestaurants(coords = location) {
    try {
      const headers = await getAuthHeaders()
      const { latitude: lat, longitude: lon } = coords
      const res = await fetch(
        `${API_BASE_URL}/api/nearby-restaurants?lat=${lat}&lon=${lon}&radius=25`,
        { headers }
      )
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      const list = data.restaurants || []
      setRestaurants(list)
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list))
    } catch (e) {
      console.warn('Feed fetch error:', e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function applyFilters() {
    let result = restaurants
    if (selectedCategory !== 'All') {
      result = result.filter(r => getCategories(r).includes(selectedCategory))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.cuisine || '').toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q)
      )
    }
    setFilteredRestaurants(result)
  }

  function getCategories(restaurant) {
    const cats = new Set()
    if (Array.isArray(restaurant.service_model)) {
      restaurant.service_model.forEach(c => c && cats.add(c))
    } else if (restaurant.service_model) {
      cats.add(restaurant.service_model)
    }
    if (Array.isArray(restaurant.cuisine_tags)) {
      restaurant.cuisine_tags.forEach(c => c && cats.add(c))
    }
    const cuisine = (restaurant.cuisine || '').toLowerCase()
    if (cuisine.includes('steak')) cats.add('Steakhouse')
    if (cuisine.includes('seafood')) cats.add('Seafood House')
    if (cuisine.includes('sushi')) cats.add('Sushi')
    if (cuisine.includes('bar') || cuisine.includes('grill')) cats.add('Bar & Grill')
    if (cuisine.includes('fine') || cuisine.includes('contemporary')) cats.add('Fine Dining')
    if (cats.size === 0) cats.add('Casual Dining')
    return [...cats]
  }

  function handleOpenMenu(restaurant) {
    navigation.navigate('MenuView', { restaurant })
  }

  async function onRefresh() {
    setRefreshing(true)
    await fetchRestaurants()
    await fetchTopDishes()
  }

  if (loading && restaurants.length === 0) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-3 text-gray-500">Finding restaurants near you…</Text>
      </View>
    )
  }

  const grouped = CATEGORIES
    .filter(cat => cat.label !== 'All')
    .map(cat => ({
      label: cat.label,
      icon: cat.icon,
      items: filteredRestaurants.filter(r => getCategories(r).includes(cat.label)),
    }))
    .filter(g => g.items.length > 0)

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header + search + categories */}
      <View className="bg-white px-4 pt-3 pb-2 shadow-sm">
        {/* Title row */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-black text-gray-900">TasteTrails</Text>
          <Pressable
            onPress={() => navigation.navigate('TopDishes')}
            className="flex-row items-center bg-orange-50 px-3 py-1.5 rounded-full"
          >
            <Flame size={14} color="#f97316" />
            <Text className="text-orange-600 text-xs font-bold ml-1">Top Dishes</Text>
          </Pressable>
        </View>

        {/* Search bar */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 mb-3">
          <Search size={16} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-sm text-gray-800"
            placeholder="Search restaurants, cuisines…"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={16} color="#9ca3af" />
            </Pressable>
          )}
        </View>

        {/* Category pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.label}
              onPress={() => setSelectedCategory(cat.label)}
              className={`mx-1 px-3 py-1.5 rounded-full border ${
                selectedCategory === cat.label
                  ? 'bg-orange-500 border-orange-500'
                  : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-xs font-semibold ${
                selectedCategory === cat.label ? 'text-white' : 'text-gray-600'
              }`}>
                {cat.icon} {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
      >
        {/* Top Dishes strip */}
        {topDishes.length > 0 && (
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#111' }}>🔥 Community Top Picks</Text>
              <Pressable onPress={() => navigation.navigate('TopDishes')}>
                <Text style={{ color: '#f97316', fontSize: 13, fontWeight: '700' }}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16 }}>
              {topDishes.map((dish, idx) => (
                <Pressable
                  key={dish.id || idx}
                  onPress={() => dish.restaurant && handleOpenMenu(dish.restaurant)}
                  style={{
                    marginRight: 12,
                    width: 140,
                    backgroundColor: '#fff',
                    borderRadius: 14,
                    padding: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#f97316', marginBottom: 2 }}>
                    #{idx + 1} {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#111', marginBottom: 2 }} numberOfLines={2}>
                    {dish.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#888' }} numberOfLines={1}>
                    {dish.restaurant?.name || ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#4f46e5' }}>{dish.rating}</Text>
                    <Text style={{ fontSize: 10, color: '#9ca3af', marginLeft: 3 }}>/ 10</Text>
                  </View>
                </Pressable>
              ))}
              <View style={{ width: 16 }} />
            </ScrollView>
          </View>
        )}

        {/* Grouped restaurant sections */}
        {grouped.map(group => (
          <View key={group.label} style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, marginRight: 6 }}>{group.icon}</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#111' }}>{group.label}</Text>
                <Text style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{group.items.length}</Text>
              </View>
              {group.items.length > 5 && (
                <Pressable onPress={() => navigation.navigate('CategoryView', { category: group.label, restaurants: group.items })}>
                  <Text style={{ color: '#f97316', fontWeight: '700', fontSize: 13 }}>View all</Text>
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16 }}>
              {group.items.slice(0, 5).map((item, idx) => (
                <View key={item.id || item.place_id || idx} style={{ marginRight: 14, width: 240 }}>
                  <RestaurantCard restaurant={item} onPress={() => handleOpenMenu(item)} />
                </View>
              ))}
              <View style={{ width: 16 }} />
            </ScrollView>
          </View>
        ))}

        {/* Empty state */}
        {grouped.length === 0 && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🍽️</Text>
            <Text style={{ color: '#888', textAlign: 'center', fontSize: 15 }}>
              {searchQuery ? 'No restaurants match your search' : 'No restaurants found nearby'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
