import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, Pressable, ActivityIndicator, ScrollView
} from 'react-native'
import { Star, RefreshCw } from 'lucide-react-native'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

function getRankEmoji(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  if (rank <= 5) return '⭐'
  return '✨'
}

function DishCard({ dish, rank, onPress }) {
  const stars = Math.round(dish.rating || 0)
  return (
    <Pressable onPress={onPress} className="bg-white rounded-2xl overflow-hidden shadow-sm mb-3">
      {/* Rank header */}
      <View className="bg-gradient-to-r px-4 py-3" style={{ backgroundColor: rank <= 3 ? '#4f46e5' : '#6366f1' }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white text-xs font-semibold opacity-80">#{rank} Most Rated</Text>
            <Text className="text-white font-bold text-base mt-0.5" numberOfLines={1}>{dish.name}</Text>
          </View>
          <Text className="text-2xl">{getRankEmoji(rank)}</Text>
        </View>
      </View>

      <View className="p-4">
        {/* Restaurant */}
        <Text className="text-sm font-semibold text-gray-700 mb-3" numberOfLines={1}>
          📍 {dish.restaurant?.name || 'Unknown'}
        </Text>

        {/* Rating block */}
        <View className="bg-gray-50 rounded-xl p-3 mb-3">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center gap-1">
              <Text className="text-2xl font-black text-indigo-600">{dish.rating}</Text>
              <View className="flex-row ml-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} color={i < stars ? '#f59e0b' : '#e5e7eb'} fill={i < stars ? '#f59e0b' : '#e5e7eb'} />
                ))}
              </View>
            </View>
            <View className="bg-gray-200 rounded-full px-2 py-0.5">
              <Text className="text-xs font-semibold text-gray-600">
                {dish.ratingCount} {dish.ratingCount === 1 ? 'rating' : 'ratings'}
              </Text>
            </View>
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs text-gray-500">Lowest: {dish.lowest} ⬇️</Text>
            <Text className="text-xs text-gray-500">Highest: {dish.highest} ⬆️</Text>
          </View>
        </View>

        {/* Badge + price */}
        <View className="flex-row items-center justify-between">
          <View className="bg-indigo-100 rounded-full px-3 py-1">
            <Text className="text-xs font-semibold text-indigo-700">{dish.badge}</Text>
          </View>
          {dish.price ? (
            <Text className="text-sm font-semibold text-gray-600">💰 {dish.price}</Text>
          ) : null}
        </View>

        {/* Description */}
        {dish.description ? (
          <Text className="text-xs text-gray-500 mt-2" numberOfLines={2}>{dish.description}</Text>
        ) : null}
      </View>
    </Pressable>
  )
}

export default function TopDishesScreen({ navigation }) {
  const { getAuthHeaders } = useAuth()
  const insets = useSafeAreaInsets()
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(7)

  useEffect(() => {
    fetchTopDishes()
  }, [days])

  async function fetchTopDishes() {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(
        `${API_BASE_URL}/api/top-dishes?days=${days}&limit=20&minRatings=1`,
        { headers }
      )
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()
      setDishes(data.topDishes || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-4 pt-3 pb-3 shadow-sm">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xl font-black text-gray-900">🔥 Top Dishes</Text>
          <Pressable onPress={fetchTopDishes}>
            <RefreshCw size={18} color="#9ca3af" />
          </Pressable>
        </View>

        {/* Day filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
          {[7, 14, 30].map(d => (
            <Pressable
              key={d}
              onPress={() => setDays(d)}
              className={`mx-1 px-4 py-1.5 rounded-full border ${days === d ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-200'}`}
            >
              <Text className={`text-xs font-semibold ${days === d ? 'text-white' : 'text-gray-600'}`}>
                Past {d} days
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
          <Text className="text-gray-500 mt-3">Finding the best dishes…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">😕</Text>
          <Text className="text-gray-500 text-center mb-4">Couldn't load top dishes</Text>
          <Pressable onPress={fetchTopDishes} className="bg-orange-500 px-6 py-3 rounded-xl">
            <Text className="text-white font-bold">Try Again</Text>
          </Pressable>
        </View>
      ) : dishes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">⭐</Text>
          <Text className="text-gray-500 text-center">No ratings yet this period. Rate some dishes to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={dishes}
          keyExtractor={(item, idx) => String(item.id || idx)}
          renderItem={({ item, index }) => (
            <DishCard
              dish={item}
              rank={index + 1}
              onPress={() => item.restaurant && navigation.navigate('MenuView', { restaurant: item.restaurant })}
            />
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ListHeaderComponent={
            <Text className="text-xs text-gray-400 mb-3 text-center">
              Community ratings from the past {days} day{days !== 1 ? 's' : ''} · Updated automatically
            </Text>
          }
        />
      )}
    </View>
  )
}
