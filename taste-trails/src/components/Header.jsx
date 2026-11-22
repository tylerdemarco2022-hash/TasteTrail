import React, { useState, useEffect } from 'react'
import { Bell, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'

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
                const response = await fetch(`${API_BASE_URL}/api/follow-requests`, {
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
                  const requestList = Array.isArray(followRequests)
                    ? followRequests
                    : (followRequests?.requests || followRequests?.followRequests || [])
                  count += requestList.length
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
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <p className="font-display text-lg text-[var(--ink)]">{title || 'TasteTrails'}</p>
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setNotificationCount(0)
              onNotificationsClick()
            }}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink)]"
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="Account"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex h-11 w-11 items-center justify-center"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-semibold text-[var(--brand-deep)]">
                {profile?.name?.charAt(0)?.toUpperCase() || 'T'}
              </span>
            </button>

            {showProfileMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="surface absolute right-0 z-50 mt-2 w-64 overflow-hidden py-1">
                  <div className="border-b border-[var(--line)] px-4 py-3">
                    <p className="font-semibold text-[var(--ink)]">{profile?.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--mute)]">{profile?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSettingsClick()
                      setShowProfileMenu(false)
                    }}
                    className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm text-[var(--ink)]"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      setShowProfileMenu(false)
                    }}
                    className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm text-red-700"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
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
