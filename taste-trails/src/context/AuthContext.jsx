import { API_BASE_URL } from '../config/api'
import React, { createContext, useState, useContext, useEffect } from 'react'
import { readSessionValue, removeSessionValue, writeSessionValue } from '../services/sessionClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)

  function rememberSession(data) {
    if (data?.token) {
      writeSessionValue('access_token', data.token)
      localStorage.setItem('access_token', data.token)
      setToken(data.token)
    }
    if (data?.refreshToken) {
      writeSessionValue('refresh_token', data.refreshToken)
      localStorage.setItem('refresh_token', data.refreshToken)
    }
    if (data?.profile) {
      setProfile(data.profile)
      const stored = JSON.stringify(data.profile)
      writeSessionValue('user_profile', stored)
      localStorage.setItem('user_profile', stored)
    }
    if (data?.user) setUser(data.user)
    else if (data?.profile) setUser({ id: data.profile.id, email: data.profile.email })
  }

  async function refreshSession() {
    const refreshToken = localStorage.getItem('refresh_token') || await readSessionValue('refresh_token')
    if (!refreshToken) return false
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })
    if (!response.ok) return false
    rememberSession(await response.json())
    return true
  }

  // Check if user is logged in on mount
  useEffect(() => {
    let cancelled = false
    async function restore() {
      const savedToken = localStorage.getItem('access_token') || await readSessionValue('access_token')
      const savedProfile = localStorage.getItem('user_profile') || await readSessionValue('user_profile')
      if (cancelled) return
      if (savedToken) {
        if (savedToken) localStorage.setItem('access_token', savedToken)
        setToken(savedToken)
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile)
            setProfile(parsed)
            setUser({ id: parsed?.id, email: parsed?.email })
          } catch {
            localStorage.removeItem('user_profile')
          }
        }
        await fetchCurrentUser(savedToken)
      } else if (await refreshSession()) {
        setLoading(false)
      } else {
        setLoading(false)
      }
    }
    restore()
    return () => { cancelled = true }
  }, [])

  async function fetchCurrentUser(accessToken) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        signal: controller.signal
      })
      
      if (response.ok) {
        const text = await response.text()
        let data
        try {
          data = JSON.parse(text)
        } catch (e) {
          console.error('Profile response was not JSON')
          throw e
        }
        setUser(data.user || { id: data.profile?.id, email: data.profile?.email })
        setProfile(data.profile)
        if (data.profile) localStorage.setItem('user_profile', JSON.stringify(data.profile))
      } else if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshSession()
        if (!refreshed) logout()
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
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
        signal: controller.signal
      });

      const text = await response.text();
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        throw new Error('Server returned an invalid response')
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Login failed");
      }

      // Store token and user/profile in localStorage and state
      rememberSession(data)
      return { success: true };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { success: false, error: `Login request timed out after ${Math.round(timeoutMs / 1000)}s. Check backend connection at ${API_BASE_URL}.` }
      }
      // Handle network errors
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
        body: JSON.stringify({ email, password, name })
      })

      const text = await response.text()
      console.log("RAW FETCH RESPONSE:", text.slice(0, 200))
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error("NOT JSON RESPONSE:", text.slice(0, 200))
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

      // Account created successfully - don't auto-login, let user login manually
      return { success: true }
    } catch (error) {
      // Handle network errors
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        return { success: false, error: `Cannot connect to server. Make sure backend is running on ${API_BASE_URL}` }
      }
      return { success: false, error: error.message }
    }
  }

  async function signInWithProvider(provider, idToken, name) {
    const response = await fetch(`${API_BASE_URL}/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, idToken, name })
    })
    const data = await response.json()
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || data.message || 'Sign-in failed' }
    }
    rememberSession(data)
    return { success: true }
  }

  function logout() {
    const current = localStorage.getItem('access_token')
    if (current) {
      fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${current}` } }).catch(() => {})
    }
    setUser(null)
    setProfile(null)
    setToken(null)
    for (const key of ['access_token', 'refresh_token', 'user_profile']) {
      localStorage.removeItem(key)
      removeSessionValue(key)
    }
  }

  async function refreshProfile() {
    try {
      const currentToken = localStorage.getItem('access_token')
      if (!currentToken) return

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      })

      if (response.ok) {
        const text = await response.text()
        console.log("RAW FETCH RESPONSE:", text.slice(0, 200))
        let data
        try {
          data = JSON.parse(text)
        } catch (e) {
          console.error("NOT JSON RESPONSE:", text.slice(0, 200))
          throw e
        }
        setUser(data.user)
        setProfile(data.profile)
        localStorage.setItem('user_profile', JSON.stringify(data.profile))
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
      token,
      loading,
      isAuthenticated: !!user,
      isAdmin,
      login,
      signup,
      signInWithProvider,
      logout,
      refreshProfile
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
