import React, { useState } from 'react'
import { X, User, Lock, Shield, Database, LogOut, Trash2, Save, Eye, EyeOff, Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import NotificationSettings from './NotificationSettings'

export default function Settings({ onClose }) {
  const { profile, logout, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('account')
  
  // Account settings state
  const [displayName, setDisplayName] = useState(profile?.name || '')
  const [email, setEmail] = useState(profile?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  
  // Privacy settings state
  const [privateProfile, setPrivateProfile] = useState(profile?.is_private || false)
  
  // Personalization settings state
  const [aiSuggestions, setAiSuggestions] = useState(true)
  const [dataSharing, setDataSharing] = useState(true)

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('http://localhost:8081/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: displayName,
          email: email,
          is_private: privateProfile
        })
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
        throw new Error(data.error || 'Failed to update profile')
      }

      // Refresh profile in auth context
      await refreshProfile()
      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Update profile error:', error)
      alert('Failed to update profile: ' + error.message)
    }
  }

  // Save privacy immediately when toggled
  const savePrivacySetting = async (value) => {
    try {
      const token = localStorage.getItem('access_token')
      console.log('Saving privacy setting:', value, 'Token:', token ? 'exists' : 'missing')
      
      const response = await fetch('http://localhost:8081/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_private: value })
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
      console.log('Privacy update response:', response.status, data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update privacy')
      }

      console.log('Setting private profile to:', !!data.profile?.is_private)
      setPrivateProfile(!!data.profile?.is_private)
      await refreshProfile()
      console.log('Privacy setting saved and refreshed')
    } catch (error) {
      console.error('Privacy update error:', error)
      alert('Failed to update privacy: ' + error.message)
    }
  }

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }
    // TODO: API call to change password
    alert('Password changed! (Connect to backend to save)')
  }

  const handleDeleteAccount = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // TODO: API call to delete account
      alert('Account deletion requested. You will be logged out.')
      logout()
    }
  }

  const handleClearData = async () => {
    const confirmed = confirm('Are you sure you want to clear your personal data and delete all your posts?')
    if (!confirmed) return

    try {
      const token = localStorage.getItem('access_token')
      if (!token) throw new Error('Not logged in')

      // Delete all posts for this account
      const response = await fetch('http://localhost:8081/api/posts', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
        throw new Error(data.error || 'Failed to clear data')
      }

      // Clear local cache and local mock data
      const keysToClear = [
        'user_profile',
        'my-rated-items',
        'savedItems',
        'taste-trails-badges',
        'taste-trails-following',
        'taste-trails-groups',
        'taste-trails-comments',
        'taste-trails-messages',
        'taste-trails-challenges',
        'taste-trails-viewed-challenges'
      ]
      keysToClear.forEach((k) => localStorage.removeItem(k))

      // Clear any dish ratings caches per restaurant
      Object.keys(localStorage)
        .filter((k) => k.startsWith('dishRatings-'))
        .forEach((k) => localStorage.removeItem(k))

      window.dispatchEvent(new Event('postsCleared'))
      window.dispatchEvent(new Event('ratingSaved'))
      alert('All your posts and personal data have been cleared.')
    } catch (error) {
      console.error('Clear data error:', error)
      alert('Could not clear data: ' + error.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-gray-50 border-r border-gray-200 p-4 space-y-1">
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full text-left py-2 px-3 rounded-lg font-medium transition flex items-center gap-2 ${
                activeTab === 'account'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <User className="w-4 h-4" />
              Account
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`w-full text-left py-2 px-3 rounded-lg font-medium transition flex items-center gap-2 ${
                activeTab === 'privacy'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Shield className="w-4 h-4" />
              Privacy
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full text-left py-2 px-3 rounded-lg font-medium transition flex items-center gap-2 ${
                activeTab === 'notifications'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Bell className="w-4 h-4" />
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('personalization')}
              className={`w-full text-left py-2 px-3 rounded-lg font-medium transition flex items-center gap-2 ${
                activeTab === 'personalization'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Database className="w-4 h-4" />
              Personalization
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Settings</h3>
                  <p className="text-sm text-gray-600 mb-6">Manage your account details, security, and preferences</p>
                  
                  {/* Profile Avatar */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Profile Picture</p>
                      <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                        Change Avatar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Type
                      </label>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          profile?.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {profile?.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveProfile}
                      className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-orange-600 transition flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Profile Changes
                    </button>
                  </div>
                </div>

                {/* Change Password Section */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <button
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showPasswords ? 'Hide' : 'Show'} Passwords
                    </button>

                    <button
                      onClick={handleChangePassword}
                      className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-orange-600 transition"
                    >
                      Update Password
                    </button>
                  </div>
                </div>

                {/* Account Actions */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Actions</h3>
                  
                  <div className="space-y-3">
                    <button
                      onClick={logout}
                      className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>

                    <button
                      onClick={handleDeleteAccount}
                      className="w-full bg-red-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-600 transition flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </button>
                    <p className="text-xs text-gray-500 text-center">
                      Deletes your profile, ratings, and stored preferences permanently
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Privacy Settings</h3>
                  <p className="text-sm text-gray-600 mb-6">Control who can see your profile. When your profile is private, people need to request to follow you and you can approve or decline their requests in the notifications tab.</p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">Make My Profile Private</p>
                        <p className="text-sm text-gray-500">Requires approval for others to view your profile, posts, and ratings</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privateProfile}
                          onChange={(e) => {
                            const val = e.target.checked
                            setPrivateProfile(val)
                            savePrivacySetting(val)
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <NotificationSettings />
              </div>
            )}

            {/* Personalization Tab */}
            {activeTab === 'personalization' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Personalization</h3>
                  <p className="text-sm text-gray-600 mb-6">Customize your TasteTrails experience with AI and data preferences</p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">Allow Restaurant Suggestions from AI</p>
                        <p className="text-sm text-gray-500">Enables AI to recommend restaurants based on popularity and user ratings</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiSuggestions}
                          onChange={(e) => setAiSuggestions(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">Allow Data Sharing for Personalization</p>
                        <p className="text-sm text-gray-500">Lets the app use your saved ratings to personalize your feed</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dataSharing}
                          onChange={(e) => setDataSharing(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Management</h3>
                  
                  <button
                    onClick={handleClearData}
                    className="w-full max-w-xs bg-red-100 text-red-600 py-2 px-3 rounded-md font-semibold text-sm hover:bg-red-200 transition flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Personal Data
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Deletes saved preferences, menu cache, and ratings (does not delete the account)
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
