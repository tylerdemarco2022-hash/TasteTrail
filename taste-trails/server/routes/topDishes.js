import express from 'express';
import { supabase } from '../../backend/supabase.js';

const router = express.Router();

/**
 * GET /api/top-dishes
 * 
 * Returns the highest-rated dishes across ALL USERS for the specified time period.
 * NOT based on current user - based on community ratings.
 * 
 * Query params:
 * - days: Number of days to look back (default 7)
 * - limit: Max results to return (default 10)
 * - minRatings: Minimum number of ratings required (default 2)
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

    console.log(`📊 [Top Dishes] Fetching from last ${days} days (limit: ${limit}, minRatings: ${minRatings})`);

    // Query ratings directly - get all recent ratings using dish_id
    const { data: ratings, error } = await supabase
      .from('ratings')
      .select('rating, dish_id, created_at')
      .gte('created_at', cutoffISO)
      .limit(5000);

    if (error) {
      console.error('❌ [Top Dishes] Error fetching ratings:', error);
      return res.status(500).json({ error: 'Failed to fetch ratings: ' + error.message });
    }

    console.log(`📥 [Top Dishes] Retrieved ${ratings?.length || 0} recent ratings`);

    if (!ratings || ratings.length === 0) {
      return res.json({
        success: true,
        topDishes: [],
        period: `${days} days`,
        count: 0,
        message: 'No ratings found for this period'
      });
    }

    // Get unique dish IDs
    const dishIds = [...new Set(ratings.map(r => r.dish_id))];
    console.log(`📁 [Top Dishes] Found ${dishIds.length} unique dishes`);

    if (dishIds.length === 0) {
      return res.json({
        success: true,
        topDishes: [],
        period: `${days} days`,
        count: 0
      });
    }

    // Fetch menu items and restaurants
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, description, price, photo_url, restaurant_id')
      .in('id', dishIds);

    if (menuError) {
      console.error('❌ [Top Dishes] Error fetching menu items:', menuError);
      return res.status(500).json({ error: 'Failed to fetch menu items' });
    }

    // Fetch restaurants
    const restaurantIds = [...new Set(menuItems.map(m => m.restaurant_id))];
    const { data: restaurants, error: restError } = await supabase
      .from('restaurants')
      .select('id, name')
      .in('id', restaurantIds);

    if (restError) {
      console.error('❌ [Top Dishes] Error fetching restaurants:', restError);
    }

    // Build lookup maps
    const restMap = {};
    restaurants?.forEach(r => { restMap[r.id] = r.name; });
    const miMap = {};
    menuItems?.forEach(m => { miMap[m.id] = m; });

    // Aggregate ratings by dish
    const dishMap = new Map();
    for (const rating of ratings) {
      const mi = miMap[rating.dish_id];
      if (!mi) continue; // Skip if menu item not found

      const key = mi.id;
      if (!dishMap.has(key)) {
        dishMap.set(key, {
          id: mi.id,
          name: mi.name,
          description: mi.description,
          price: mi.price,
          photo: mi.photo_url,
          restaurant: {
            id: mi.restaurant_id,
            name: restMap[mi.restaurant_id] || 'Unknown'
          },
          ratings: [],
          ratingCount: 0
        });
      }

      const dishData = dishMap.get(key);
      dishData.ratings.push(rating.rating);
      dishData.ratingCount = dishData.ratings.length;
    }

    // Calculate averages and format
    const topDishes = Array.from(dishMap.values())
      .filter(dish => dish.ratingCount >= minRatings)
      .map(dish => {
        const ratingArray = dish.ratings.sort((a, b) => a - b);
        const avg = ratingArray.reduce((a, b) => a + b, 0) / ratingArray.length;
        
        return {
          ...dish,
          rating: parseFloat(avg.toFixed(2)),
          highest: Math.max(...ratingArray),
          lowest: Math.min(...ratingArray),
          badge: getBadge(avg, dish.ratingCount)
        };
      })
      .sort((a, b) => {
        // Sort by rating desc, then by count desc
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.ratingCount - a.ratingCount;
      })
      .slice(0, limit);

    console.log(`✅ [Top Dishes] Returning top ${topDishes.length} dishes`);

    return res.json({
      success: true,
      topDishes,
      period: `${days} days`,
      count: topDishes.length,
      minRatingsRequired: minRatings,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ [Top Dishes] Endpoint error:', err);
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
