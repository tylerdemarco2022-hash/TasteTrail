import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable, ScrollView,
  Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import {
  User, Shield, Leaf, Bell, Palette, Info,
  ChevronLeft, Eye, EyeOff, LogOut, Trash2, Save, ChevronRight
} from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const DIETARY_OPTIONS = [
  { key: 'vegan',          label: 'Vegan',         emoji: '🌱' },
  { key: 'vegetarian',     label: 'Vegetarian',     emoji: '🥦' },
  { key: 'gluten_free',    label: 'Gluten-Free',    emoji: '🌾' },
  { key: 'dairy_free',     label: 'Dairy-Free',     emoji: '🥛' },
  { key: 'nut_free',       label: 'Nut-Free',       emoji: '🥜' },
  { key: 'shellfish_free', label: 'Shellfish-Free', emoji: '🦐' },
  { key: 'halal',          label: 'Halal',          emoji: '☪️'  },
  { key: 'kosher',         label: 'Kosher',         emoji: '✡️'  },
  { key: 'keto',           label: 'Keto',           emoji: '🥩' },
  { key: 'paleo',          label: 'Paleo',          emoji: '🍖' },
]

const TABS = [
  { key: 'account',     label: 'Account',      Icon: User    },
  { key: 'privacy',     label: 'Privacy',       Icon: Shield  },
  { key: 'dietary',     label: 'Dietary',       Icon: Leaf    },
  { key: 'appearance',  label: 'Appearance',    Icon: Palette },
  { key: 'about',       label: 'About',         Icon: Info    },
]

