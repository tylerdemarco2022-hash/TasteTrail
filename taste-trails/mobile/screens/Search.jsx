import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, Pressable, ActivityIndicator
} from 'react-native'
import { Search, User, MapPin, X } from 'lucide-react-native'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function SearchScreen({ navigation }) {
  const { getAuthHeaders } = useAuth()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ users: [], restaurants: [] })
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query)

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults({ users: [], restaurants: [] })
      return
    }
    performSearch(debouncedQuery)
  }, [debouncedQuery])

  async function performSearch(q) {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const [usersRes, restsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(q)}`, { headers }),
        fetch(`${API_BASE_URL}/api/nearby-restaurants?q=${encodeURIComponent(q)}`, { headers })
      ])

      const [usersData, restsData] = await Promise.all([
        usersRes.ok ? usersRes.json() : { users: [] },
        restsRes.ok ? restsRes.json() : { restaurants: [] }
      ])

      setResults({
        users: usersData.users || [],
        restaurants: restsData.restaurants || []
      })
    } catch {
      setResults({ users: [], restaurants: [] })
    } finally {
      setLoading(false)
    }
  }

  const allResults = [
    ...results.users.map(u => ({ ...u, _type: 'user' })),
    ...results.restaurants.map(r => ({ ...r, _type: 'restaurant' }))
  ]

  function handleSelect(item) {
    if (item._type === 'user') {
      navigation.navigate('UserProfile', { user: item })
    } else {
      navigation.navigate('MenuView', { restaurant: item })
    }
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Search bar */}
      <View className="px-4 pt-4 pb-3 border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5">
          <Search size={17} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-gray-800"
            placeholder="Search users, restaurants…"
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <X size={16} color="#9ca3af" />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#f97316" />
        </View>
      ) : allResults.length === 0 && query.trim().length >= 2 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-gray-400 text-center">No results found for "{query}"</Text>
        </View>
      ) : query.trim().length < 2 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Search size={48} color="#e5e7eb" />
          <Text className="text-gray-400 mt-3 text-center">Search for users or restaurants</Text>
        </View>
      ) : (
        <FlatList
          data={allResults}
          keyExtractor={(item, idx) => `${item._type}-${item.id || idx}`}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item)}
              className="flex-row items-center px-4 py-3 border-b border-gray-50"
            >
              <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${item._type === 'user' ? 'bg-purple-100' : 'bg-orange-100'}`}>
                {item._type === 'user'
                  ? <User size={18} color="#7c3aed" />
                  : <MapPin size={18} color="#f97316" />
                }
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  {item.name || item.email || 'Unknown'}
                </Text>
                <Text className="text-xs text-gray-400">
                  {item._type === 'user' ? 'User' : item.cuisine || 'Restaurant'}
                </Text>
              </View>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  )
}
