import React, { useState } from 'react'
import {
  View, Text, Pressable, ScrollView
} from 'react-native'
import { ChefHat, Sparkles, Heart, Flame } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'


const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: '🥬 Vegetarian' },
  { id: 'vegan', label: '🌱 Vegan' },
  { id: 'gluten_free', label: '🌾 Gluten-Free' },
  { id: 'dairy_free', label: '🥛 Dairy-Free' },
  { id: 'keto', label: '🥩 Keto' },
  { id: 'halal', label: '🌙 Halal' },
  { id: 'kosher', label: '✡️ Kosher' },
  { id: 'none', label: '🍽️ No Restrictions' }
]

const FEATURED = [
  { name: 'Culinary Dropout', cuisine: 'American', rating: 4.8, reviews: 24 },
  { name: 'Figtree', cuisine: 'Italian', rating: 4.9, reviews: 18 },
  { name: "Dean's Steakhouse", cuisine: 'Steakhouse', rating: 4.7, reviews: 15 }
]

export default function OnboardingScreen({ navigation, onComplete }) {
  const [step, setStep] = useState(1)
  const [selectedDiets, setSelectedDiets] = useState(new Set())

  function toggleDiet(id) {
    setSelectedDiets(prev => {
      const next = new Set(prev)
      if (id === 'none') return new Set(['none'])
      if (next.has('none')) next.delete('none')
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function saveDietaryPreferences() {
    const diets = Array.from(selectedDiets)
    await AsyncStorage.setItem('dietary_preferences', JSON.stringify(diets))
    setStep(3)
  }

  async function completeOnboarding() {
    await AsyncStorage.setItem('onboarding_completed', 'true')
    await AsyncStorage.setItem('onboarding_completed_date', new Date().toISOString())
    onComplete?.()
  }

  if (step === 1) {
    return (
      <View className="flex-1 bg-orange-50 items-center justify-center px-6">
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-4 shadow-lg">
            <ChefHat size={40} color="#d97706" />
          </View>
          <Text className="text-4xl font-black text-gray-900 mb-2">TasteTrails</Text>
          <Text className="text-lg text-gray-600">Discover Your Next Favorite Dish</Text>
        </View>

        <View className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 mb-6">
          <View className="gap-4 mb-6">
            <View className="flex-row items-start gap-3">
              <Sparkles size={20} color="#f59e0b" />
              <View className="flex-1 ml-2">
                <Text className="font-semibold text-gray-900">Rate Every Dish</Text>
                <Text className="text-sm text-gray-600">Share your foodie opinions on thousands of menu items</Text>
              </View>
            </View>
            <View className="flex-row items-start gap-3">
              <Flame size={20} color="#ef4444" />
              <View className="flex-1 ml-2">
                <Text className="font-semibold text-gray-900">Find Top-Rated Items</Text>
                <Text className="text-sm text-gray-600">See what other food lovers are raving about</Text>
              </View>
            </View>
            <View className="flex-row items-start gap-3">
              <Heart size={20} color="#ec4899" />
              <View className="flex-1 ml-2">
                <Text className="font-semibold text-gray-900">Curated for You</Text>
                <Text className="text-sm text-gray-600">Get personalized recommendations based on your preferences</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => setStep(2)}
            className="bg-orange-500 rounded-xl py-3.5 items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-white font-bold text-base">Let's Get Started</Text>
          </Pressable>
        </View>

        <Text className="text-xs text-gray-500 text-center">
          Join 100+ food lovers exploring restaurants in Charlotte
        </Text>
      </View>
    )
  }

  if (step === 2) {
    return (
      <ScrollView className="flex-1 bg-green-50" contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text className="text-3xl font-black text-gray-900 mb-2 text-center">Your Preferences</Text>
        <Text className="text-gray-600 mb-8 text-center">Help us personalize your experience</Text>

        <View className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 mb-4">
          <View className="flex-row flex-wrap gap-3 mb-6">
            {DIETARY_OPTIONS.map(option => {
              const selected = selectedDiets.has(option.id)
              return (
                <Pressable
                  key={option.id}
                  onPress={() => toggleDiet(option.id)}
                  style={{ width: '47%' }}
                  className={`p-3 rounded-xl border-2 items-center ${selected ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <Text className={`font-semibold text-sm ${selected ? 'text-orange-700' : 'text-gray-600'}`}>
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setStep(1)}
              className="flex-1 py-3 rounded-xl border-2 border-gray-300 items-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-gray-700 font-bold">Back</Text>
            </Pressable>
            <Pressable
              onPress={saveDietaryPreferences}
              disabled={selectedDiets.size === 0}
              className={`flex-1 py-3 rounded-xl items-center ${selectedDiets.size === 0 ? 'bg-gray-200' : 'bg-orange-500'}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className={`font-bold ${selectedDiets.size === 0 ? 'text-gray-400' : 'text-white'}`}>Continue</Text>
            </Pressable>
          </View>
        </View>

        <Text className="text-xs text-gray-500 text-center">You can change this later in Settings</Text>
      </ScrollView>
    )
  }

  return (
    <ScrollView className="flex-1 bg-purple-50" contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text className="text-3xl font-black text-gray-900 mb-2 text-center">Popular Restaurants</Text>
      <Text className="text-gray-600 mb-8 text-center">Start exploring top-rated dishes</Text>

      <View className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
        {FEATURED.map((r, idx) => (
          <View key={idx} className={`p-4 flex-row items-center justify-between ${idx < 2 ? 'border-b border-gray-100' : ''}`}>
            <View>
              <Text className="font-bold text-gray-900">{r.name}</Text>
              <Text className="text-sm text-gray-500">{r.cuisine}</Text>
            </View>
            <View className="items-end">
              <View className="flex-row items-center gap-1 mb-0.5">
                <Text className="text-lg font-bold text-amber-500">★</Text>
                <Text className="font-bold text-gray-900">{r.rating}</Text>
              </View>
              <Text className="text-xs text-gray-400">{r.reviews} reviews</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="w-full max-w-sm bg-purple-100 rounded-2xl p-5 mb-6 border border-purple-200">
        <Text className="font-bold text-gray-900 mb-1">Ready to start rating? 🎉</Text>
        <Text className="text-sm text-gray-700">Your reviews help other food lovers discover amazing dishes.</Text>
      </View>

      <Pressable
        onPress={completeOnboarding}
        className="w-full max-w-sm bg-purple-500 rounded-xl py-3.5 items-center"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Text className="text-white font-bold text-base">Start Exploring</Text>
      </Pressable>

      <Text className="text-xs text-gray-500 mt-4 text-center">You can browse restaurants and menus anytime</Text>
    </ScrollView>
  )
}
