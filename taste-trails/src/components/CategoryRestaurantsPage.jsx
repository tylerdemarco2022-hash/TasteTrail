import React, { useEffect, useState } from 'react';
import StarRating from './StarRating';

export default function CategoryRestaurantsPage() {
  const [category, setCategory] = useState(null);
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail && e.detail.category && Array.isArray(e.detail.restaurants)) {
        setCategory(e.detail.category);
        setRestaurants(e.detail.restaurants);
      }
    };
    window.addEventListener('navigateCategoryRestaurants', handler);
    return () => window.removeEventListener('navigateCategoryRestaurants', handler);
  }, []);

  if (!category || !Array.isArray(restaurants) || restaurants.length === 0) {
    return <div className="p-8 text-center text-gray-500">No restaurants found for this category.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">All {category} Restaurants</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {restaurants.map((r, idx) => (
          <div key={r.id || `${r.name}-${idx}`} className="bg-white rounded-xl shadow p-4 flex flex-row border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-1">{r.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  {r.cuisine && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium">{r.cuisine}</span>}
                  {r.price_level && <span className="text-green-700 font-semibold">{'$'.repeat(r.price_level)}</span>}
                  {r.distance != null && <span className="flex items-center gap-0.5">📍 {(r.distance * 0.621371).toFixed(1)} mi</span>}
                </div>
                {r.review_count > 0 && <p className="text-xs text-gray-400 mt-1">{r.review_count} reviews</p>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <StarRating value={r.avgRating || r.rating || 0} />
                <span className="text-xs text-gray-500">{Number(r.avgRating || r.rating || 0).toFixed(1)}/10</span>
              </div>
            </div>
            {/* Pictures section on the right */}
            <div className="flex flex-col items-end justify-start ml-4 min-w-[72px]">
              {r.image && (
                <img src={r.image} alt={r.name} className="w-16 h-16 object-cover rounded mb-2 border border-gray-200" />
              )}
              {/* Placeholder for more pictures in the future */}
              <div className="w-16 text-xs text-gray-400 text-center">Pictures</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
