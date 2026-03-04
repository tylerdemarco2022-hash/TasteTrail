import React, { useState, useEffect } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native'
import { Bell, UserPlus, Users, Check, X } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function NotificationsScreen({ navigation }) {
  const { profile, user, getAuthHeaders } = useAuth()
  const insets = useSafeAreaInsets()
  const CURRENT_USER = profile?.name || user?.email?.split('@')[0] || 'You'

  const [followRequests, setFollowRequests] = useState([])
  const [groupRequests, setGroupRequests] = useState([])
  const [loadingFollow, setLoadingFollow] = useState(true)
  const [loadingGroups, setLoadingGroups] = useState(true)

  useEffect(() => {
    loadFollowRequests()
    loadGroupRequests()
  }, [])

  async function loadFollowRequests() {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/api/follow-requests/incoming`, { headers })
      if (res.ok) {
        const data = await res.json()
        setFollowRequests(data.requests || [])
      }
    } catch {}
    setLoadingFollow(false)
  }

  async function loadGroupRequests() {
    try {
      const raw = await AsyncStorage.getItem('taste-trails-groups')
      const groups = raw ? JSON.parse(raw) : []
      const mine = groups.filter(g => g.leader === CURRENT_USER)
      const requests = []
      mine.forEach(g => {
        (g.pendingRequests || []).forEach(u => {
          requests.push({ id: `${g.id}:${u}`, groupId: g.id, groupName: g.name, user: u })
        })
      })
      setGroupRequests(requests)
    } catch {}
    setLoadingGroups(false)
  }

  async function handleGroupRequest(action, groupId, user) {
    try {
      const raw = await AsyncStorage.getItem('taste-trails-groups')
      const groups = raw ? JSON.parse(raw) : []
      const next = groups.map(g => {
        if (g.id !== groupId) return g
        const pending = (g.pendingRequests || []).filter(u => u !== user)
        if (action === 'accept') {
          const members = (g.members || []).includes(user) ? g.members : [...(g.members || []), user]
          return { ...g, pendingRequests: pending, members }
        }
        return { ...g, pendingRequests: pending }
      })
      await AsyncStorage.setItem('taste-trails-groups', JSON.stringify(next))
      await loadGroupRequests()
    } catch {}
  }

  async function handleFollowRequest(requestId, action) {
    try {
      const headers = await getAuthHeaders()
      const endpoint = action === 'accept' ? 'accept' : 'decline'
      await fetch(`${API_BASE_URL}/api/follow-requests/${requestId}/${endpoint}`, {
        method: 'PUT',
        headers,
      })
      await loadFollowRequests()
    } catch {}
  }

  const total = followRequests.length + groupRequests.length
  const loading = loadingFollow || loadingGroups

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="bg-white px-4 pt-3 pb-3 shadow-sm flex-row items-center justify-between">
        <Text className="text-xl font-black text-gray-900">Notifications</Text>
        {total > 0 && (
          <View className="bg-orange-500 rounded-full px-2 py-0.5">
            <Text className="text-white text-xs font-bold">{total}</Text>
          </View>
        )}
      </View>

      {total === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Bell size={48} color="#d1d5db" />
          <Text className="text-gray-400 mt-4 text-center text-base">You're all caught up!</Text>
          <Text className="text-gray-400 text-center text-sm mt-1">Follow requests and group invites will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...followRequests.map(r => ({ ...r, type: 'follow' })),
            ...groupRequests.map(r => ({ ...r, type: 'group' })),
          ]}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ListHeaderComponent={
            followRequests.length > 0 && groupRequests.length > 0 ? null : null
          }
          renderItem={({ item }) => {
            if (item.type === 'follow') {
              return (
                <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                    <UserPlus size={18} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">{item.requester_name || 'Someone'}</Text>
                    <Text className="text-sm text-gray-500">wants to follow you</Text>
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => handleFollowRequest(item.id, 'accept')}
                      className="bg-green-500 rounded-xl px-3 py-2"
                    >
                      <Check size={14} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleFollowRequest(item.id, 'decline')}
                      className="bg-gray-200 rounded-xl px-3 py-2"
                    >
                      <X size={14} color="#6b7280" />
                    </Pressable>
                  </View>
                </View>
              )
            }

            if (item.type === 'group') {
              return (
                <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-3">
                    <Users size={18} color="#f97316" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">{item.user}</Text>
                    <Text className="text-sm text-gray-500">wants to join <Text className="font-medium">{item.groupName}</Text></Text>
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => handleGroupRequest('accept', item.groupId, item.user)}
                      className="bg-green-500 rounded-xl px-3 py-2"
                    >
                      <Check size={14} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleGroupRequest('decline', item.groupId, item.user)}
                      className="bg-gray-200 rounded-xl px-3 py-2"
                    >
                      <X size={14} color="#6b7280" />
                    </Pressable>
                  </View>
                </View>
              )
            }
            return null
          }}
        />
      )}
    </View>
  )
}
