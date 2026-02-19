import React from 'react'
import PostCard from './PostCard'
import { currentUser } from '../data'

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
  // Get groups user is a member of
  const groups = loadGroups()
  const myGroupIds = groups
    .filter(g => (g.members || []).includes(CURRENT_USER))
    .map(g => g.id)

  // Filter posts to show:
  // 1. Posts from people user follows
  // 2. Posts from groups user is a member of
  const filteredPosts = posts.filter(post => {
    const isFromFollowedUser = post.userId && currentUser.following.includes(post.userId)
    const isFromMyGroup = post.groupId && myGroupIds.includes(Number(post.groupId))
    const isMyOwnPost = post.userId === currentUser.id
    return isFromFollowedUser || isFromMyGroup || isMyOwnPost
  })

  if (!filteredPosts || filteredPosts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4 pb-24">
        <div className="glass rounded-2xl p-8 shadow-lg text-center">
          <div className="text-6xl mb-4">👥</div>
          <div className="text-gray-900 font-bold text-lg mb-2">No posts yet.</div>
          <div className="text-sm text-gray-600">
            Follow people and join groups to see their food adventures here!
          </div>
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
