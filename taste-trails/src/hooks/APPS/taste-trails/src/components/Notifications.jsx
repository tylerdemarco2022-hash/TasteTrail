import React, { useState, useEffect } from 'react'
import { MessageCircle, Trophy, MessageSquare, UserPlus, Check, X } from 'lucide-react'

const CURRENT_USER = 'You'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [followRequests, setFollowRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [groupRequests, setGroupRequests] = useState([])
  const [loadingGroupRequests, setLoadingGroupRequests] = useState(true)

  useEffect(() => {
    loadNotifications()
      loadFollowRequests()
      loadGroupJoinRequests()
    markAllAsViewed()
  }, [])
  async function loadFollowRequests() {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setLoadingRequests(false)
        return
      }

      const response = await fetch('http://localhost:8081/api/follow-requests/incoming', {
        headers: {
          'Authorization': `Bearer ${token}`
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
        setFollowRequests(data.requests || [])
      }
    } catch (error) {
      // Silently handle missing follow_requests table
    } finally {
      setLoadingRequests(false)
    }
  }

  function loadGroupJoinRequests() {
    try {
      const groups = JSON.parse(localStorage.getItem('taste-trails-groups') || '[]')
      const mine = groups.filter(g => g.leader === CURRENT_USER)
      const requests = []
      mine.forEach(g => {
        ;(g.pendingRequests || []).forEach(u => {
          requests.push({ id: `${g.id}:${u}`, groupId: g.id, groupName: g.name, user: u })
        })
      })
      setGroupRequests(requests)
    } catch (e) {
      setGroupRequests([])
    } finally {
      setLoadingGroupRequests(false)
    }
  }

  function updateGroups(mutator) {
    try {
      const groups = JSON.parse(localStorage.getItem('taste-trails-groups') || '[]')
      const next = mutator(groups)
      localStorage.setItem('taste-trails-groups', JSON.stringify(next))
      loadGroupJoinRequests()
      window.dispatchEvent(new Event('notificationsViewed'))
    } catch (e) {}
  }

  function handleGroupRequest(action, groupId, user) {
    updateGroups((groups) => groups.map(g => {
      if (g.id !== groupId) return g
      const pending = (g.pendingRequests || []).filter(u => u !== user)
      if (action === 'accept') {
        const members = (g.members || []).includes(user) ? g.members : [...(g.members || []), user]
        return { ...g, pendingRequests: pending, members }
      }
      return { ...g, pendingRequests: pending }
    }))
  }

  async function handleFollowRequest(requestId, action) {
    try {
      const token = localStorage.getItem('token')
      const endpoint = action === 'approved' ? 'accept' : 'decline'
      const response = await fetch(`http://localhost:8081/api/follow-requests/${requestId}/${endpoint}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        // Remove the request from the list
        setFollowRequests(prev => prev.filter(req => req.id !== requestId))
        
        // Dispatch event to update header count
        window.dispatchEvent(new Event('notificationsViewed'))
      } else {
        const text = await response.text()
        console.log("RAW FETCH RESPONSE:", text.slice(0, 200))
        let data
        try {
          data = JSON.parse(text)
        } catch (e) {
          console.error("NOT JSON RESPONSE:", text.slice(0, 200))
          throw e
        }
        alert('Failed to update request: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to handle follow request:', error)
      alert('Failed to update request')
    }
  }


  function markAllAsViewed() {
    // Mark messages as read
    try {
      const messages = JSON.parse(localStorage.getItem('taste-trails-messages') || '[]')
      const updated = messages.map(m => ({ ...m, read: true }))
      localStorage.setItem('taste-trails-messages', JSON.stringify(updated))
    } catch (e) {}

    // Mark comments as read
    try {
      const comments = JSON.parse(localStorage.getItem('taste-trails-comments') || '[]')
      const updated = comments.map(c => ({ ...c, read: true }))
      localStorage.setItem('taste-trails-comments', JSON.stringify(updated))
    } catch (e) {}

    // Mark challenges as viewed
    try {
      const groups = JSON.parse(localStorage.getItem('taste-trails-groups') || '[]')
      const challenges = JSON.parse(localStorage.getItem('taste-trails-challenges') || '[]')
      const userGroups = groups.filter(g => (g.members || []).includes(CURRENT_USER))
      const challengeIds = []
      
      userGroups.forEach(group => {
        const incomplete = challenges.filter(c => 
          c.groupId === group.id && 
          !(c.completedBy || []).includes(CURRENT_USER)
        )
        incomplete.forEach(c => challengeIds.push(c.id))
      })
      
      localStorage.setItem('taste-trails-viewed-challenges', JSON.stringify(challengeIds))
    } catch (e) {}

    // Dispatch event to update header
    window.dispatchEvent(new Event('notificationsViewed'))
  }

  function loadNotifications() {
    const notifs = []

    // Check for new messages
    try {
      const messages = JSON.parse(localStorage.getItem('taste-trails-messages') || '[]')
      const unreadMessages = messages.filter(m => m.to === CURRENT_USER && !m.read)
      unreadMessages.forEach(msg => {
        notifs.push({
          id: `msg-${msg.id}`,
          type: 'message',
          title: 'New Message',
          description: `${msg.from}: ${msg.text}`,
          timestamp: msg.timestamp,
          icon: MessageCircle
        })
      })
    } catch (e) {}

    // Check for new challenges in groups
    try {
      const groups = JSON.parse(localStorage.getItem('taste-trails-groups') || '[]')
      const challenges = JSON.parse(localStorage.getItem('taste-trails-challenges') || '[]')
      const userGroups = groups.filter(g => (g.members || []).includes(CURRENT_USER))
      
      userGroups.forEach(group => {
        const groupChallenges = challenges.filter(c => c.groupId === group.id)
        const incompleteChallenges = groupChallenges.filter(c => !(c.completedBy || []).includes(CURRENT_USER))
        
        incompleteChallenges.forEach(challenge => {
          // Only show if created in last 7 days
          const createdDate = new Date(challenge.id)
          const daysSince = (Date.now() - createdDate) / (1000 * 60 * 60 * 24)
          if (daysSince < 7) {
            notifs.push({
              id: `challenge-${challenge.id}`,
              type: 'challenge',
              title: 'New Challenge',
              description: `${group.name}: ${challenge.name}`,
              timestamp: challenge.id,
              icon: Trophy
            })
          }
        })
      })
    } catch (e) {}

    // Check for comments (mock for now)
    try {
      const comments = JSON.parse(localStorage.getItem('taste-trails-comments') || '[]')
      const userComments = comments.filter(c => c.postAuthor === CURRENT_USER && !c.read)
      userComments.forEach(comment => {
        notifs.push({
          id: `comment-${comment.id}`,
          type: 'comment',
          title: 'New Comment',
          description: `${comment.author} commented: ${comment.text}`,
          timestamp: comment.timestamp,
          icon: MessageSquare
        })
      })
    } catch (e) {}

    // Sort by timestamp
    notifs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    setNotifications(notifs)
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Notifications</h2>
        <p className="text-sm text-gray-500 mt-1">Stay updated with your activity</p>
      </div>
      {/* Follow Requests Section */}
      {!loadingRequests && followRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Follow Requests
          </h3>
          <div className="space-y-2">
            {followRequests.map(request => (
              <div key={request.id} className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                    {request.requester?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold">{request.requester?.name || 'Unknown User'}</p>
                    <p className="text-sm text-gray-500">wants to follow you</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFollowRequest(request.id, 'approved')}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleFollowRequest(request.id, 'rejected')}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Join Requests Section */}
      {!loadingGroupRequests && groupRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Group Join Requests
          </h3>
          <div className="space-y-2">
            {groupRequests.map(req => (
              <div key={req.id} className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                    {req.user?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold">{req.user}</p>
                    <p className="text-sm text-gray-500">wants to join {req.groupName}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGroupRequest('accept', req.groupId, req.user)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleGroupRequest('decline', req.groupId, req.user)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Notifications List */}
        <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm">
            <p className="text-gray-500 text-lg">No notifications</p>
            <p className="text-sm text-gray-400 mt-2">You're all caught up! 🎉</p>
          </div>
        ) : (
          notifications.map(notif => {
            const Icon = notif.icon
            return (
              <div key={notif.id} className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-3">
                  <div className={`mt-1 p-2 rounded-full shrink-0 ${
                    notif.type === 'message' ? 'bg-blue-100 text-blue-600' :
                    notif.type === 'challenge' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{notif.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{notif.description}</div>
                    <div className="text-xs text-gray-400 mt-2">
                      {formatTimestamp(notif.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
