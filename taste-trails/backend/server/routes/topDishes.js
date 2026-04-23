import express from 'express';
import { supabase } from '../../supabase.js';

const router = express.Router();

/**
 * GET /api/top-dishes
 *
 * Returns the highest-rated dishes across ALL USERS for the specified time period.
 * Queries dish_ratings table (the primary rating store) joined with menu_items for names.
 */
router.get('/top-dishes', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(parseInt(req.query.days) || 7, 365));
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 10, 50));
    const minRatings = Math.max(1, parseInt(req.query.minRatings) || 1);

    // Calculate date cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`[TOPDISHES:P1] Fetching from last ${days} days (limit: ${limit}, minRatings: ${minRatings})`);

    // Step 1: Get all recent ratings from dish_ratings (the primary ratings table)
    const { data: ratings, error: ratingsError } = await supabase
      .from('dish_ratings')
      .select('rating, menu_item_id, created_at')
      .gte('created_at', cutoffISO)
      .limit(5000);

    if (ratingsError) {
      console.error('[ERROR:TOPDISHES:FETCH] Error fetching dish_ratings:', ratingsError);
      return res.status(500).json({ error: ratingsError.message });
    }

    console.log(`[TOPDISHES:P2] Retrieved ${ratings?.length || 0} recent ratings from dish_ratings`);

    if (!ratings || ratings.length === 0) {
      return res.json({
        success: true,
        topDishes: [],
        period: `${days} days`,
        count: 0,
        message: 'No ratings found for this period'
      });
    }

    // Step 2: Get unique menu item IDs and fetch their details
    // Filter to valid UUIDs only — ratings with non-UUID dish IDs (e.g. "1") will be skipped
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const itemIds = [...new Set(ratings.map(r => r.menu_item_id))].filter(id => UUID_RE.test(id));

    if (itemIds.length === 0) {
      console.log('[TOPDISHES:P2] No valid UUID menu_item_ids found in ratings');
      return res.json({
        success: true,
        topDishes: [],
        period: `${days} days`,
        count: 0,
        message: 'No valid dish ratings found for this period'
      });
    }

    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, description, price, photo_url, restaurant_id')
      .in('id', itemIds);

    if (menuError) {
      console.error('[ERROR:TOPDISHES:ITEMS] Error fetching menu items:', menuError);
      return res.status(500).json({ error: 'Failed to fetch menu items' });
    }

    // Step 3: Fetch restaurants
    const restaurantIds = [...new Set((menuItems || []).map(m => m.restaurant_id).filter(Boolean))];
    let restMap = {};

    if (restaurantIds.length > 0) {
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name')
        .in('id', restaurantIds);

      if (restaurants) {
        for (const r of restaurants) {
          restMap[r.id] = r;
        }
      }
    }

    // Build menu item lookup
    const miMap = {};
    (menuItems || []).forEach(m => { miMap[m.id] = m; });

    // Step 4: Aggregate ratings by menu_item_id
    const dishMap = new Map();

    for (const rating of ratings) {
      const mi = miMap[rating.menu_item_id];
      if (!mi) continue;

      if (!dishMap.has(mi.id)) {
        dishMap.set(mi.id, {
          id: mi.id,
          name: mi.name,
          description: mi.description,
          price: mi.price,
          photo: mi.photo_url,
          restaurant: restMap[mi.restaurant_id] || { name: 'Unknown' },
          ratings: [],
          ratingCount: 0
        });
      }

      const entry = dishMap.get(mi.id);
      entry.ratings.push(rating.rating);
      entry.ratingCount = entry.ratings.length;
    }

    console.log(`[TOPDISHES:P3] Aggregated ${ratings.length} ratings into ${dishMap.size} dishes`);

    // Step 5: Calculate averages and rank
    const topDishes = Array.from(dishMap.values())
      .filter(dish => dish.ratingCount >= minRatings)
      .map(dish => {
        const ratingArray = dish.ratings.sort((a, b) => a - b);
        const avg = ratingArray.reduce((a, b) => a + b, 0) / ratingArray.length;

        return {
          ...dish,
          rating: parseFloat(avg.toFixed(2)),
          highest: parseFloat(Math.max(...ratingArray).toFixed(2)),
          lowest: parseFloat(Math.min(...ratingArray).toFixed(2)),
          badge: getBadge(avg, dish.ratingCount)
        };
      })
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.ratingCount - a.ratingCount;
      })
      .slice(0, limit);

    // Clean up the ratings arrays before sending
    topDishes.forEach(d => { delete d.ratings; });

    console.log(`[TOPDISHES:OK] RETURNING ${topDishes.length} DISHES (after filter and sort)`);
    topDishes.forEach((d, i) => {
      console.log(`[TOPDISHES:ITEM] ${i+1}. "${d.name}" at ${d.restaurant?.name || '?'} - ${d.rating}/5 (n=${d.ratingCount})`);
    });

    return res.json({
      success: true,
      topDishes,
      period: `${days} days`,
      count: topDishes.length,
      minRatingsRequired: minRatings,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[ERROR:TOPDISHES:FATAL] Top dishes endpoint error:', err);
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
