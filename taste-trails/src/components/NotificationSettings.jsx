import React, { useState, useEffect } from 'react'
import { Bell, Mail, Volume2, VolumeX, Check } from 'lucide-react'
import { API_BASE_URL } from '../config/api'

/**
 * NotificationSettings Component
 * 
 * Comprehensive notification preference management for the app.
 * Users can control:
 * - Push notifications (phone alerts)
 * - Email alerts
 * - Specific notification types (ratings, follows, trending, milestones, admin)
 * - Sound preferences
 * - Notification frequency
 * 
 * Settings are saved to backend and localStorage for offline access.
 */
export default function NotificationSettings() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  // Main toggle settings
  const [pushEnabled, setPushEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  // Specific alert types
  const [alerts, setAlerts] = useState({
    newRatings: true,        // When someone rates same restaurant/dish as you
    followRequests: true,    // When someone requests to follow (private accounts)
    trendingRestaurants: true, // When nearby restaurant gets surge in high ratings
    dishMilestones: true,    // When dish reaches community favorite status
    adminBroadcasts: true    // Announcements from admins
  })
  
  // Notification frequency (for non-urgent alerts)
  const [frequency, setFrequency] = useState('instant') // 'instant', 'daily', 'weekly'
  
  // Load saved preferences on mount
  useEffect(() => {
    loadPreferences()
  }, [])
  
  /**
   * Load notification preferences from localStorage and backend
   * Priority: Backend > localStorage > Defaults
   */
  const loadPreferences = async () => {
    try {
      // Try to load from localStorage first for instant UI update
      const stored = localStorage.getItem('notification_preferences')
      if (stored) {
        const prefs = JSON.parse(stored)
        applyPreferences(prefs)
      }
      
      // Then load from backend to sync
      const token = localStorage.getItem('access_token')
      if (token) {
        const response = await fetch(`${API_BASE_URL}/api/notification-preferences`, {
          headers: { 'Authorization': `Bearer ${token}` }
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
          applyPreferences(data)
          // Update localStorage with backend data
          localStorage.setItem('notification_preferences', JSON.stringify(data))
        }
      }
    } catch (e) {
      console.warn('Error loading notification preferences:', e)
    }
  }
  
  /**
   * Apply loaded preferences to state
   */
  const applyPreferences = (prefs) => {
    if (prefs.pushEnabled !== undefined) setPushEnabled(prefs.pushEnabled)
    if (prefs.emailEnabled !== undefined) setEmailEnabled(prefs.emailEnabled)
    if (prefs.soundEnabled !== undefined) setSoundEnabled(prefs.soundEnabled)
    if (prefs.alerts) setAlerts(prefs.alerts)
    if (prefs.frequency) setFrequency(prefs.frequency)
  }
  
  /**
   * Save notification preferences to backend and localStorage
   */
  const savePreferences = async () => {
    setSaving(true)
    setSaved(false)
    
    const preferences = {
      pushEnabled,
      emailEnabled,
      soundEnabled,
      alerts,
      frequency
    }
    
    try {
      // Save to localStorage immediately
      localStorage.setItem('notification_preferences', JSON.stringify(preferences))
      
      // Save to backend
      const token = localStorage.getItem('access_token')
      if (token) {
        const response = await fetch(`${API_BASE_URL}/api/notification-preferences`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(preferences)
        })
        
        if (response.ok) {
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        } else {
          throw new Error('Failed to save to backend')
        }
      } else {
        // Not logged in, but saved locally
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (e) {
      console.error('Error saving notification preferences:', e)
      alert('Error saving preferences. Settings saved locally only.')
    } finally {
      setSaving(false)
    }
  }
  
  /**
   * Toggle a specific alert type
   */
  const toggleAlert = (alertType) => {
    setAlerts(prev => ({
      ...prev,
      [alertType]: !prev[alertType]
    }))
  }
  
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-sm">
        {/* Header */}
        <div className="border-b p-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-500" />
            Notification Settings
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Control how and when you receive alerts from Pick Found
          </p>
        </div>
        
        <div className="p-4 space-y-6">
          {/* Main Toggles Section */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Main Settings</h3>
            
            {/* Push Notifications Toggle */}
            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="font-medium">Push Notifications</div>
                  <div className="text-sm text-gray-500">Phone alerts for app events</div>
                </div>
              </div>
              <button
                onClick={() => setPushEnabled(!pushEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  pushEnabled ? 'bg-amber-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    pushEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            {/* Email Alerts Toggle */}
            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="font-medium">Email Alerts</div>
                  <div className="text-sm text-gray-500">Password changes, account alerts, weekly updates</div>
                </div>
              </div>
              <button
                onClick={() => setEmailEnabled(!emailEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  emailEnabled ? 'bg-amber-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    emailEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            {/* Notification Sound Toggle */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-gray-600" />
                ) : (
                  <VolumeX className="w-5 h-5 text-gray-600" />
                )}
                <div>
                  <div className="font-medium">Notification Sound</div>
                  <div className="text-sm text-gray-500">Play sound for alerts</div>
                </div>
              </div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  soundEnabled ? 'bg-amber-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    soundEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          
          {/* Alert Types Section */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Alert Types</h3>
            <p className="text-sm text-gray-600 mb-3">Choose which events trigger notifications</p>
            
            {/* New Ratings Alert */}
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <div className="font-medium">New Ratings</div>
                <div className="text-sm text-gray-500">When someone rates the same restaurant or dish</div>
              </div>
              <input
                type="checkbox"
                checked={alerts.newRatings}
                onChange={() => toggleAlert('newRatings')}
                className="w-5 h-5 text-amber-500 rounded"
              />
            </div>
            
            {/* Follow Request Alert */}
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <div className="font-medium">Follow Requests</div>
                <div className="text-sm text-gray-500">When someone requests to follow your private account</div>
              </div>
              <input
                type="checkbox"
                checked={alerts.followRequests}
                onChange={() => toggleAlert('followRequests')}
                className="w-5 h-5 text-amber-500 rounded"
              />
            </div>
            
            {/* Trending Restaurant Alert */}
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <div className="font-medium">Trending Restaurants</div>
                <div className="text-sm text-gray-500">When nearby restaurants get surge in high ratings</div>
              </div>
              <input
                type="checkbox"
                checked={alerts.trendingRestaurants}
                onChange={() => toggleAlert('trendingRestaurants')}
                className="w-5 h-5 text-amber-500 rounded"
              />
            </div>
            
            {/* Dish Milestone Alert */}
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <div className="font-medium">Dish Milestones</div>
                <div className="text-sm text-gray-500">When dishes reach community favorite status</div>
              </div>
              <input
                type="checkbox"
                checked={alerts.dishMilestones}
                onChange={() => toggleAlert('dishMilestones')}
                className="w-5 h-5 text-amber-500 rounded"
              />
            </div>
            
            {/* Admin Broadcast Alert */}
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">Admin Broadcasts</div>
                <div className="text-sm text-gray-500">Announcements about menu updates, new restaurants, and notices</div>
              </div>
              <input
                type="checkbox"
                checked={alerts.adminBroadcasts}
                onChange={() => toggleAlert('adminBroadcasts')}
                className="w-5 h-5 text-amber-500 rounded"
              />
            </div>
          </div>
          
          {/* Notification Frequency Section */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Notification Frequency</h3>
            <p className="text-sm text-gray-600 mb-3">How often to receive non-urgent alerts</p>
            
            <div className="space-y-2">
              {/* Instant */}
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="frequency"
                  value="instant"
                  checked={frequency === 'instant'}
                  onChange={() => setFrequency('instant')}
                  className="w-4 h-4 text-amber-500"
                />
                <div className="flex-1">
                  <div className="font-medium">Instant</div>
                  <div className="text-sm text-gray-500">Get notified immediately</div>
                </div>
              </label>
              
              {/* Daily */}
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="frequency"
                  value="daily"
                  checked={frequency === 'daily'}
                  onChange={() => setFrequency('daily')}
                  className="w-4 h-4 text-amber-500"
                />
                <div className="flex-1">
                  <div className="font-medium">Daily</div>
                  <div className="text-sm text-gray-500">Get a daily summary at 6 PM</div>
                </div>
              </label>
              
              {/* Weekly */}
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="frequency"
                  value="weekly"
                  checked={frequency === 'weekly'}
                  onChange={() => setFrequency('weekly')}
                  className="w-4 h-4 text-amber-500"
                />
                <div className="flex-1">
                  <div className="font-medium">Weekly</div>
                  <div className="text-sm text-gray-500">Get a weekly digest every Sunday</div>
                </div>
              </label>
            </div>
          </div>
          
          {/* Save Button */}
          <div className="pt-4 border-t">
            <button
              onClick={savePreferences}
              disabled={saving}
              className="w-full py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                'Saving...'
              ) : saved ? (
                <>
                  <Check className="w-5 h-5" />
                  Saved!
                </>
              ) : (
                'Save Preferences'
              )}
            </button>
            
            {saved && (
              <p className="text-center text-sm text-green-600 mt-2">
                Your notification preferences have been saved
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
