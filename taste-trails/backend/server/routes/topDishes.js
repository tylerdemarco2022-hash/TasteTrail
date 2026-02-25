import express from 'express';
import { supabase } from '../../supabase.js';

const router = express.Router();

/**
 * GET /api/top-dishes
 * 
 * Returns the highest-rated dishes across ALL USERS for the specified time period.
 * NOT based on current user - based on community ratings.
 */
router.get('/top-dishes', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(parseInt(req.query.days) || 7, 365));
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 10, 50));
    const minRatings = Math.max(1, parseInt(req.query.minRatings) || 2);

    // Calculate date cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`📊 Fetching top dishes from last ${days} days (limit: ${limit})`);

    // Simple query: get recent ratings with menu item and restaurant info
    const { data, error } = await supabase
      .from('dish_ratings')
      .select(
        `
        rating,
        menu_item_id,
        created_at,
        menu_items!inner(
          id,
          name,
          description,
          price,
          photo_url,
          restaurant_id,
          restaurants!inner(
            id,
            name
          )
        )
      `
      )
      .gte('created_at', cutoffISO)
      .limit(1000);

    if (error) {
      console.error('❌ Error fetching ratings:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`📥 Retrieved ${data?.length || 0} recent ratings`);

    if (!data || data.length === 0) {
      return res.json({
        success: true,
        topDishes: [],
        period: `${days} days`,
        count: 0,
        message: 'No ratings found for this period'
      });
    }

    // Aggregate: group ratings by menu_item
    const dishMap = new Map();

    for (const record of data) {
      if (!record.menu_items) continue;

      const mi = record.menu_items;
      const rest = mi.restaurants || {};
      const key = mi.id; // Use menu_item ID as key

      if (!dishMap.has(key)) {
        dishMap.set(key, {
          id: mi.id,
          name: mi.name,
          description: mi.description,
          price: mi.price,
          photo: mi.photo_url,
          restaurant: {
            id: mi.restaurant_id,
            name: rest.name || 'Unknown'
          },
          ratings: [],
          ratingCount: 0
        });
      }

      const dishData = dishMap.get(key);
      dishData.ratings.push(record.rating);
      dishData.ratingCount = dishData.ratings.length;
    }

    // Calculate averages and sort
    const topDishes = Array.from(dishMap.values())
      .filter(dish => dish.ratingCount >= minRatings)
      .map(dish => {
        const ratings = dish.ratings.sort((a, b) => a - b);
        const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        
        return {
          ...dish,
          rating: parseFloat(avg.toFixed(2)),
          highest: Math.max(...ratings),
          lowest: Math.min(...ratings),
          badge: getBadge(avg, dish.ratingCount)
        };
      })
      .sort((a, b) => {
        // Sort by rating desc, then by count desc
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.ratingCount - a.ratingCount;
      })
      .slice(0, limit);

    console.log(`✅ Top ${topDishes.length} dishes calculated and returned`);

    return res.json({
      success: true,
      topDishes,
      period: `${days} days`,
      count: topDishes.length,
      minRatingsRequired: minRatings,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Top dishes endpoint error:', err);
    return res.status(500).json({ 
      error: 'Failed to fetch top dishes',
      details: err.message 
    });
  }
});

/**
 * Helper: Get badge label based on rating and count
 */
function getBadge(rating, count) {
  if (rating >= 4.7 && count >= 5) return '👑 Elite';
  if (rating >= 4.5 && count >= 3) return '🏆 Top Rated';
  if (rating >= 4.2 && count >= 2) return '⭐ Trending';
  if (count >= 10) return '📈 Popular';
  return '✨ New';
}

export default router;
