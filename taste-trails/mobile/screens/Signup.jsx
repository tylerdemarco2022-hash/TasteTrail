import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native'
import { UserPlus, User, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react-native'
import { useAuth } from '../context/AuthContext'

export default function SignupScreen({ navigation }) {
  const { signup } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup() {
    setError('')
    if (!name || !email || !password) {
      setError('Please fill in all fields')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const result = await signup(email, password, name)
      if (!result?.success) {
        setError(result?.error || 'Signup failed')
      }
      // On success, AuthContext updates state and RootNavigator re-renders automatically
    } catch (e) {
      setError(e?.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordStrong = password.length >= 6

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
            <Text className="text-gray-500">Join the food community</Text>
          </View>

          {/* Card */}
          <View className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <Text className="text-2xl font-bold text-gray-800 mb-5 text-center">Create Account</Text>

            {error ? (
              <View className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
                <AlertCircle size={18} color="#ef4444" />
                <Text className="text-sm text-red-600 flex-1 ml-2">{error}</Text>
              </View>
            ) : null}

            {/* Name */}
            <Text className="text-sm font-medium text-gray-700 mb-1">Full Name</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl px-3 mb-4 bg-gray-50">
              <User size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 py-3 pl-2 text-gray-800"
                placeholder="John Doe"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
            </View>

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
            <View className="flex-row items-center border border-gray-300 rounded-xl px-3 mb-1 bg-gray-50">
              <Lock size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 py-3 pl-2 text-gray-800"
                placeholder="At least 6 characters"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
            {passwordStrong ? (
              <View className="flex-row items-center mb-3">
                <CheckCircle size={12} color="#16a34a" />
                <Text className="text-xs text-green-600 ml-1">Strong password</Text>
              </View>
            ) : <View className="mb-3" />}

            {/* Confirm Password */}
            <Text className="text-sm font-medium text-gray-700 mb-1">Confirm Password</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl px-3 mb-1 bg-gray-50">
              <Lock size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 py-3 pl-2 text-gray-800"
                placeholder="Confirm password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>
            {passwordsMatch ? (
              <View className="flex-row items-center mb-4">
                <CheckCircle size={12} color="#16a34a" />
                <Text className="text-xs text-green-600 ml-1">Passwords match</Text>
              </View>
            ) : <View className="mb-4" />}

            {/* Signup Button */}
            <Pressable
              onPress={handleSignup}
              disabled={loading}
              className="bg-orange-500 rounded-xl py-3.5 items-center mb-4"
              style={({ pressed }) => ({ opacity: pressed || loading ? 0.7 : 1 })}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center">
                  <UserPlus size={18} color="#fff" />
                  <Text className="text-white font-semibold text-base ml-2">Sign Up</Text>
                </View>
              )}
            </Pressable>

            {/* Divider */}
            <View className="flex-row items-center my-2">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="mx-3 text-gray-400 text-sm">Already have an account?</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            <Pressable
              onPress={() => navigation.navigate('Login')}
              className="border-2 border-gray-200 rounded-xl py-3 items-center mt-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-gray-700 font-semibold">Log In</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
