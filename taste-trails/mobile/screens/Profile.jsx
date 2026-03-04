import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, Modal, TextInput,
  Alert, FlatList, Image, ActivityIndicator, Switch
} from 'react-native'
import {
  User, Lock, Unlock, Star, Settings, Edit2, Grid, Bookmark, Bell
} from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { emit, on } from '../utils/eventEmitter'

const AVATAR_COLORS = ['#f97316', '#8b5cf6', '#06b6d4', '#10b981', '#f43f5e']

function getAvatarColor(name) {
  const idx = name ? name.charCodeAt(0) % AVATAR_COLORS.length : 0
  return AVATAR_COLORS[idx]
}

export default function ProfileScreen({ navigation }) {
  const { user, profile, logout, refreshProfile, getAuthHeaders } = useAuth()
  const insets = useSafeAreaInsets()
  const profileId = profile?.id || user?.id
  const [gallery, setGallery] = useState([])
  const [badges, setBadges] = useState([])
  const [activeTab, setActiveTab] = useState('rated')
  const [bio, setBio] = useState('Welcome to TasteTrails! Start exploring and rating dishes.')
  const [editingBio, setEditingBio] = useState(false)
  const [editBioText, setEditBioText] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false)
  // settings navigation handled via navigate()

  useEffect(() => {
    loadProfile()
    const sub = on('ratingSaved', loadProfile)
    return () => sub.remove()
  }, [profileId])

  async function loadProfile() {
    try {
      const bioStored = await AsyncStorage.getItem(`user_bio:${profileId}`)
      if (bioStored) setBio(bioStored)

      const badgesRaw = await AsyncStorage.getItem('taste-trails-badges')
      const allBadges = badgesRaw ? JSON.parse(badgesRaw) : []
      setBadges(allBadges.filter(b => b.user === 'You'))

      const ratedRaw = await AsyncStorage.getItem(`my-rated-items:${profileId}`)
      const rated = ratedRaw ? JSON.parse(ratedRaw) : []
      setGallery(rated)
    } catch {}

    if (profile?.is_private !== undefined) {
      setIsPrivate(profile.is_private)
    }
  }

  async function handleSaveBio() {
    setBio(editBioText)
    await AsyncStorage.setItem(`user_bio:${profileId}`, editBioText)
    setEditingBio(false)

    try {
      const headers = await getAuthHeaders()
      await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ bio: editBioText })
      })
    } catch {}
  }

  async function handlePrivacyToggle(value) {
    setIsPrivate(value)
    setUpdatingPrivacy(true)
    try {
      const headers = await getAuthHeaders()
      await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_private: value })
      })
      await refreshProfile()
    } catch {
      setIsPrivate(!value)
      Alert.alert('Error', 'Could not update privacy setting')
    } finally {
      setUpdatingPrivacy(false)
    }
  }

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() }
    ])
  }

  const displayName = profile?.name || user?.email?.split('@')[0] || 'User'
  const avatarColor = getAvatarColor(displayName)
  const stats = [
    { label: 'Reviews', value: gallery.length },
    { label: 'Badges', value: badges.length },
    { label: 'Following', value: profile?.following_count || 0 },
    { label: 'Followers', value: profile?.follower_count || 0 },
  ]

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Header */}
        <View className="bg-white px-4 pt-4 pb-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-black text-gray-900">Profile</Text>
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => navigation.navigate('Notifications')}>
                <Bell size={20} color="#6b7280" />
              </Pressable>
              <Pressable onPress={() => navigation.navigate('Settings')}>
                <Settings size={20} color="#6b7280" />
              </Pressable>
            </View>
          </View>

          {/* Avatar + Name */}
          <View className="flex-row items-center mb-4">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: avatarColor }}
            >
              <Text className="text-3xl font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">{displayName}</Text>
              <Text className="text-sm text-gray-500">{user?.email || ''}</Text>
              <Pressable
                onPress={() => { setEditBioText(bio); setEditingBio(true) }}
                className="flex-row items-center mt-1"
              >
                <Edit2 size={12} color="#9ca3af" />
                <Text className="text-xs text-gray-400 ml-1">Edit bio</Text>
              </Pressable>
            </View>
          </View>

          {/* Bio */}
          <Text className="text-sm text-gray-600 mb-4">{bio}</Text>

          {/* Stats */}
          <View className="flex-row justify-around border-t border-gray-100 pt-4">
            {stats.map(stat => (
              <View key={stat.label} className="items-center">
                <Text className="text-xl font-black text-gray-900">{stat.value}</Text>
                <Text className="text-xs text-gray-400">{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Privacy Toggle */}
          <View className="flex-row items-center justify-between mt-4 bg-gray-50 rounded-xl p-3">
            <View className="flex-row items-center gap-2">
              {isPrivate ? <Lock size={16} color="#6b7280" /> : <Unlock size={16} color="#6b7280" />}
              <View className="ml-2">
                <Text className="text-sm font-semibold text-gray-800">
                  {isPrivate ? 'Private Account' : 'Public Account'}
                </Text>
                <Text className="text-xs text-gray-400">
                  {isPrivate ? 'Only approved followers see your posts' : 'Anyone can see your posts'}
                </Text>
              </View>
            </View>
            {updatingPrivacy
              ? <ActivityIndicator size="small" color="#f97316" />
              : <Switch
                  value={isPrivate}
                  onValueChange={handlePrivacyToggle}
                  trackColor={{ false: '#d1d5db', true: '#f97316' }}
                  thumbColor="#fff"
                />
            }
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-white border-b border-gray-100 mt-2">
          {[{ id: 'rated', label: 'Rated', icon: Star }, { id: 'saved', label: 'Saved', icon: Bookmark }].map(tab => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-1 flex-row items-center justify-center py-3 border-b-2 ${activeTab === tab.id ? 'border-orange-500' : 'border-transparent'}`}
            >
              <tab.icon size={16} color={activeTab === tab.id ? '#f97316' : '#9ca3af'} />
              <Text className={`ml-1.5 text-sm font-semibold ${activeTab === tab.id ? 'text-orange-500' : 'text-gray-400'}`}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Rated Gallery */}
        {activeTab === 'rated' && (
          <View className="p-3">
            {gallery.length === 0 ? (
              <View className="items-center py-12">
                <Star size={40} color="#d1d5db" />
                <Text className="text-gray-400 mt-3 text-center">
                  No rated dishes yet. Open a restaurant menu and start rating!
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {gallery.map((item, idx) => (
                  <View key={idx} className="bg-white rounded-xl p-3 shadow-sm" style={{ width: '47%' }}>
                    <Text className="text-sm font-semibold text-gray-900 mb-0.5" numberOfLines={1}>
                      {item.name || item.dish_name || 'Dish'}
                    </Text>
                    <Text className="text-xs text-gray-400 mb-1" numberOfLines={1}>
                      {item.restaurant}
                    </Text>
                    <View className="flex-row items-center">
                      <Star size={12} color="#f59e0b" fill="#f59e0b" />
                      <Text className="text-xs text-gray-700 ml-1 font-semibold">{item.rating || '—'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'saved' && (
          <View className="items-center py-12 px-4">
            <Bookmark size={40} color="#d1d5db" />
            <Text className="text-gray-400 mt-3 text-center">
              Saved items will appear here
            </Text>
          </View>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <View className="px-3 mt-2">
            <Text className="text-base font-bold text-gray-800 mb-2">Badges</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {badges.map((badge, idx) => (
                <View key={idx} className="bg-white rounded-xl p-3 mr-2 items-center shadow-sm" style={{ width: 80 }}>
                  <Text className="text-2xl mb-1">{badge.icon || '🏅'}</Text>
                  <Text className="text-xs text-gray-700 text-center" numberOfLines={2}>{badge.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Edit Bio Modal */}
      <Modal visible={editingBio} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/30">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">Edit Bio</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 text-gray-800 mb-4"
              value={editBioText}
              onChangeText={setEditBioText}
              multiline
              numberOfLines={3}
              placeholder="Tell people about yourself…"
              placeholderTextColor="#9ca3af"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setEditingBio(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
              >
                <Text className="text-gray-600 font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveBio}
                className="flex-1 bg-orange-500 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-bold">Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  )
}
