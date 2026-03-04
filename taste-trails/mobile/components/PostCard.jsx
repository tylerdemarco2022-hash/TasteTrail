import React, { useState } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { Heart, MessageCircle, MapPin, Star } from 'lucide-react-native'

const AVATAR_COLORS = ['#f97316', '#8b5cf6', '#06b6d4', '#10b981', '#f43f5e']
function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}

function timeAgo(timestamp) {
  if (!timestamp) return ''
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function PostCard({ post, onLike, onRestaurantPress, onUserPress }) {
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentText, setCommentText] = useState('')

  const authorName = post.user?.name || post.user_name || post.author || 'User'
  const content = post.content || post.text || post.caption || ''
  const restaurant = post.restaurant || post.restaurant_name
  const rating = post.rating
  const liked = post.liked || false
  const likeCount = post.likes || post.like_count || 0
  const commentCount = post.comments?.length || post.comment_count || 0
  const color = avatarColor(authorName)

  return (
    <View className="bg-white rounded-2xl mb-3 shadow-sm overflow-hidden">
      {/* Post header */}
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <Pressable onPress={() => onUserPress?.({ id: post.user_id, name: authorName })}>
          <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: color }}>
            <Text className="text-base font-bold text-white">{authorName.charAt(0).toUpperCase()}</Text>
          </View>
        </Pressable>
        <View className="flex-1">
          <Pressable onPress={() => onUserPress?.({ id: post.user_id, name: authorName })}>
            <Text className="text-sm font-bold text-gray-900">{authorName}</Text>
          </Pressable>
          <Text className="text-xs text-gray-400">{timeAgo(post.created_at || post.timestamp)}</Text>
        </View>
        {rating && (
          <View className="flex-row items-center bg-amber-50 px-2 py-1 rounded-full">
            <Star size={12} color="#f59e0b" fill="#f59e0b" />
            <Text className="text-xs font-bold text-amber-600 ml-0.5">{rating}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      {content ? (
        <Text className="text-sm text-gray-800 px-4 pb-2 leading-relaxed">{content}</Text>
      ) : null}

      {/* Restaurant tag */}
      {restaurant ? (
        <Pressable
          onPress={() => onRestaurantPress?.({ name: restaurant })}
          className="mx-4 mb-3 flex-row items-center bg-orange-50 rounded-xl px-3 py-2 self-start"
        >
          <MapPin size={12} color="#f97316" />
          <Text className="text-xs text-orange-600 font-semibold ml-1">{restaurant}</Text>
        </Pressable>
      ) : null}

      {/* Actions */}
      <View className="flex-row items-center px-4 py-3 border-t border-gray-50">
        <Pressable onPress={onLike} className="flex-row items-center mr-4">
          <Heart size={18} color={liked ? '#f43f5e' : '#9ca3af'} fill={liked ? '#f43f5e' : 'none'} />
          {likeCount > 0 && <Text className="text-xs text-gray-500 ml-1">{likeCount}</Text>}
        </Pressable>
        <Pressable onPress={() => setShowCommentInput(!showCommentInput)} className="flex-row items-center">
          <MessageCircle size={18} color="#9ca3af" />
          {commentCount > 0 && <Text className="text-xs text-gray-500 ml-1">{commentCount}</Text>}
        </Pressable>
      </View>

      {/* Comments */}
      {showCommentInput && (
        <View className="px-4 pb-3">
          <View className="flex-row items-center bg-gray-50 rounded-xl px-3 py-2">
            <TextInput
              className="flex-1 text-sm text-gray-800"
              placeholder="Write a comment…"
              placeholderTextColor="#9ca3af"
              value={commentText}
              onChangeText={setCommentText}
            />
            <Pressable
              onPress={() => {
                if (commentText.trim()) setCommentText('')
              }}
            >
              <Text className="text-orange-500 text-sm font-semibold ml-2">Post</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}
