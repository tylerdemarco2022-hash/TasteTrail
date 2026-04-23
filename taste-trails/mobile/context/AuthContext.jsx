import React, { createContext, useState, useContext, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'
import { API_BASE_URL } from '../config/api'

const TOKEN_KEY = 'tt_access_token'

const AuthContext = createContext(null)

async function getStoredToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

async function saveToken(token) {
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token)
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
    }
  } catch {}
}

function authHeaders(token) {
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  async function checkAuthStatus() {
    try {
      const stored = await getStoredToken()
      if (!stored) {
        setLoading(false)
        return
      }
      setToken(stored)
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: authHeaders(stored)
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setProfile(data.profile)
      } else {
        await clearAuth()
      }
    } catch {
      await clearAuth()
    } finally {
      setLoading(false)
    }
  }

  async function clearAuth() {
    setUser(null)
    setProfile(null)
    setToken(null)
    await saveToken(null)
  }

  async function login(email, password) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      })

      let data
      try {
        const text = await response.text()
        data = JSON.parse(text)
      } catch {
        throw new Error(`Non-JSON response (status ${response.status}) — backend may not be running on port 8081. If using Expo, start it with: npx expo start --port 8082`)
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Login failed')
      }

      if (data.token) {
        await saveToken(data.token)
        setToken(data.token)
      }
      if (data.user) setUser(data.user)
      if (data.profile) setProfile(data.profile)

      return { success: true }
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { success: false, error: 'Login timed out. Check your connection.' }
      }
      if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
        return { success: false, error: `Cannot connect to server at ${API_BASE_URL}` }
      }
      return { success: false, error: error?.message || 'Login failed' }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async function signup(email, password, name) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      })

      let data
      try {
        const text = await response.text()
        data = JSON.parse(text)
      } catch {
        throw new Error(`Non-JSON response (status ${response.status}) — backend may not be running on port 8081`)
      }

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed')
      }

      if (data.token) {
        await saveToken(data.token)
        setToken(data.token)
      }
      if (data.user) setUser(data.user)
      if (data.profile) setProfile(data.profile)

      return { success: true }
    } catch (error) {
      if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
        return { success: false, error: `Cannot connect to server at ${API_BASE_URL}` }
      }
      return { success: false, error: error?.message || 'Signup failed' }
    }
  }

  async function logout() {
    try {
      const stored = await getStoredToken()
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: authHeaders(stored)
      })
    } catch {}
    await clearAuth()
  }

  async function refreshProfile() {
    try {
      const stored = await getStoredToken()
      if (!stored) return
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: authHeaders(stored)
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setProfile(data.profile)
      }
    } catch {}
  }

  /**
   * Returns the current Bearer auth headers for use in API calls.
   */
  async function getAuthHeaders() {
    const stored = token || (await getStoredToken())
    return authHeaders(stored)
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        token,
        isAuthenticated: !!user,
        isAdmin,
        login,
        signup,
        logout,
        refreshProfile,
        getAuthHeaders
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
