import React, { useState } from 'react'
import { restaurants } from '../data'

export default function AIPick() {
  const [choice, setChoice] = useState(null)
  function pick() {
    const r = restaurants[Math.floor(Math.random() * restaurants.length)]
    setChoice(r)
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-white rounded-xl p-6 shadow-sm text-center">
        <button onClick={pick} className="px-6 py-3 bg-yellow-400 rounded-lg text-white font-semibold">Pick for me 🍽️</button>

        {choice && (
          <div className="mt-4">
            <div className="text-sm text-gray-500">We recommend:</div>
            <div className="mt-2 text-lg font-semibold">{choice}</div>
          </div>
        )}
      </div>
    </div>
  )
}
