import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native'
import { LogIn, Lock, Mail, AlertCircle } from 'lucide-react-native'
import { useAuth } from '../context/AuthContext'

export default function LoginScreen({ navigation }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('')
    if (!email || !password) {
      setError('Please enter your email and password')
      return
    }
    setLoading(true)
    try {
      const result = await login(email, password)
      if (!result?.success) {
        setError(result?.error || 'Login failed')
      }
    } catch (e) {
      setError(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-orange-50"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center p-6">
          {/* Brand */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-orange-500 rounded-full items-center justify-center mb-4 shadow-lg">
              <Text className="text-4xl">🍽️</Text>
            </View>
            <Text className="text-4xl font-bold text-gray-800 mb-1">TasteTrails</Text>
            <Text className="text-gray-500">Discover. Rate. Share.</Text>
          </View>

          {/* Card */}
          <View className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <Text className="text-2xl font-bold text-gray-800 mb-5 text-center">Welcome Back</Text>

            {error ? (
              <View className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex-row items-start gap-2">
                <AlertCircle size={18} color="#ef4444" />
                <Text className="text-sm text-red-600 flex-1 ml-2">{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl px-3 mb-4 bg-gray-50">
              <Mail size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 py-3 pl-2 text-gray-800"
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            {/* Password */}
            <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl px-3 mb-5 bg-gray-50">
              <Lock size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 py-3 pl-2 text-gray-800"
                placeholder="Enter password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            {/* Login Button */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className="bg-orange-500 rounded-xl py-3.5 items-center mb-4"
              style={({ pressed }) => ({ opacity: pressed || loading ? 0.7 : 1 })}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <LogIn size={18} color="#fff" />
                  <Text className="text-white font-semibold text-base ml-2">Log In</Text>
                </View>
              )}
            </Pressable>

            {/* Divider */}
            <View className="flex-row items-center my-2">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="mx-3 text-gray-400 text-sm">New to TasteTrails?</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            {/* Sign Up */}
            <Pressable
              onPress={() => navigation.navigate('Signup')}
              className="border-2 border-gray-200 rounded-xl py-3 items-center mt-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-gray-700 font-semibold">Create Account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
