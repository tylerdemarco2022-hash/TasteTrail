import React, { useState, useEffect } from 'react'
import { Send, Heart, Search, LogOut, User, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const CURRENT_USER = 'You'

export default function Header({ title, onNotificationsClick, onSearchClick, onSettingsClick }) {
  const { profile, logout } = useAuth()
  const [notificationCount, setNotificationCount] = useState(0)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  useEffect(() => {
    const checkNotifications = async () => {
      let count = 0

      // Check messages
      try {
        const messages = JSON.parse(localStorage.getItem('taste-trails-messages') || '[]')
        count += messages.filter(m => m.to === CURRENT_USER && !m.read).length
      } catch (e) {}

      // Check challenges
      try {
        const groups = JSON.parse(localStorage.getItem('taste-trails-groups') || '[]')
        const challenges = JSON.parse(localStorage.getItem('taste-trails-challenges') || '[]')
        const viewedChallenges = JSON.parse(localStorage.getItem('taste-trails-viewed-challenges') || '[]')
        const userGroups = groups.filter(g => (g.members || []).includes(CURRENT_USER))
        userGroups.forEach(group => {
          const incomplete = challenges.filter(c => 
            c.groupId === group.id && 
            !(c.completedBy || []).includes(CURRENT_USER) &&
            !viewedChallenges.includes(c.id)
          )
          count += incomplete.length
        })
        // Pending group requests for leaders
        const myLedGroups = groups.filter(g => g.leader === CURRENT_USER)
        myLedGroups.forEach(g => {
          count += (g.pendingRequests || []).length
        })
      } catch (e) {}

      // Check comments
      try {
        const comments = JSON.parse(localStorage.getItem('taste-trails-comments') || '[]')
        count += comments.filter(c => c.postAuthor === CURRENT_USER && !c.read).length
            // Check follow requests
            try {
              const token = localStorage.getItem('access_token')
              if (token) {
                const response = await fetch('http://localhost:8081/api/follow-requests', {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                })
                if (response.ok) {
                  const text = await response.text()
                  console.log("RAW FETCH RESPONSE:", text.slice(0, 200))
                  let followRequests
                  try {
                    followRequests = JSON.parse(text)
                  } catch (e) {
                    console.error("NOT JSON RESPONSE:", text.slice(0, 200))
                    throw e
                  }
                  count += (Array.isArray(followRequests) ? followRequests.length : 0)
                }
              }
            } catch (e) {
              // Silently handle missing follow_requests table
            }

      } catch (e) {}

      setNotificationCount(count)
    }

    checkNotifications()
    const interval = setInterval(checkNotifications, 5000)
    
    // Listen for notifications viewed event
    const handleNotificationsViewed = () => checkNotifications()
    window.addEventListener('notificationsViewed', handleNotificationsViewed)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('notificationsViewed', handleNotificationsViewed)
    }
  }, [])

  return (
    <header className="px-4 py-4 bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 shadow-lg">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <button 
          onClick={() => {
            setNotificationCount(0) // Immediately clear badge
            onNotificationsClick()
          }} 
          className="p-2 glass hover:bg-white/30 rounded-xl relative transition-all"
        >
          <Heart className={`h-6 w-6 text-white ${notificationCount > 0 ? 'fill-white' : ''}`} />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-gradient-to-br from-red-600 to-red-700 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg animate-pulse">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>
        
        <div className="flex items-center gap-2">
          {onSearchClick && (
            <div className="relative hidden sm:block">
              <input
                type="text"
                readOnly
                onFocus={onSearchClick}
                onClick={onSearchClick}
                placeholder="Search for restaurants, people, groups, or cities..."
                className="w-72 px-4 py-2 pr-10 rounded-xl bg-white/90 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/70"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                <Search className="h-4 w-4" />
              </div>
            </div>
          )}
          
          {/* User Profile Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-2 glass hover:bg-white/30 rounded-xl transition-all"
            >
              <div className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md">
                <span className="bg-gradient-to-br from-orange-600 to-red-600 bg-clip-text text-transparent text-sm font-bold">
                  {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            </button>

            {showProfileMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 mt-3 w-64 glass rounded-2xl shadow-2xl border border-white/30 py-2 z-50 overflow-hidden">
                  <div className="px-4 py-4 border-b border-gray-200/50">
                    <p className="text-base font-bold text-gray-900">{profile?.name}</p>
                    <p className="text-xs text-gray-600 mt-1">{profile?.email}</p>
                    {profile?.role === 'admin' && (
                      <span className="inline-block mt-2 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-semibold rounded-full shadow-md">
                        ✨ Admin
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      onSettingsClick()
                      setShowProfileMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-white/50 flex items-center gap-3 transition-all"
                  >
                    <Settings className="w-5 h-5 text-gray-600" />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      logout()
                      setShowProfileMenu(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-all"
                  >
                    <LogOut className="w-5 h-5 text-red-500" />
                    Log Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
