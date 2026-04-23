import React from 'react'
import { View, Text, Image, Pressable } from 'react-native'
import { MapPin, Star, Clock } from 'lucide-react-native'

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80'

export default function RestaurantCard({ restaurant, onPress }) {
  const {
    name = 'Restaurant',
    cuisine = '',
    address = '',
    rating,
    review_count,
    image,
    photos,
    distance,
    price_level,
  } = restaurant

  const imageUri = (Array.isArray(photos) && photos[0]) || image || PLACEHOLDER_IMAGE
  const ratingNum = typeof rating === 'number' ? rating : parseFloat(rating)
  const priceStr = price_level ? '💲'.repeat(Math.min(price_level, 4)) : ''
  const distStr = distance != null ? `${distance.toFixed(1)} mi` : null

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl shadow-sm mb-3 overflow-hidden"
      style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
    >
      {/* Image */}
      <Image
        source={{ uri: imageUri }}
        className="w-full h-44"
        resizeMode="cover"
        defaultSource={{ uri: PLACEHOLDER_IMAGE }}
      />

      {/* Content */}
      <View className="p-3">
        <View className="flex-row items-start justify-between mb-1">
          <Text className="text-base font-bold text-gray-900 flex-1 mr-2" numberOfLines={1}>
            {name}
          </Text>
          {priceStr ? <Text className="text-xs text-gray-400">{priceStr}</Text> : null}
        </View>

        <Text className="text-sm text-gray-500 mb-2" numberOfLines={1}>
          {cuisine}
        </Text>

        <View className="flex-row items-center gap-3">
          {!isNaN(ratingNum) && ratingNum > 0 ? (
            <View className="flex-row items-center gap-1">
              <Star size={13} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-sm font-semibold text-gray-800">{ratingNum.toFixed(1)}</Text>
              {review_count ? (
                <Text className="text-xs text-gray-400">({review_count})</Text>
              ) : null}
            </View>
          ) : null}

          {distStr ? (
            <View className="flex-row items-center gap-1">
              <MapPin size={12} color="#9ca3af" />
              <Text className="text-xs text-gray-400">{distStr}</Text>
            </View>
          ) : null}

          {address ? (
            <Text className="text-xs text-gray-400 flex-1" numberOfLines={1}>
              {address}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}
