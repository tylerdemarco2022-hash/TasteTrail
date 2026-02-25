import React from 'react'
import { Home, Sparkles, Users, User } from 'lucide-react'

export default function BottomTabs({ active, setActive, onTabClick }){
    const tabs = [
    { id: 'restaurants', label: 'Restaurants', icon: Home },
    { id: 'feed', label: 'Feed', icon: Sparkles },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'profile', label: 'Profile', icon: User }
  ]

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 flex justify-center z-50 px-4 safe-area-bottom safe-area-horizontal pb-4">
      <div role="tablist" aria-label="App sections" className="glass rounded-2xl shadow-2xl px-4 py-3 flex gap-2">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              aria-label={t.label}
              onClick={() => {
                setActive(t.id);
                window.scrollTo(0, 0);
                if (onTabClick) onTabClick(t.id);
              }}
              className={`flex flex-col items-center px-4 py-2 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg scale-105'
                  : 'hover:bg-white/50'
              }`}
            >
              <Icon className={`w-6 h-6 transition-transform ${
                isActive ? 'text-white' : 'text-gray-600'
              }`} aria-hidden="true" />
              <span className={`text-xs mt-1 font-medium ${
                isActive ? 'text-white' : 'text-gray-600'
              }`}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
