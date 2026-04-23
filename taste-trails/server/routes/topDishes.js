import express from 'express';
import { supabase } from '../../backend/supabase.js';
import { getAlgorithmConfig } from './adminConfig.js';

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

    console.log(`📊 [Top Dishes] Fetching from last ${days} days (limit: ${limit}, minRatings: ${minRatings})`);

    // Step 1: Get all recent ratings — use menu_item_uuid (UUID-based column)
    const { data: ratings, error: ratingsError } = await supabase
      .from('dish_ratings')
      .select('rating, menu_item_uuid, created_at')
      .not('menu_item_uuid', 'is', null)
      .gte('created_at', cutoffISO)
      .limit(5000);

    if (ratingsError) {
      console.error('❌ [Top Dishes] Error fetching dish_ratings:', ratingsError);
      return res.status(500).json({ error: ratingsError.message });
    }

    console.log(`📥 [Top Dishes] Retrieved ${ratings?.length || 0} recent ratings from dish_ratings`);

    if (!ratings || ratings.length === 0) {
      return res.json({
        success: true,
        topDishes: [],
        period: `${days} days`,
        count: 0,
        message: 'No ratings found for this period'
      });
    }

    // Step 2: Get unique menu item UUIDs
    const itemIds = [...new Set(ratings.map(r => r.menu_item_uuid).filter(Boolean))];

    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, description, price, photo_url, restaurant_id')
      .in('id', itemIds);

    if (menuError) {
      console.error('❌ [Top Dishes] Error fetching menu items:', menuError);
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
      const mi = miMap[rating.menu_item_uuid];
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

    console.log(`📊 [Top Dishes] Aggregated into ${dishMap.size} dishes`);

    // Step 5: Calculate averages and rank using algorithm config weights
    const algo = getAlgorithmConfig();
    const rW = (algo.ratingWeight ?? 70) / 100;
    const recW = (algo.recencyWeight ?? 20) / 100;
    const popW = (algo.popularityWeight ?? 10) / 100;
    const now = Date.now();

    const allDishes = Array.from(dishMap.values()).filter(dish => dish.ratingCount >= minRatings);
    const maxCount = Math.max(...allDishes.map(d => d.ratingCount), 1);

    const topDishes = allDishes
      .map(dish => {
        const ratingArray = dish.ratings.map(r => r.value ?? r).sort((a, b) => a - b);
        const avg = ratingArray.reduce((a, b) => a + b, 0) / ratingArray.length;

        // Recency score: weighted average of how recent each rating is (0-1)
        const recencyScore = dish.ratings.reduce((sum, r) => {
          const age = now - new Date(r.created_at || now).getTime();
          const maxAge = days * 24 * 60 * 60 * 1000;
          return sum + Math.max(0, 1 - age / maxAge);
        }, 0) / dish.ratingCount;

        // Popularity score: normalized count
        const popularityScore = dish.ratingCount / maxCount;

        // Rating score: normalized 0-5 → 0-1
        const ratingScore = avg / 5;

        // Bayesian smoothing: pull toward global mean (3.0) when few ratings
        const globalMean = 3.0;
        const m = 5; // prior weight
        const bayesianAvg = algo.bayesianSmoothing
          ? (dish.ratingCount * avg + m * globalMean) / (dish.ratingCount + m)
          : avg;

        // Weighted score
        let score = rW * (bayesianAvg / 5) + recW * recencyScore + popW * popularityScore;

        // Feature boosts
        if (algo.trendingBoost && recencyScore > 0.7) score *= 1.15;
        if (algo.newDishBoost && dish.ratingCount <= 3) score *= 1.10;

        return {
          ...dish,
          rating: parseFloat(avg.toFixed(2)),
          highest: Math.max(...ratingArray),
          lowest: Math.min(...ratingArray),
          badge: getBadge(avg, dish.ratingCount),
          _score: score,
        };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(d => { delete d._score; return d; });

    // Clean up the ratings arrays before sending
    topDishes.forEach(d => { delete d.ratings; });

    console.log(`✅ [Top Dishes] Returning top ${topDishes.length} dishes`);
    topDishes.forEach((d, i) => {
      console.log(`   ${i + 1}. "${d.name}" at ${d.restaurant?.name || '?'} - ${d.rating}/5 (n=${d.ratingCount})`);
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
