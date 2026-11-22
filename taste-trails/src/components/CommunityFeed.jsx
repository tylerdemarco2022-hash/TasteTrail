import React, { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config/api'
import PostCard from './PostCard'
import { currentUser } from '../data'
import { getActiveProfileId, getPrivateProfileForUser, loadUserScopedValue } from '../utils/accountStorage'

const CURRENT_USER = 'You'
const STORAGE_KEY = 'taste-trails-groups'

function loadGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (e) {
    return []
  }
}

export default function CommunityFeed({ posts = [], onAddComment, onUserClick, onRestaurantClick }) {
  const [serverPosts, setServerPosts] = useState([])
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    fetch(`${API_BASE_URL}/api/feed`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.ok ? res.json() : { posts: [] })
      .then((data) => {
        const rows = Array.isArray(data.posts) ? data.posts : []
        setServerPosts(rows.map((post) => ({
          ...post,
          user_id: post.userId,
          user: post.user || { name: 'Diner', avatar: '' },
          caption: post.caption || post.dish
        })))
      })
      .catch(() => setServerPosts([]))
  }, [])
  const activeProfileId = getActiveProfileId()
  const scopedFollowing = loadUserScopedValue('taste-trails-following', currentUser.following || [], activeProfileId)
  const following = Array.isArray(scopedFollowing) ? scopedFollowing : []
  const followingSet = new Set(following.map((id) => String(id)))

  // Get groups user is a member of
  const groups = loadGroups()
  const myGroupIds = groups
    .filter(g => (g.members || []).includes(CURRENT_USER))
    .map(g => g.id)

  // Filter posts to show:
  // 1. Posts from people user follows
  // 2. Posts from groups user is a member of
  const localPosts = posts.filter(post => {
    const postUserId = post.userId || post.user_id
    const normalizedPostUserId = String(postUserId || '')
    const isMyOwnPost = normalizedPostUserId === String(activeProfileId) || normalizedPostUserId === String(currentUser.id)
    const isFromFollowedUser = normalizedPostUserId && followingSet.has(normalizedPostUserId)
    const authorPrivate = getPrivateProfileForUser(postUserId) === true
    if (authorPrivate && !isMyOwnPost && !isFromFollowedUser) return false

    const isFromMyGroup = post.groupId && myGroupIds.includes(Number(post.groupId))
    return isFromFollowedUser || isFromMyGroup || isMyOwnPost
  })
  const filteredPosts = [...serverPosts, ...localPosts]

  if (!filteredPosts || filteredPosts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4 pb-24">
        <div className="glass rounded-2xl p-8 shadow-lg text-center">
          <p>No posts.</p>
          <a href="#/rate" className="btn btn-primary mt-3 inline-flex">Rate</a>
        </div>
      </div>
    )
  }

  return (
    <main className="max-w-3xl w-full mx-auto p-4 pb-24 space-y-4">
      {filteredPosts.map((p) => (
        <div key={p.id}>
          <PostCard post={p} onOpen={() => {}} onComment={onAddComment} onUserClick={onUserClick} onRestaurantClick={onRestaurantClick} />
          {p.groupName && <div className="text-sm font-medium text-gray-600 mt-2 ml-4 flex items-center gap-2"><span className="text-orange-500">🏷️</span> Shared in: <span className="font-semibold">{p.groupName}</span></div>}
        </div>
      ))}
    </main>
  )
}
