import { useState, useRef, useEffect } from 'react'
import { X, User, Shield, Database, LogOut, Trash2, Save, Eye, EyeOff, Bell, Leaf, Palette, Info, Camera } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import NotificationSettings from './NotificationSettings'
import { API_BASE_URL } from '../config/api'
import {
  applyThemeToDocument,
  getActiveProfileId,
  getPrivateProfileForUser,
  loadUserScopedValue,
  saveUserScopedValue,
  setPrivateProfileForUser
} from '../utils/accountStorage'

const DIETARY_OPTIONS = [
  { key: 'vegan',          label: 'Vegan',           emoji: '🌱' },
  { key: 'vegetarian',     label: 'Vegetarian',       emoji: '🥦' },
  { key: 'gluten_free',    label: 'Gluten-Free',      emoji: '🌾' },
  { key: 'dairy_free',     label: 'Dairy-Free',       emoji: '🥛' },
  { key: 'nut_free',       label: 'Nut-Free',         emoji: '🥜' },
  { key: 'shellfish_free', label: 'Shellfish-Free',   emoji: '🦐' },
  { key: 'egg_free',       label: 'Egg-Free',         emoji: '🥚' },
  { key: 'halal',          label: 'Halal',            emoji: '☪️' },
  { key: 'kosher',         label: 'Kosher',           emoji: '✡️' },
  { key: 'keto',           label: 'Keto',             emoji: '🥩' },
  { key: 'paleo',          label: 'Paleo',            emoji: '🍖' },
]

const TABS = [
  { key: 'account',        label: 'Account',       Icon: User    },
  { key: 'privacy',        label: 'Privacy',        Icon: Shield  },
  { key: 'dietary',        label: 'Dietary',        Icon: Leaf    },
  { key: 'notifications',  label: 'Notifications',  Icon: Bell    },
  { key: 'personalization',label: 'Preferences',    Icon: Database},
  { key: 'appearance',     label: 'Appearance',     Icon: Palette },
  { key: 'about',          label: 'About',          Icon: Info    },
]

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
    </label>
  )
}