export default function SettingsScreen({ navigation }) {
  const { profile, user, logout, refreshProfile, getAuthHeaders } = useAuth()
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState('account')

  // Account
  const [displayName, setDisplayName]       = useState(profile?.name  || '')
  const [email, setEmail]                   = useState(profile?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords]   = useState(false)
  const [profileSaving, setProfileSaving]   = useState(false)
  const [pwSaving, setPwSaving]             = useState(false)

  // Privacy
  const [isPrivate, setIsPrivate]           = useState(profile?.is_private || false)
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false)

  // Dietary
  const [dietary, setDietary] = useState([])

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.name  || '')
      setEmail(profile.email       || '')
      setIsPrivate(!!profile.is_private)
    }
    loadDietary()
  }, [profile])

  async function loadDietary() {
    try {
      const raw = await AsyncStorage.getItem('dietary_preferences')
      setDietary(raw ? JSON.parse(raw) : [])
    } catch { setDietary([]) }
  }

  async function apiCall(method, path, body) {
    const headers = await getAuthHeaders()
    const opts = { method, headers }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${API_BASE_URL}${path}`, opts)
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error('Server returned non-JSON response') }
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
    return data
  }

  async function handleSaveProfile() {
    setProfileSaving(true)
    try {
      await apiCall('PUT', '/auth/profile', { name: displayName, email })
      await refreshProfile()
      Alert.alert('Saved', 'Profile updated successfully.')
    } catch (err) {
      Alert.alert('Error', err.message)
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPassword) { Alert.alert('Error', 'Enter your current password'); return }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return }
    if (newPassword.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return }
    setPwSaving(true)
    try {
      await apiCall('PUT', '/auth/password', { currentPassword, newPassword })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      Alert.alert('Success', 'Password changed successfully.')
    } catch (err) {
      Alert.alert('Error', err.message)
    } finally {
      setPwSaving(false)
    }
  }

  async function handlePrivacyToggle(value) {
    setIsPrivate(value)
    setUpdatingPrivacy(true)
    try {
      await apiCall('PUT', '/auth/profile', { is_private: value })
      await refreshProfile()
    } catch {
      setIsPrivate(!value)
      Alert.alert('Error', 'Could not update privacy setting')
    } finally {
      setUpdatingPrivacy(false)
    }
  }

  async function toggleDietary(key) {
    const next = dietary.includes(key) ? dietary.filter(k => k !== key) : [...dietary, key]
    setDietary(next)
    await AsyncStorage.setItem('dietary_preferences', JSON.stringify(next))
  }

  function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() }
    ])
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'Permanently delete your account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'All posts, ratings, and data will be deleted forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete', style: 'destructive',
                  onPress: async () => {
                    try { await apiCall('DELETE', '/auth/account') } catch {}
                    logout()
                  }
                }
              ]
            )
          }
        }
      ]
    )
  }

  const displayUserName = profile?.name || user?.email?.split('@')[0] || 'User'

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-4 pt-3 pb-4 shadow-sm flex-row items-center">
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <ChevronLeft size={24} color="#374151" />
        </Pressable>
        <Text className="text-xl font-black text-gray-900">Settings</Text>
      </View>

      <View className="flex-1 flex-row">
        {/* Sidebar */}
        <View className="w-28 bg-white border-r border-gray-100 py-3">
          {TABS.map(({ key, label, Icon }) => (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key)}
              className={`flex-row items-center px-3 py-3 mx-2 rounded-xl mb-1 ${
                activeTab === key ? 'bg-orange-500' : ''
              }`}
            >
              <Icon size={16} color={activeTab === key ? '#fff' : '#6b7280'} />
              <Text
                className={`ml-1.5 text-xs font-semibold`}
                style={{ color: activeTab === key ? '#fff' : '#6b7280' }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

            {/* ── ACCOUNT ─────────────────────────────── */}
            {activeTab === 'account' && (
              <View>
                <Text className="text-base font-bold text-gray-900 mb-1">Account Settings</Text>
                <Text className="text-xs text-gray-500 mb-5">Manage your profile and credentials</Text>

                {/* Avatar initial */}
                <View className="items-center mb-5">
                  <View
                    className="w-20 h-20 rounded-full items-center justify-center"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    <Text className="text-3xl font-bold text-white">
                      {displayUserName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text className="mt-2 font-semibold text-gray-800">{displayUserName}</Text>
                  <Text className="text-xs text-gray-500">{profile?.email || ''}</Text>
                  {profile?.role === 'admin' && (
                    <View className="mt-1 bg-purple-100 px-2 py-0.5 rounded-full">
                      <Text className="text-xs font-semibold text-purple-700">Admin</Text>
                    </View>
                  )}
                </View>

                {/* Name */}
                <Text className="text-sm font-medium text-gray-700 mb-1">Display Name</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-3 py-3 bg-white text-gray-800 mb-3 text-sm"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholderTextColor="#9ca3af"
                  placeholder="Your name"
                />

                {/* Email */}
                <Text className="text-sm font-medium text-gray-700 mb-1">Email Address</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-3 py-3 bg-white text-gray-800 mb-4 text-sm"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#9ca3af"
                  placeholder="you@example.com"
                />

                <Pressable
                  onPress={handleSaveProfile}
                  disabled={profileSaving}
                  className={`flex-row items-center justify-center py-3 rounded-xl mb-6 ${profileSaving ? 'bg-orange-300' : 'bg-orange-500'}`}
                >
                  {profileSaving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <>
                        <Save size={16} color="#fff" />
                        <Text className="text-white font-bold ml-2">Save Profile</Text>
                      </>
                  }
                </Pressable>

                {/* Change Password */}
                <View className="border-t border-gray-100 pt-5 mb-6">
                  <Text className="text-sm font-bold text-gray-800 mb-4">Change Password</Text>
                  {[
                    { label: 'Current Password', value: currentPassword, setter: setCurrentPassword },
                    { label: 'New Password', value: newPassword, setter: setNewPassword },
                    { label: 'Confirm New Password', value: confirmPassword, setter: setConfirmPassword },
                  ].map(({ label, value, setter }) => (
                    <View key={label} className="mb-3">
                      <Text className="text-xs font-medium text-gray-600 mb-1">{label}</Text>
                      <TextInput
                        className="border border-gray-200 rounded-xl px-3 py-3 bg-white text-gray-800 text-sm"
                        secureTextEntry={!showPasswords}
                        value={value}
                        onChangeText={setter}
                        placeholderTextColor="#9ca3af"
                        placeholder="••••••••"
                      />
                    </View>
                  ))}
                  <Pressable
                    onPress={() => setShowPasswords(v => !v)}
                    className="flex-row items-center mb-3"
                  >
                    {showPasswords
                      ? <EyeOff size={14} color="#9ca3af" />
                      : <Eye size={14} color="#9ca3af" />
                    }
                    <Text className="text-xs text-gray-400 ml-1.5">
                      {showPasswords ? 'Hide' : 'Show'} passwords
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleChangePassword}
                    disabled={pwSaving}
                    className={`py-3 rounded-xl items-center ${pwSaving ? 'bg-gray-300' : 'bg-orange-500'}`}
                  >
                    {pwSaving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text className="text-white font-bold text-sm">Update Password</Text>
                    }
                  </Pressable>
                </View>

                {/* Danger zone */}
                <View className="border-t border-red-100 pt-5">
                  <Text className="text-sm font-bold text-red-600 mb-3">Danger Zone</Text>
                  <Pressable
                    onPress={handleLogout}
                    className="flex-row items-center p-3.5 bg-gray-50 rounded-xl border border-gray-200 mb-3"
                  >
                    <LogOut size={16} color="#374151" />
                    <Text className="text-gray-700 font-semibold ml-3 text-sm">Log Out</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDeleteAccount}
                    className="flex-row items-center p-3.5 bg-red-50 rounded-xl border border-red-200"
                  >
                    <Trash2 size={16} color="#ef4444" />
                    <Text className="text-red-600 font-semibold ml-3 text-sm">Delete Account Permanently</Text>
                  </Pressable>
                  <Text className="text-xs text-gray-400 mt-2 text-center">
                    Permanently deletes your profile, ratings, and all stored data
                  </Text>
                </View>
              </View>
            )}

            {/* ── PRIVACY ─────────────────────────────── */}
            {activeTab === 'privacy' && (
              <View>
                <Text className="text-base font-bold text-gray-900 mb-1">Privacy</Text>
                <Text className="text-xs text-gray-500 mb-5">Control who can see your profile and activity</Text>

                <View className="bg-white rounded-2xl p-4 border border-gray-100">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-sm font-semibold text-gray-800">Private Profile</Text>
                      <Text className="text-xs text-gray-500 mt-0.5">
                        Others must send a follow request — approve or decline them in Notifications
                      </Text>
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
              </View>
            )}

            {/* ── DIETARY ─────────────────────────────── */}
            {activeTab === 'dietary' && (
              <View>
                <Text className="text-base font-bold text-gray-900 mb-1">Dietary Preferences</Text>
                <Text className="text-xs text-gray-500 mb-5">
                  Select your dietary needs so TasteTrails can highlight suitable dishes
                </Text>

                <View className="flex-row flex-wrap gap-2">
                  {DIETARY_OPTIONS.map(({ key, label, emoji }) => (
                    <Pressable
                      key={key}
                      onPress={() => toggleDietary(key)}
                      className={`flex-row items-center px-3 py-2.5 rounded-xl border-2 ${
                        dietary.includes(key)
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 bg-white'
                      }`}
                      style={{ width: '47%' }}
                    >
                      <Text style={{ fontSize: 18 }}>{emoji}</Text>
                      <Text
                        className={`ml-2 text-sm font-semibold ${
                          dietary.includes(key) ? 'text-orange-700' : 'text-gray-700'
                        }`}
                      >
                        {label}
                      </Text>
                      {dietary.includes(key) && (
                        <Text className="ml-auto text-orange-500 font-bold text-xs">✓</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
                <Text className="text-xs text-gray-400 mt-4 text-center">
                  Changes apply instantly – menus will update based on your selection
                </Text>
              </View>
            )}

            {/* ── APPEARANCE ──────────────────────────── */}
            {activeTab === 'appearance' && (
              <View>
                <Text className="text-base font-bold text-gray-900 mb-1">Appearance</Text>
                <Text className="text-xs text-gray-500 mb-5">Customize the look and feel of TasteTrails</Text>

                <View className="bg-white rounded-2xl p-4 border border-gray-100">
                  <Text className="text-sm font-semibold text-gray-700 mb-1">Theme</Text>
                  <Text className="text-xs text-gray-400">
                    Dark mode is coming soon — the app currently uses your system's light theme.
                  </Text>
                </View>
              </View>
            )}

            {/* ── ABOUT ───────────────────────────────── */}
            {activeTab === 'about' && (
              <View>
                <Text className="text-base font-bold text-gray-900 mb-1">About TasteTrails</Text>
                <Text className="text-xs text-gray-500 mb-5">App info and legal</Text>

                <View
                  className="rounded-2xl p-6 items-center mb-5"
                  style={{ backgroundColor: '#fff7ed' }}
                >
                  <Text style={{ fontSize: 48 }}>🍽️</Text>
                  <Text className="text-xl font-black text-gray-800 mt-2">TasteTrails</Text>
                  <Text className="text-sm text-gray-500 mt-1">Discover, Rate & Share Amazing Food</Text>
                  <Text className="text-xs text-gray-400 mt-2">Version 1.0.0 · Built for food lovers</Text>
                </View>

                {[
                  { label: '📋 Terms of Service' },
                  { label: '🔒 Privacy Policy' },
                  { label: '🐛 Report a Bug' },
                  { label: '⭐ Rate the App' },
                  { label: '💬 Send Feedback' },
                ].map(({ label }) => (
                  <Pressable
                    key={label}
                    onPress={() => Alert.alert(label, 'Coming soon!')}
                    className="flex-row items-center justify-between p-4 bg-white rounded-xl border border-gray-100 mb-2"
                  >
                    <Text className="text-sm text-gray-700 font-medium">{label}</Text>
                    <ChevronRight size={16} color="#9ca3af" />
                  </Pressable>
                ))}

                <Text className="text-xs text-gray-400 text-center mt-4">
                  © 2026 TasteTrails. All rights reserved.
                </Text>
              </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  )
}
