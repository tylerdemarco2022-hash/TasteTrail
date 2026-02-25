import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';

/**
 * TopDishes Component
 * 
 * Displays the highest-rated dishes from the past week based on ALL community ratings.
 * NOT personalized - shows what the entire community thinks is best.
 */
const TopDishes = ({ days = 7, limit = 10 }) => {
  const [topDishes, setTopDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTopDishes();
  }, [days, limit]);

  const fetchTopDishes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/top-dishes?days=${days}&limit=${limit}&minRatings=2`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch top dishes: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 Top Dishes loaded:', data);
      setTopDishes(data.topDishes || []);
    } catch (err) {
      console.error('Error fetching top dishes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          🔥 Top Dishes This Week
        </h2>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-gray-500 mt-2">Finding the best dishes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-red-500">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          🔥 Top Dishes This Week
        </h2>
        <p className="text-red-600">Error loading top dishes: {error}</p>
        <button
          onClick={fetchTopDishes}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!topDishes || topDishes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          🔥 Top Dishes This Week
        </h2>
        <p className="text-gray-500 text-center py-8">
          No ratings yet this week. Rate some dishes to get started! ⭐
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          🔥 Top Dishes This Week
        </h2>
        <p className="text-sm text-gray-500">
          Based on {topDishes.length} of the highest-rated community dishes
        </p>
      </div>

      {/* Horizontal scrollable list */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-min">
          {topDishes.map((dish, index) => (
            <DishCard key={`${dish.id}-${index}`} dish={dish} rank={index + 1} />
          ))}
        </div>
      </div>

      {/* Stats footer */}
      <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-600">
        <p>
          📊 Community ratings from the past {days} day{days !== 1 ? 's' : ''}
          · Updated automatically
        </p>
      </div>
    </div>
  );
};

/**
 * Individual Dish Card Component
 */
const DishCard = ({ dish, rank }) => {
  return (
    <div className="flex-shrink-0 w-72 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition cursor-pointer border border-blue-100">
      {/* Header with rank */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
              #{rank} Most Rated
            </span>
            <h3 className="text-lg font-bold mt-1">{dish.name}</h3>
          </div>
          <span className="text-2xl">{getRankEmoji(rank)}</span>
        </div>
      </div>

      {/* Image */}
      {dish.photo && (
        <div className="w-full h-40 bg-gray-200 overflow-hidden">
          <img
            src={dish.photo}
            alt={dish.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Restaurant */}
        <p className="text-sm font-semibold text-gray-700 mb-2 truncate">
          📍 {dish.restaurant.name}
        </p>

        {/* Rating Section */}
        <div className="bg-white rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-blue-600">
                {dish.rating}
              </span>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={
                      i < Math.round(dish.rating)
                        ? 'text-yellow-400'
                        : 'text-gray-300'
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
              {dish.ratingCount} {dish.ratingCount === 1 ? 'rating' : 'ratings'}
            </span>
          </div>

          {/* Range */}
          <div className="flex justify-between text-xs text-gray-600 mt-2">
            <span>Lowest: {dish.lowest} ⬇️</span>
            <span>Highest: {dish.highest} ⬆️</span>
          </div>
        </div>

        {/* Badge */}
        <div className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
          {dish.badge}
        </div>

        {/* Price */}
        {dish.price && (
          <div className="mt-3 text-sm font-semibold text-gray-700">
            💰 {dish.price}
          </div>
        )}

        {/* Description */}
        {dish.description && (
          <p className="text-xs text-gray-600 mt-3 line-clamp-2">
            {dish.description}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Helper: Get emoji for rank position
 */
function getRankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank <= 5) return '⭐';
  if (rank <= 10) return '✨';
  return '🍽️';
}

export default TopDishes;
