import { API_BASE_URL } from '../config/api'
import React, { createContext, useState, useContext, useEffect } from 'react'

const AuthContext = createContext(null)

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch (e) {}
}

function safeRemoveLocalStorage(key) {
  try {
    localStorage.removeItem(key)
  } catch (e) {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check if user is logged in on mount by verifying with /auth/me
  // (token is in secure httpOnly cookie, automatic with credentials: 'include')
  useEffect(() => {
    checkAuthStatus()
  }, [])

  async function checkAuthStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include' // Include httpOnly cookies
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setProfile(data.profile)
        safeSetLocalStorage('user_profile', JSON.stringify(data.profile))
      } else {
        // Not authenticated
        clearAuth()
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
      clearAuth()
    } finally {
      setLoading(false)
    }
  }

  async function fetchCurrentUser() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include' // Include httpOnly cookies
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setProfile(data.profile)
        safeSetLocalStorage('user_profile', JSON.stringify(data.profile))
      } else if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await refreshAccessToken()
        if (!refreshed) {
          clearAuth()
        } else {
          // Retry /auth/me after refresh
          return fetchCurrentUser()
        }
      } else {
        clearAuth()
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      clearAuth()
    }
  }

  async function refreshAccessToken() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include' // Include httpOnly cookies (refresh token is in cookie)
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setProfile(data.profile)
        safeSetLocalStorage('user_profile', JSON.stringify(data.profile))
        return true
      } else {
        clearAuth()
        return false
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
      clearAuth()
      return false
    }
  }

  async function login(email, password) {
    const controller = new AbortController()
    const timeoutMs = 15000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Include cookies in response
        signal: controller.signal
      })

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        throw new Error('Server returned an invalid response')
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Login failed")
      }

      // Token is now in httpOnly cookie, set by backend
      // Store user profile and profile in state + localStorage
      if (data.user) {
        setUser(data.user)
      }
      if (data.profile) {
        setProfile(data.profile)
        safeSetLocalStorage('user_profile', JSON.stringify(data.profile))
      }
      
      // Clear onboarding completed flag so onboarding shows again on login
      safeRemoveLocalStorage('onboarding_completed')
      return { success: true }
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { success: false, error: `Login request timed out after ${Math.round(timeoutMs / 1000)}s. Check backend connection at ${API_BASE_URL}.` }
      }
      if (error?.message === 'Failed to fetch' || String(error?.message || '').includes('fetch')) {
        return { success: false, error: `Cannot connect to server. Make sure backend is running on ${API_BASE_URL}` }
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
        body: JSON.stringify({ email, password, name }),
        credentials: 'include' // Include cookies in response
      })

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error("Invalid JSON response:", text.slice(0, 200))
        throw e
      }

      if (!response.ok) {
        // Check for Supabase configuration error
        if (data.error && data.error.includes('Supabase')) {
          throw new Error('Backend database not configured. Please set up Supabase credentials in .env file.')
        }
        // Suppress rate limit messages - just show generic error
        if (data.error && data.error.includes('security purposes')) {
          throw new Error('Please try again in a moment.')
        }
        throw new Error(data.error || 'Signup failed')
      }

      // Token is now in httpOnly cookie, set by backend
      // Store profile in state + localStorage
      if (data.user) {
        setUser(data.user)
      }
      if (data.profile) {
        setProfile(data.profile)
        safeSetLocalStorage('user_profile', JSON.stringify(data.profile))
      }

      // Account created successfully - mark as new signup so onboarding shows
      safeSetLocalStorage('is_new_signup', 'true')
      safeRemoveLocalStorage('onboarding_completed')
      return { success: true }
    } catch (error) {
      // Handle network errors
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        return { success: false, error: `Cannot connect to server. Make sure backend is running on ${API_BASE_URL}` }
      }
      return { success: false, error: error.message }
    }
  }

  function clearAuth() {
    setUser(null)
    setProfile(null)
    localStorage.removeItem('user_profile')
  }

  async function logout() {
    try {
      // Call logout endpoint to invalidate refresh token and clear cookies
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      // Clear local state regardless of server response
      clearAuth()
    }
  }

  async function refreshProfile() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include' // Include httpOnly cookies
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setProfile(data.profile)
        localStorage.setItem('user_profile', JSON.stringify(data.profile))
      } else if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await refreshAccessToken()
        if (!refreshed) {
          clearAuth()
        }
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error)
    }
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAuthenticated: !!user,
      isAdmin,
      login,
      signup,
      logout,
      refreshProfile,
      refreshAccessToken
    }}>
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

