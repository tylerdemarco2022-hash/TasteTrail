import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TextInput, Pressable,
  ActivityIndicator, RefreshControl, Alert
} from 'react-native'
import { Heart, MessageCircle, Plus } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import PostCard from '../components/PostCard'

const POSTS_KEY = 'community-posts'

export default function CommunityFeedScreen({ navigation }) {
  const { profile, getAuthHeaders } = useAuth()
  const insets = useSafeAreaInsets()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newPostText, setNewPostText] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadPosts()
  }, [])

  async function loadPosts() {
    try {
      // Load from cache first
      const cached = await AsyncStorage.getItem(POSTS_KEY)
      if (cached) setPosts(JSON.parse(cached))

      // Fetch from API
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/posts`, { headers })
      if (res.ok) {
        const data = await res.json()
        const list = data.posts || data || []
        setPosts(list)
        await AsyncStorage.setItem(POSTS_KEY, JSON.stringify(list))
      }
    } catch (e) {
      console.warn('Community feed load error:', e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadPosts()
  }

  async function handleAddPost() {
    if (!newPostText.trim()) return
    setSubmitting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: newPostText.trim(),
          user_id: profile?.id,
          user_name: profile?.name || 'User'
        })
      })
      if (res.ok) {
        setNewPostText('')
        setShowCompose(false)
        await loadPosts()
      } else {
        Alert.alert('Error', 'Could not post. Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleLike(postId) {
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, likes: (p.likes || 0) + 1, liked: !p.liked }
        : p
    ))
  }

  if (loading && posts.length === 0) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-4 pt-3 pb-3 border-b border-gray-100 flex-row items-center justify-between">
        <Text className="text-xl font-black text-gray-900">Community</Text>
        <Pressable
          onPress={() => setShowCompose(true)}
          className="flex-row items-center gap-1 bg-orange-500 px-3 py-1.5 rounded-full"
        >
          <Plus size={14} color="#fff" />
          <Text className="text-white text-sm font-semibold ml-1">Post</Text>
        </Pressable>
      </View>

      {/* Compose */}
      {showCompose && (
        <View className="bg-white border-b border-gray-100 px-4 py-3">
          <TextInput
            className="bg-gray-50 rounded-xl px-3 py-3 text-gray-800 text-sm mb-2"
            placeholder="Share a food experience…"
            placeholderTextColor="#9ca3af"
            value={newPostText}
            onChangeText={setNewPostText}
            multiline
            numberOfLines={3}
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => { setShowCompose(false); setNewPostText('') }}
              className="flex-1 border border-gray-200 rounded-xl py-2 items-center"
            >
              <Text className="text-gray-600 font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddPost}
              disabled={submitting || !newPostText.trim()}
              className={`flex-1 rounded-xl py-2 items-center ${newPostText.trim() ? 'bg-orange-500' : 'bg-gray-200'}`}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text className={`font-semibold ${newPostText.trim() ? 'text-white' : 'text-gray-400'}`}>Share</Text>
              }
            </Pressable>
          </View>
        </View>
      )}

      {/* Posts */}
      <FlatList
        data={posts}
        keyExtractor={(item, idx) => String(item.id || idx)}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => handleLike(item.id)}
            onRestaurantPress={(restaurant) => navigation.navigate('MenuView', { restaurant })}
            onUserPress={(user) => navigation.navigate('UserProfile', { user })}
          />
        )}
        contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Text className="text-4xl mb-3">💬</Text>
            <Text className="text-gray-500 text-center">No posts yet. Be the first to share!</Text>
          </View>
        }
      />
    </View>
  )
}
