import React, { useState } from 'react'
import StarRating from './StarRating'
import { useAuth } from '../context/AuthContext'

export default function PostCard({ post, onOpen, onComment, onEdit, onDelete, onUserClick, onRestaurantClick }) {
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const { profile } = useAuth()

  const postUserId = post.user_id || post.userId
  const isOwner = !!profile && (postUserId === profile.id || post?.user?.name === 'You')

  const handleCommentSubmit = (e) => {
    e.preventDefault()
    if (newComment.trim() && onComment) {
      onComment(post.id, newComment.trim())
      setNewComment('')
    }
  }

  const handleUserClick = () => {
    if (onUserClick && post.user) {
      onUserClick(post.user)
    }
  }

  const displayComments = post.comments || []
  const commentCount = post.commentCount || displayComments.length

  return (
    <div className="card-hover glass rounded-2xl shadow-lg overflow-hidden">
      <div className="p-5">
        <div 
          onClick={handleUserClick}
          className="flex items-center gap-3 cursor-pointer group mb-2"
        >
          <div className="w-12 h-12 rounded-full overflow-hidden shadow-md ring-2 ring-white group-hover:ring-orange-500 transition-all">
            <img src={post.user.avatar} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <div className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
            {post.user.name}
          </div>
        </div>
        <div>
          <div 
            onClick={(e) => {
              if (onRestaurantClick) onRestaurantClick(post)
            }}
            className="text-sm font-medium text-gray-700 hover:text-orange-600 hover:underline cursor-pointer transition-colors mb-1"
          >
            {post.restaurant}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>🍴</span> {post.dish}
          </div>
        </div>
      </div>
        {isOwner && (
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-xl glass hover:bg-white/50 text-gray-700 shadow-md"
              aria-label="Post actions"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-36 glass rounded-xl shadow-2xl border border-white/30 overflow-hidden z-10">
                {onEdit && (
                  <button
                    className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-white/50 transition-all"
                    onClick={() => { setMenuOpen(false); onEdit(post) }}
                  >
                    ✏️ Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
                    onClick={() => { setMenuOpen(false); onDelete(post) }}
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      <button onClick={() => onOpen(post)} className="block w-full focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-inset transition-all">
        <img src={post.image} alt={post.dish} className="w-full h-72 object-cover" />
      </button>

      <div className="p-5">
        <div className="mb-3 text-gray-800">{post.caption}</div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200/50">
          <StarRating value={post.rating} />
          <button 
            onClick={() => setShowComments(!showComments)}
            className="text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-orange-50"
          >
            💬 {commentCount} comment{commentCount !== 1 ? 's' : ''}
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="pt-3 space-y-3">
            {/* Display Comments */}
            {displayComments.length > 0 && (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {displayComments.map((comment, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden shadow-md ring-2 ring-white flex-shrink-0">
                      <img src={comment.userAvatar} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 glass rounded-xl p-3 shadow-md">
                      <div className="font-bold text-sm text-gray-900">{comment.userName}</div>
                      <div className="text-sm text-gray-700 mt-1">{comment.text}</div>
                      <div className="text-xs text-gray-500 mt-2">{comment.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Comment Form */}
            {onComment && (
              <form onSubmit={handleCommentSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-5 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl text-sm font-bold hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  Post
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
