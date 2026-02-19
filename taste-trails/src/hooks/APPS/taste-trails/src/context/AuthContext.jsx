import { API_BASE_URL } from '../config/api'
import React, { createContext, useState, useContext, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('access_token'))

  // Check if user is logged in on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('access_token')
    const savedProfile = localStorage.getItem('user_profile')
    
    if (savedToken && savedProfile) {
      setToken(savedToken)
      try {
        setProfile(JSON.parse(savedProfile))
      } catch (e) {
        console.error('Failed to parse saved profile:', e)
        localStorage.removeItem('user_profile')
      }
      fetchCurrentUser(savedToken)
    } else {
      setLoading(false)
    }
  }, [])

  async function fetchCurrentUser(accessToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
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
      } else {
        // Token invalid, clear auth
        logout()
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  async function login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const text = await response.text();
      const data = JSON.parse(text);
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed");
      }
      // Store token and user/profile in localStorage and state
      if (data.token) {
        localStorage.setItem('access_token', data.token);
        setToken(data.token);
      }
      if (data.user) {
        setUser(data.user);
      }
      if (data.profile) {
        setProfile(data.profile);
        localStorage.setItem('user_profile', JSON.stringify(data.profile));
      }
      return { success: true };
    } catch (error) {
      // Handle network errors
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        return { success: false, error: 'Cannot connect to server. Make sure the backend is running on http://localhost:8081' }
      }
      return { success: false, error: error.message }
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
        return { success: false, error: 'Cannot connect to server. Make sure the backend is running on http://localhost:8081' }
      }
      return { success: false, error: error.message }
    }
  }

  function logout() {
    setUser(null)
    setProfile(null)
    setToken(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_profile')
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
