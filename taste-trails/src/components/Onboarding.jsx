import React, { useState } from 'react'
import { ChefHat, Sparkles, Heart, Flame } from 'lucide-react'

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1)
  const [selectedDiets, setSelectedDiets] = useState(new Set())

  const DIETARY_OPTIONS = [
    { id: 'vegetarian', label: '🥬 Vegetarian', color: 'bg-green-100 border-green-300' },
    { id: 'vegan', label: '🌱 Vegan', color: 'bg-green-100 border-green-300' },
    { id: 'gluten_free', label: '🌾 Gluten-Free', color: 'bg-amber-100 border-amber-300' },
    { id: 'dairy_free', label: '🥛 Dairy-Free', color: 'bg-blue-100 border-blue-300' },
    { id: 'keto', label: '🥩 Keto', color: 'bg-red-100 border-red-300' },
    { id: 'halal', label: '🌙 Halal', color: 'bg-purple-100 border-purple-300' },
    { id: 'kosher', label: '✡️ Kosher', color: 'bg-indigo-100 border-indigo-300' },
    { id: 'none', label: '🍽️ No Restrictions', color: 'bg-gray-100 border-gray-300' }
  ]

  const toggleDiet = (id) => {
    if (id === 'none') {
      setSelectedDiets(new Set(['none']))
    } else {
      setSelectedDiets(prev => {
        const next = new Set(prev)
        if (next.has('none')) next.delete('none')
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    }
  }

  const saveDietaryPreferences = () => {
    const diets = Array.from(selectedDiets)
    localStorage.setItem('dietary_preferences', JSON.stringify(diets))
    setStep(3)
  }

  const completeOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true')
    localStorage.setItem('onboarding_completed_date', new Date().toISOString())
    localStorage.removeItem('is_new_signup') // Clear new signup flag
    console.log('✅ Onboarding completed! Stored dietary preferences:', Array.from(selectedDiets))
    onComplete?.()
  }

  // Step 1: Welcome Screen
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center px-4">
        <div className="max-w-md">
          {/* Logo/Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg mb-4">
              <ChefHat size={40} className="text-amber-600" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 mb-2">TasteTrails</h1>
            <p className="text-lg text-gray-600">Discover Your Next Favorite Dish</p>
          </div>

          {/* Value Proposition */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <Sparkles className="text-amber-500 flex-shrink-0 mt-1" size={20} />
                <div>
                  <h3 className="font-semibold text-gray-900">Rate Every Dish</h3>
                  <p className="text-sm text-gray-600">Share your foodie opinions on thousands of menu items</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Flame className="text-red-500 flex-shrink-0 mt-1" size={20} />
                <div>
                  <h3 className="font-semibold text-gray-900">Find Top-Rated Items</h3>
                  <p className="text-sm text-gray-600">See what other food lovers are raving about</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Heart className="text-pink-500 flex-shrink-0 mt-1" size={20} />
                <div>
                  <h3 className="font-semibold text-gray-900">Curated for You</h3>
                  <p className="text-sm text-gray-600">Get personalized recommendations based on your preferences</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
            >
              Let's Get Started
            </button>
          </div>

          {/* Trust Signal */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Join 100+ food lovers exploring restaurants in Charlotte
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Dietary Preferences
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-2">Your Preferences</h2>
            <p className="text-gray-600">Help us personalize your experience</p>
          </div>

          {/* Dietary Options */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="grid grid-cols-2 gap-3 mb-6">
              {DIETARY_OPTIONS.map(option => (
                <button
                  key={option.id}
                  onClick={() => toggleDiet(option.id)}
                  className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all cursor-pointer ${
                    selectedDiets.has(option.id)
                      ? `${option.color} border-opacity-100 ring-2 ring-offset-2 ring-amber-500 scale-105`
                      : `${option.color} opacity-60 border-opacity-50`
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-all"
              >
                Back
              </button>
              <button
                onClick={saveDietaryPreferences}
                disabled={selectedDiets.size === 0}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                  selectedDiets.size === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                }`}
              >
                Continue
              </button>
            </div>
          </div>

          <p className="text-xs text-center text-gray-500">
            Don't worry, you can change this later in Settings
          </p>
        </div>
      </div>
    )
  }

  // Step 3: Featured Restaurants
  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-2">Popular Restaurants</h2>
            <p className="text-gray-600">Start exploring top-rated dishes</p>
          </div>

          {/* Restaurant Cards */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
            {[
              { name: 'Culinary Dropout', cuisine: 'American', rating: 4.8, reviews: 24 },
              { name: 'Figtree', cuisine: 'Italian', rating: 4.9, reviews: 18 },
              { name: 'Dean\'s Steakhouse', cuisine: 'Steakhouse', rating: 4.7, reviews: 15 }
            ].map((restaurant, idx) => (
              <div key={idx} className={`p-4 flex items-center justify-between ${idx < 2 ? 'border-b border-gray-200' : ''}`}>
                <div>
                  <h3 className="font-bold text-gray-900">{restaurant.name}</h3>
                  <p className="text-sm text-gray-600">{restaurant.cuisine}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-lg font-bold text-amber-500">★</span>
                    <span className="font-bold text-gray-900">{restaurant.rating}</span>
                  </div>
                  <p className="text-xs text-gray-500">{restaurant.reviews} reviews</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6 mb-6 border border-purple-200">
            <h3 className="font-bold text-gray-900 mb-2">Ready to start rating? 🎉</h3>
            <p className="text-sm text-gray-700 mb-4">Your reviews help other food lovers discover amazing dishes.</p>
          </div>

          {/* Button */}
          <button
            onClick={completeOnboarding}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
          >
            Start Exploring
          </button>

          <p className="text-xs text-center text-gray-500 mt-4">
            You can browse restaurants and menus anytime
          </p>
        </div>
      </div>
    )
  }
}
