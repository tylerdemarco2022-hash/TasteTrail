import React, { useState, useEffect } from 'react'
import { UserPlus, Check, X } from 'lucide-react'

/**
 * FollowRequests Component
 * 
 * Displays incoming follow requests for private accounts (Instagram-style)
 * Shows users who have requested to follow the current user
 * Provides Accept/Decline buttons for each request
 * 
 * Used in: Notifications tab or as a dedicated Follow Requests page
 */
const FollowRequests = () => {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState({}) // Track which requests are being processed

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

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
        setRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Failed to load follow requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (requestId) => {
    try {
      setProcessing(prev => ({ ...prev, [requestId]: 'accepting' }))
      
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8081/api/follow-requests/${requestId}/accept`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        // Remove request from list after successful accept
        setRequests(prev => prev.filter(req => req.id !== requestId))
      } else {
        throw new Error('Failed to accept request')
      }
    } catch (error) {
      console.error('Error accepting request:', error)
      alert('Failed to accept request. Please try again.')
    } finally {
      setProcessing(prev => {
        const newState = { ...prev }
        delete newState[requestId]
        return newState
      })
    }
  }

  const handleDecline = async (requestId) => {
    try {
      setProcessing(prev => ({ ...prev, [requestId]: 'declining' }))
      
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8081/api/follow-requests/${requestId}/decline`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        // Remove request from list after successful decline
        setRequests(prev => prev.filter(req => req.id !== requestId))
      } else {
        throw new Error('Failed to decline request')
      }
    } catch (error) {
      console.error('Error declining request:', error)
      alert('Failed to decline request. Please try again.')
    } finally {
      setProcessing(prev => {
        const newState = { ...prev }
        delete newState[requestId]
        return newState
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-gray-400">Loading requests...</div>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <UserPlus className="w-16 h-16 text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No Follow Requests</h3>
        <p className="text-gray-400 text-sm">
          When someone requests to follow your private account, you'll see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-white mb-4">Follow Requests</h2>
      
      {requests.map((request) => (
        <div 
          key={request.id} 
          className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
        >
          <div className="flex-1">
            <div className="font-semibold text-white">
              {request.requester?.name || 'Unknown User'}
            </div>
            <div className="text-sm text-gray-400">
              @{request.requester?.user_code || 'unknown'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(request.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleAccept(request.id)}
              disabled={processing[request.id]}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              {processing[request.id] === 'accepting' ? 'Accepting...' : 'Accept'}
            </button>
            
            <button
              onClick={() => handleDecline(request.id)}
              disabled={processing[request.id]}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <X className="w-4 h-4" />
              {processing[request.id] === 'declining' ? 'Declining...' : 'Decline'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FollowRequests
