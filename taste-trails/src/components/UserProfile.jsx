import { API_BASE_URL } from '../config/api'
import React, { useCallback, useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import StarRating from './StarRating'
import { useAuth } from '../context/AuthContext'

const UserProfile = ({ user, onBack }) => {
  const { profile: currentUserProfile, token } = useAuth()
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('posts')
  const [peopleList, setPeopleList] = useState(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [notice, setNotice] = useState('')

  const authHeaders = useCallback(() => {
    const stored = token || localStorage.getItem('access_token')
    return stored ? { Authorization: `Bearer ${stored}` } : {}
  }, [token])

  const loadProfile = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(user.id)}/profile`, {
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to load profile (${res.status})`)
      setProfileData(data)
    } catch (e) {
      setError(e.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [user?.id, authHeaders])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const displayName = profileData?.user?.name || user?.name || 'User'
  const username = profileData?.user?.username || user?.username || ''
  const isPrivate = Boolean(profileData?.user?.is_private)
  const isFollowingUser = Boolean(profileData?.isFollowing)
  const followRequestStatus = profileData?.followRequestStatus
  const isOwnProfile = currentUserProfile?.id === user?.id
  const blocked = Boolean(profileData?.blocked)
  const canViewContent = Boolean(profileData?.canView)
  const counts = canViewContent ? profileData?.counts : null
  const posts = canViewContent ? (profileData?.posts || []) : []
  const ratings = canViewContent ? (profileData?.ratings || []) : []
  const lists = canViewContent ? (profileData?.lists || []) : []
  const activity = canViewContent ? (profileData?.activity || []) : []

  const updateFollow = async () => {
    setBusy(true)
    setNotice('')
    try {
      const removing = isFollowingUser || followRequestStatus === 'pending'
      const res = await fetch(`${API_BASE_URL}/api/users/${user.id}/follow`, {
        method: removing ? 'DELETE' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (!res.ok) {
        setNotice(data.error || 'Could not update follow')
        return
      }
      await loadProfile()
    } catch {
      setNotice('Could not update follow')
    } finally {
      setBusy(false)
    }
  }

  const fetchPeople = async (kind) => {
    const res = await fetch(`${API_BASE_URL}/api/users/${user.id}/${kind}`, { headers: authHeaders() })
    const data = await res.json()
    setPeopleList({
      kind,
      users: data.private ? [] : (Array.isArray(data.users) ? data.users : []),
      private: Boolean(data.private)
    })
  }

  const loadPeople = async (kind) => {
    if (!canViewContent) return
    if (peopleList?.kind === kind) {
      setPeopleList(null)
      return
    }
    try {
      await fetchPeople(kind)
    } catch {
      setNotice('Could not load that list')
    }
  }

  const removeFollower = async (followerId) => {
    const res = await fetch(`${API_BASE_URL}/api/users/${user.id}/followers/${followerId}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    if (res.ok) {
      await loadProfile()
      await fetchPeople('followers')
    }
  }

  const blockUser = async () => {
    if (!window.confirm(`Block ${displayName}? They will not be able to find you or request to follow.`)) return
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${user.id}/block`, {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) setNotice(data.error || 'Could not block this account')
      else setNotice('Account blocked')
      await loadProfile()
    } finally {
      setBusy(false)
    }
  }

  const submitReport = async () => {
    const reason = reportReason.trim()
    if (!reason) return
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${user.id}/report`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const data = await res.json()
      if (!res.ok) setNotice(data.error || 'Could not send report')
      else {
        setNotice('Report received')
        setReportOpen(false)
        setReportReason('')
      }
    } finally {
      setBusy(false)
    }
  }

  const followLabel = busy
    ? 'Saving...'
    : followRequestStatus === 'pending'
      ? 'Requested'
      : isFollowingUser
        ? 'Following'
        : isPrivate
          ? 'Request'
          : 'Follow'

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-900 text-xl font-semibold">← Back</button>
        <h2 className="text-lg font-bold">Profile</h2>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
            {profileData?.user?.avatar
              ? <img src={profileData.user.avatar} alt="" className="w-full h-full object-cover" />
              : displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold">{displayName}</div>
              {isPrivate && <Lock className="w-4 h-4 text-gray-500" />}
            </div>
            {username && <div className="text-sm text-gray-500">@{username}</div>}
            {isOwnProfile && currentUserProfile?.email && (
              <div className="text-sm text-gray-400">{currentUserProfile.email}</div>
            )}
          </div>
          {!isOwnProfile && !blocked && (
            <button
              onClick={updateFollow}
              disabled={busy || loading}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                followRequestStatus === 'pending' || isFollowingUser
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {followLabel}
            </button>
          )}
        </div>

        {canViewContent && counts && (
          <div className="mt-4 flex gap-6">
            <div><div className="font-semibold">{counts.posts}</div><div className="text-sm text-gray-500">Posts</div></div>
            <div><div className="font-semibold">{counts.ratings}</div><div className="text-sm text-gray-500">Rated</div></div>
            <button type="button" onClick={() => loadPeople('followers')} className="text-left">
              <div className="font-semibold">{counts.followers}</div>
              <div className="text-sm text-gray-500">Followers</div>
            </button>
            <button type="button" onClick={() => loadPeople('following')} className="text-left">
              <div className="font-semibold">{counts.following}</div>
              <div className="text-sm text-gray-500">Following</div>
            </button>
          </div>
        )}

        {!isOwnProfile && !blocked && (
          <div className="mt-3 flex gap-3 text-sm">
            <button type="button" onClick={blockUser} className="text-gray-500 hover:text-gray-800">Block</button>
            <button type="button" onClick={() => setReportOpen((open) => !open)} className="text-gray-500 hover:text-gray-800">Report</button>
          </div>
        )}

        {reportOpen && (
          <div className="mt-3 space-y-2">
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Why are you reporting this account?"
              className="w-full border border-gray-200 rounded-lg p-2 text-sm"
              rows={3}
            />
            <button type="button" onClick={submitReport} disabled={busy} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold">
              Send report
            </button>
          </div>
        )}
        {notice && <p className="mt-3 text-sm text-amber-700">{notice}</p>}
      </div>

      {peopleList && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <h3 className="font-semibold mb-2 capitalize">{peopleList.kind}</h3>
          {peopleList.private || peopleList.users.length === 0 ? (
            <p className="text-sm text-gray-500">{peopleList.private ? 'This account is private' : 'No one here yet.'}</p>
          ) : (
            <div className="space-y-2">
              {peopleList.users.map((person) => (
                <div key={person.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{person.name}</div>
                    <div className="text-xs text-gray-400">@{person.username}</div>
                  </div>
                  {isOwnProfile && peopleList.kind === 'followers' && (
                    <button type="button" onClick={() => removeFollower(person.id)} className="text-sm text-gray-600 hover:text-gray-900">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">Loading profile...</div>
      )}
      {error && (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-red-600">{error}</div>
      )}

      {!loading && !error && !canViewContent && (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-gray-300 flex items-center justify-center">
              <Lock className="w-12 h-12 text-gray-400" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">{blocked ? 'You cannot view this account.' : 'This account is private'}</h3>
          {!blocked && (
            <p className="text-gray-600 mb-4">Follow this account to see their posts, ratings, lists, and activity.</p>
          )}
          {followRequestStatus === 'pending' && (
            <p className="text-sm text-amber-600">Requested. Tap Requested to cancel.</p>
          )}
        </div>
      )}

      {canViewContent && (
        <div className="bg-white rounded-xl shadow-sm mb-4 p-1 flex gap-1">
          {['posts', 'ratings', 'lists'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors text-sm capitalize ${
                activeTab === tab ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {canViewContent && activeTab === 'posts' && (
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg">Posts</h3>
          {posts.length === 0 ? <div className="text-gray-500">No posts yet.</div> : posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-gray-100 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">{post.dish || 'Post'}</div>
                {post.rating ? <StarRating value={post.rating} /> : null}
              </div>
              {post.restaurant && <div className="text-sm text-gray-600">{post.restaurant}</div>}
              {post.caption && <div className="text-sm text-gray-700">{post.caption}</div>}
            </div>
          ))}
          {activity.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Activity</h3>
              <div className="space-y-1 text-sm text-gray-600">
                {activity.map((item) => (
                  <div key={item.id}>{item.text || item.type}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {canViewContent && activeTab === 'ratings' && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-lg mb-3">Rated Dishes</h3>
          {ratings.length === 0 ? <div className="text-gray-500">No ratings to show yet.</div> : (
            <div className="divide-y">
              {ratings.map((rating) => (
                <div key={rating.id} className="flex items-center gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{rating.dish_name || rating.dish || 'Dish'}</div>
                    <div className="text-sm text-gray-600 truncate">{rating.restaurant_name || rating.restaurant || ''}</div>
                  </div>
                  {rating.rating ? <StarRating value={Number(rating.rating) > 5 ? rating.rating : rating.rating * 2} /> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {canViewContent && activeTab === 'lists' && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-lg mb-3">Lists</h3>
          {lists.length === 0 ? <div className="text-gray-500">No lists yet.</div> : lists.map((list) => (
            <div key={list.id} className="mb-3">
              <div className="font-semibold">{list.name}</div>
              {Array.isArray(list.items) && list.items.length > 0 && (
                <div className="text-sm text-gray-600">{list.items.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean).join(', ')}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default UserProfile
