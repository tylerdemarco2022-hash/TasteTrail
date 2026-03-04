import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Pressable, FlatList, ActivityIndicator } from 'react-native'
import { ArrowLeft, Star, Lock, UserPlus, UserCheck } from 'lucide-react-native'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const AVATAR_COLORS = ['#f97316', '#8b5cf6', '#06b6d4', '#10b981', '#f43f5e']
function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}

export default function UserProfileScreen({ navigation, route }) {
  const { getAuthHeaders, user } = useAuth()
  const insets = useSafeAreaInsets()
  const routeUser = route.params?.user || {}
  const userId = routeUser.id

  const [userData, setUserData] = useState(routeUser)
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [isPrivate, setIsPrivate] = useState(routeUser.is_private || false)

  useEffect(() => {
    fetchUserData()
  }, [userId])

  async function fetchUserData() {
    if (!userId) { setLoading(false); return }
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/auth/profile?id=${userId}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setUserData(data.profile || data)
        setIsPrivate(data.profile?.is_private || data.is_private || false)
      }
    } catch {}

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/users/${userId}/ratings`, { headers })
      if (res.ok) {
        const data = await res.json()
        setRatings(data.ratings || data || [])
      }
    } catch {}

    setLoading(false)
  }

  async function handleFollowToggle() {
    setFollowLoading(true)
    try {
      const headers = await getAuthHeaders()
      const endpoint = following ? 'unfollow' : 'follow'
      const res = await fetch(`${API_BASE_URL}/users/${userId}/${endpoint}`, {
        method: 'POST',
        headers
      })
      if (res.ok) setFollowing(!following)
    } catch {}
    setFollowLoading(false)
  }

  const displayName = userData.name || userData.email?.split('@')[0] || 'User'
  const color = avatarColor(displayName)
  const isSelf = user?.id === userId

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-4 pt-3 pb-3 border-b border-gray-100 flex-row items-center">
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">{displayName}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Profile header */}
        <View className="bg-white px-4 pt-5 pb-5 border-b border-gray-100">
          <View className="flex-row items-center mb-4">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: color }}
            >
              <Text className="text-3xl font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">{displayName}</Text>
              {userData.email ? <Text className="text-sm text-gray-400">{userData.email}</Text> : null}
              {isPrivate && (
                <View className="flex-row items-center mt-1">
                  <Lock size={12} color="#9ca3af" />
                  <Text className="text-xs text-gray-400 ml-1">Private account</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row justify-around border-t border-gray-100 pt-4">
            {[
              { label: 'Reviews', value: userData.review_count || ratings.length },
              { label: 'Followers', value: userData.follower_count || 0 },
              { label: 'Following', value: userData.following_count || 0 },
            ].map(stat => (
              <View key={stat.label} className="items-center">
                <Text className="text-xl font-black text-gray-900">{stat.value}</Text>
                <Text className="text-xs text-gray-400">{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Follow Button */}
          {!isSelf && (
            <Pressable
              onPress={handleFollowToggle}
              disabled={followLoading}
              className={`mt-4 py-2.5 rounded-xl items-center flex-row justify-center gap-2 ${following ? 'border-2 border-gray-200 bg-white' : 'bg-orange-500'}`}
            >
              {followLoading
                ? <ActivityIndicator size="small" color={following ? '#374151' : '#fff'} />
                : <>
                    {following
                      ? <UserCheck size={16} color="#374151" />
                      : <UserPlus size={16} color="#fff" />
                    }
                    <Text className={`font-bold ml-1 ${following ? 'text-gray-700' : 'text-white'}`}>
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  </>
              }
            </Pressable>
          )}
        </View>

        {/* Content */}
        {isPrivate ? (
          <View className="items-center py-16 px-6">
            <Lock size={48} color="#d1d5db" />
            <Text className="text-gray-600 font-semibold mt-3 text-center">This account is private</Text>
            <Text className="text-gray-400 text-sm text-center mt-1">
              Follow this account to see their food ratings
            </Text>
          </View>
        ) : ratings.length === 0 ? (
          <View className="items-center py-16 px-6">
            <Star size={48} color="#d1d5db" />
            <Text className="text-gray-400 text-center mt-3">No ratings yet</Text>
          </View>
        ) : (
          <View className="p-3">
            <Text className="text-base font-bold text-gray-800 mb-3 px-1">Dish Ratings</Text>
            <View className="flex-row flex-wrap gap-2">
              {ratings.map((item, idx) => (
                <View key={idx} className="bg-white rounded-xl p-3 shadow-sm" style={{ width: '47%' }}>
                  <Text className="text-sm font-semibold text-gray-900 mb-0.5" numberOfLines={1}>
                    {item.name || item.dish_name || 'Dish'}
                  </Text>
                  <Text className="text-xs text-gray-400 mb-1" numberOfLines={1}>{item.restaurant}</Text>
                  <View className="flex-row items-center">
                    <Star size={12} color="#f59e0b" fill="#f59e0b" />
                    <Text className="text-xs text-gray-700 ml-1 font-semibold">{item.rating || '—'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