export default function Settings({ onClose }) {
  const { profile, logout, refreshProfile } = useAuth()
  const profileId = profile?.id || getActiveProfileId()
  const [activeTab, setActiveTab] = useState('account')
  const avatarInputRef = useRef(null)

  // Account
  const [displayName, setDisplayName]   = useState(profile?.name  || '')
  const [email, setEmail]               = useState(profile?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]   = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [avatarUrl, setAvatarUrl]       = useState(() => loadUserScopedValue('taste-trails-avatar', null))
  const [profileSaving, setProfileSaving] = useState(false)
  const [pwSaving, setPwSaving]         = useState(false)

  // Privacy
  const [privateProfile, setPrivateProfile] = useState(profile?.is_private || false)

  // Dietary
  const [dietary, setDietary] = useState(() => loadUserScopedValue('taste-trails-dietary', {}))

  // Personalization
  const [aiSuggestions, setAiSuggestions] = useState(() => loadUserScopedValue('taste-trails-ai-suggestions', true))
  const [dataSharing, setDataSharing]     = useState(() => loadUserScopedValue('taste-trails-data-sharing', true))

  // Appearance
  const [theme, setTheme]             = useState(() => loadUserScopedValue('taste-trails-theme', 'light'))
  const [accentColor, setAccentColor] = useState(() => loadUserScopedValue('taste-trails-accent', 'orange'))

  // Keep form fields in sync whenever AuthContext profile updates (e.g. after refreshProfile)
  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.name  || '')
    setEmail(profile.email       || '')
    const localPrivate = getPrivateProfileForUser(profile.id)
    setPrivateProfile(typeof localPrivate === 'boolean' ? localPrivate : !!profile.is_private)
    setAvatarUrl(loadUserScopedValue('taste-trails-avatar', null, profile.id))
    setDietary(loadUserScopedValue('taste-trails-dietary', {}, profile.id))
    setAiSuggestions(loadUserScopedValue('taste-trails-ai-suggestions', true, profile.id))
    setDataSharing(loadUserScopedValue('taste-trails-data-sharing', true, profile.id))
    const storedTheme = loadUserScopedValue('taste-trails-theme', 'light', profile.id)
    setTheme(storedTheme)
    setAccentColor(loadUserScopedValue('taste-trails-accent', 'orange', profile.id))
    applyThemeToDocument(storedTheme)
  }, [profile])

  // ── helpers ──────────────────────────────────────────────────────────────

  async function apiCall(method, path, body) {
    const token = localStorage.getItem('access_token')
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    }
    if (body) opts.body = JSON.stringify(body)
    const res  = await fetch(`${API_BASE_URL}${path}`, opts)
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error('Server returned non-JSON response') }
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
    return data
  }

  // ── handlers ─────────────────────────────────────────────────────────────

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAvatarUrl(ev.target.result)
      saveUserScopedValue('taste-trails-avatar', ev.target.result, profileId)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    try {
      await apiCall('PUT', '/auth/profile', { name: displayName, email, is_private: privateProfile })
      setPrivateProfileForUser(profileId, privateProfile)
      window.dispatchEvent(new Event('privacyUpdated'))
      await refreshProfile()
      alert('Profile updated!')
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setProfileSaving(false)
    }
  }

  const savePrivacySetting = async (value) => {
    try {
      const data = await apiCall('PUT', '/auth/profile', { is_private: value })
      setPrivateProfile(!!data.profile?.is_private)
      setPrivateProfileForUser(profileId, !!data.profile?.is_private)
      window.dispatchEvent(new Event('privacyUpdated'))
      await refreshProfile()
    } catch (err) {
      setPrivateProfile(value)
      setPrivateProfileForUser(profileId, value)
      window.dispatchEvent(new Event('privacyUpdated'))
      alert('Failed to update privacy: ' + err.message)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword)                          { alert('Enter your current password'); return }
    if (newPassword !== confirmPassword)            { alert('Passwords do not match');       return }
    if (newPassword.length < 6)                    { alert('Password must be at least 6 characters'); return }
    setPwSaving(true)
    try {
      await apiCall('PUT', '/auth/password', { currentPassword, newPassword })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      alert('Password changed successfully!')
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setPwSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Permanently delete your account? This cannot be undone.'))  return
    if (!confirm('All posts, ratings, and data will be deleted forever — are you sure?')) return
    try {
      await apiCall('DELETE', '/auth/account')
    } catch (err) {
      console.warn('Delete account API error (clearing data and logging out anyway):', err.message)
    }
    // Wipe all local data before logout
    const keysToClear = [
      'user_profile', 'access_token',
      `taste-trails-avatar:${profileId}`,
      `my-rated-items:${profileId}`,
      'savedItems', 'taste-trails-badges',
      'taste-trails-following', 'taste-trails-groups',
      'taste-trails-comments', 'taste-trails-messages',
      'taste-trails-challenges', 'taste-trails-viewed-challenges',
      `taste-trails-dietary:${profileId}`,
      `taste-trails-ai-suggestions:${profileId}`,
      `taste-trails-data-sharing:${profileId}`,
      `taste-trails-theme:${profileId}`,
      `taste-trails-accent:${profileId}`,
      `notification_preferences:${profileId}`,
      `user_bio:${profileId}`,
    ]
    keysToClear.forEach((k) => localStorage.removeItem(k))
    Object.keys(localStorage)
      .filter((k) => k.startsWith('dishRatings-'))
      .forEach((k) => localStorage.removeItem(k))
    logout()
  }

  const handleClearData = async () => {
    if (!confirm('Clear all your personal data and delete all posts?')) return
    try {
      const token = localStorage.getItem('access_token')
      if (token) {
        await fetch(`${API_BASE_URL}/api/posts`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
          .catch(() => {})
      }
      const keysToClear = [
        `my-rated-items:${profileId}`,
        `taste-trails-avatar:${profileId}`,
        `taste-trails-dietary:${profileId}`,
        `taste-trails-ai-suggestions:${profileId}`,
        `taste-trails-data-sharing:${profileId}`,
        `taste-trails-theme:${profileId}`,
        `taste-trails-accent:${profileId}`,
        `notification_preferences:${profileId}`,
        `user_bio:${profileId}`,
      ]
      keysToClear.forEach((k) => localStorage.removeItem(k))
      Object.keys(localStorage).filter((k) => k.startsWith('dishRatings-')).forEach((k) => localStorage.removeItem(k))
      window.dispatchEvent(new Event('postsCleared'))
      window.dispatchEvent(new Event('ratingSaved'))
      alert('All personal data cleared.')
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const toggleDietary = (key) => {
    const next = { ...dietary, [key]: !dietary[key] }
    setDietary(next)
    saveUserScopedValue('taste-trails-dietary', next, profileId)
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <div className="w-48 bg-gray-50 border-r border-gray-200 p-4 space-y-1 overflow-y-auto flex-shrink-0">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`w-full text-left py-2 px-3 rounded-lg font-medium transition flex items-center gap-2 text-sm ${
                  activeTab === key
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ── ACCOUNT ─────────────────────────────────────────── */}
            {activeTab === 'account' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">Account Settings</h3>
                  <p className="text-sm text-gray-500 mb-6">Manage your profile, credentials, and account</p>

                  {/* Avatar + name display */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                      {avatarUrl
                        ? <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
                        : <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                            {(displayName || '?').charAt(0).toUpperCase()}
                          </div>
                      }
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute bottom-0 right-0 w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center shadow-md hover:bg-orange-600 transition"
                      >
                        <Camera className="w-3.5 h-3.5 text-white" />
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{displayName || 'Your Name'}</p>
                      <p className="text-sm text-gray-500">{email}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        profile?.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {profile?.role === 'admin' ? 'Admin' : 'Member'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                    <button
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Save className="w-4 h-4" />
                      {profileSaving ? 'Saving…' : 'Save Profile'}
                    </button>
                  </div>
                </div>

                {/* Change Password */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Change Password</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Current Password',     value: currentPassword,  setter: setCurrentPassword  },
                      { label: 'New Password',         value: newPassword,      setter: setNewPassword      },
                      { label: 'Confirm New Password', value: confirmPassword,  setter: setConfirmPassword  },
                    ].map(({ label, value, setter }) => (
                      <div key={label}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                        <input
                          type={showPasswords ? 'text' : 'password'}
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
                    >
                      {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showPasswords ? 'Hide' : 'Show'} passwords
                    </button>
                    <button
                      onClick={handleChangePassword}
                      disabled={pwSaving}
                      className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition text-sm"
                    >
                      {pwSaving ? 'Updating…' : 'Update Password'}
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="border-t border-red-100 pt-6">
                  <h3 className="text-base font-semibold text-red-600 mb-3">Danger Zone</h3>
                  <div className="space-y-3">
                    <button
                      onClick={logout}
                      className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2 text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Log Out
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      className="w-full bg-red-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-600 transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account Permanently
                    </button>
                    <p className="text-xs text-gray-400 text-center">
                      Permanently deletes your profile, ratings, and all stored data
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── PRIVACY ─────────────────────────────────────────── */}
            {activeTab === 'privacy' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">Privacy</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Control who can see your profile and activity
                </p>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-gray-800 text-sm">Private Profile</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Others must send a follow request — you approve or decline them in Notifications
                    </p>
                  </div>
                  <Toggle
                    checked={privateProfile}
                    onChange={(e) => {
                      const v = e.target.checked
                      setPrivateProfile(v)
                      savePrivacySetting(v)
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── DIETARY ─────────────────────────────────────────── */}
            {activeTab === 'dietary' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">Dietary Preferences</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Select your dietary needs so TasteTrails can highlight suitable dishes and filter menus
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DIETARY_OPTIONS.map(({ key, label, emoji }) => (
                    <button
                      key={key}
                      onClick={() => toggleDietary(key)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition text-left ${
                        dietary[key]
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl leading-none">{emoji}</span>
                      <span className="font-medium text-sm">{label}</span>
                      {dietary[key] && (
                        <span className="ml-auto text-orange-500 text-xs font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  Preferences are saved locally and used to badge matching menu items
                </p>
              </div>
            )}

            {/* ── NOTIFICATIONS ───────────────────────────────────── */}
            {activeTab === 'notifications' && (
              <NotificationSettings />
            )}

            {/* ── PERSONALIZATION ─────────────────────────────────── */}
            {activeTab === 'personalization' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">Preferences</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Customize how TasteTrails tailors content for you
                  </p>
                  <div className="space-y-4">
                    {[
                      {
                        key: 'ai',
                        title: 'AI Restaurant Suggestions',
                        desc: 'Let AI recommend restaurants based on your rating history and popular dishes nearby',
                        checked: aiSuggestions,
                        onChange: (v) => { setAiSuggestions(v); saveUserScopedValue('taste-trails-ai-suggestions', v, profileId) },
                      },
                      {
                        key: 'data',
                        title: 'Personalized Feed',
                        desc: 'Use your saved ratings to surface dishes you might enjoy higher in your feed',
                        checked: dataSharing,
                        onChange: (v) => { setDataSharing(v); saveUserScopedValue('taste-trails-data-sharing', v, profileId) },
                      },
                    ].map(({ key, title, desc, checked, onChange }) => (
                      <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex-1 pr-4">
                          <p className="font-medium text-gray-800 text-sm">{title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                        </div>
                        <Toggle checked={checked} onChange={(e) => onChange(e.target.checked)} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <h4 className="font-semibold text-gray-700 mb-3 text-sm">Data Management</h4>
                  <button
                    onClick={handleClearData}
                    className="bg-red-50 text-red-600 py-2 px-4 rounded-lg font-semibold text-sm hover:bg-red-100 transition flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All Personal Data
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    Deletes saved ratings, menu cache, and preferences — your account stays active
                  </p>
                </div>
              </div>
            )}

            {/* ── APPEARANCE ──────────────────────────────────────── */}
            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">Appearance</h3>
                  <p className="text-sm text-gray-500 mb-6">Customize the look and feel of TasteTrails</p>

                  {/* Theme */}
                  <div className="mb-6">
                    <p className="font-medium text-gray-800 text-sm mb-3">Theme</p>
                    <div className="flex gap-3">
                      {[
                        { value: 'light',  label: 'Light',  emoji: '☀️' },
                        { value: 'dark',   label: 'Dark',   emoji: '🌙' },
                        { value: 'system', label: 'System', emoji: '💻' },
                      ].map(({ value, label, emoji }) => (
                        <button
                          key={value}
                          onClick={() => {
                            setTheme(value)
                            saveUserScopedValue('taste-trails-theme', value, profileId)
                            applyThemeToDocument(value)
                            window.dispatchEvent(new Event('themeChanged'))
                          }}
                          className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition ${
                            theme === value
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-2xl">{emoji}</span>
                          <span className={`text-sm font-medium ${theme === value ? 'text-orange-600' : 'text-gray-700'}`}>
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Dark mode coming soon — your preference is saved for when it launches
                    </p>
                  </div>

                  {/* Accent color */}
                  <div>
                    <p className="font-medium text-gray-800 text-sm mb-3">Accent Color</p>
                    <div className="flex gap-3">
                      {[
                        { value: 'orange', color: '#f97316', label: 'Orange' },
                        { value: 'red',    color: '#ef4444', label: 'Red'    },
                        { value: 'amber',  color: '#f59e0b', label: 'Amber'  },
                        { value: 'green',  color: '#22c55e', label: 'Green'  },
                        { value: 'blue',   color: '#3b82f6', label: 'Blue'   },
                        { value: 'purple', color: '#a855f7', label: 'Purple' },
                      ].map(({ value, color, label }) => (
                        <button
                          key={value}
                          title={label}
                          onClick={() => { setAccentColor(value); saveUserScopedValue('taste-trails-accent', value, profileId) }}
                          style={{ background: color }}
                          className={`w-9 h-9 rounded-full transition-transform ${
                            accentColor === value
                              ? 'scale-125 ring-2 ring-offset-2 ring-gray-400'
                              : 'hover:scale-110'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Full accent theming coming soon</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── ABOUT ───────────────────────────────────────────── */}
            {activeTab === 'about' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">About TasteTrails</h3>
                <p className="text-sm text-gray-500 mb-6">App info and legal</p>

                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 text-center">
                    <div className="text-5xl mb-3">🍽️</div>
                    <h4 className="text-xl font-bold text-gray-800">TasteTrails</h4>
                    <p className="text-sm text-gray-500 mt-1">Discover, Rate &amp; Share Amazing Food</p>
                    <p className="text-xs text-gray-400 mt-3">Version 1.0.0 · Built with ❤️ for food lovers</p>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: '📋 Terms of Service',  action: () => alert('Terms of Service — coming soon')  },
                      { label: '🔒 Privacy Policy',     action: () => alert('Privacy Policy — coming soon')    },
                      { label: '🐛 Report a Bug',       action: () => alert('Bug reports — coming soon')       },
                      { label: '⭐ Rate the App',       action: () => alert('Thanks for your support!')        },
                      { label: '💬 Send Feedback',      action: () => alert('Feedback form — coming soon')     },
                    ].map(({ label, action }) => (
                      <button
                        key={label}
                        onClick={action}
                        className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-sm text-gray-700 font-medium"
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <p className="text-center text-xs text-gray-400 pt-2">
                    © 2026 TasteTrails. All rights reserved.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
