import express from 'express';
import rateLimit from 'express-rate-limit';
import { supabase as supabaseClient } from '../../supabase.js';
const router = express.Router();
const supabase = supabaseClient;

const MIN_CREDIBILITY = 0.2;
const MAX_CREDIBILITY = 3.0;
const MIN_TRUST = 0.5;
const MAX_TRUST = 1.5;
const MIN_BOT = 0.0;
const MAX_BOT = 1.0;
const MIN_RATINGS_FOR_CRED_UPDATE = 5;
const ratingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many rating requests. Please slow down.' }
});

function ensureSupabase(res) {
  if (!supabase) {
    res.status(500).json({ error: 'Supabase not configured on this server instance.' });
    return false;
  }
  return true;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeStddev(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function computeDishTags(dish) {
  const tags = [];
  const ratingBayesian = Number(dish.rating_bayesian);
  const ratingCount = Number(dish.rating_count);
  const volatility = Number(dish.volatility_stddev);

  if (ratingBayesian >= 4.6 && ratingCount >= 40 && volatility < 0.7) {
    tags.push('👑 Elite Favorite');
  }

  if (ratingBayesian >= 4.3 && volatility < 0.6 && ratingCount >= 15) {
    tags.push('🎯 Safe Pick');
  }

  if (volatility >= 1.2 && ratingCount >= 10) {
    tags.push('⚡ Polarizing');
  }

  if (ratingBayesian < 3.0 && volatility > 1.0) {
    tags.push('🚨 Risky');
  }

  if (ratingCount >= 5 && ratingCount <= 15 && ratingBayesian >= 4.2) {
    tags.push('🆕 New & Rising');
  }

  if (Number.isFinite(dish.recent_avg) && Number.isFinite(dish.lifetime_avg)) {
    if (dish.recent_avg > dish.lifetime_avg && ratingCount >= 10) {
      tags.push('🔥 Hot');
    }
  }

  return tags;
}

async function fetchGlobalStats() {
  const { data, error } = await supabase
    .from('global_stats')
    .select('key,value_float,value_int')
    .in('key', ['global_mean_rating', 'bayes_m']);

  if (error) return { error };

  const stats = new Map();
  for (const row of data || []) {
    stats.set(row.key, row);
  }

  return { data: stats };
}

async function ensureGlobalMean() {
  const { data: globalMeanRows, error: globalMeanError } = await supabase
    .rpc('get_global_weighted_mean');

  if (globalMeanError) {
    return { error: globalMeanError };
  }

  const globalMean = Array.isArray(globalMeanRows) ? globalMeanRows[0] : globalMeanRows;
  const value = Number(globalMean);

  if (Number.isFinite(value)) {
    const { error } = await supabase
      .from('global_stats')
      .upsert({ key: 'global_mean_rating', value_float: value, updated_at: new Date().toISOString() }, { onConflict: ['key'] });
    if (error) return { error };
  }

  return { data: value };
}

// Middleware to get user from Supabase JWT
async function getUser(req, res, next) {
  if (!ensureSupabase(res)) return;
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

// 1. POST /restaurants/:restaurantId/menu-items
router.post('/restaurants/:restaurantId/menu-items', getUser, async (req, res) => {
  const { restaurantId } = req.params;
  const { name, description, price, photo_url, menu_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const { data, error } = await supabase.from('menu_items').insert({
    restaurant_id: restaurantId,
    name,
    description,
    price,
    photo_url,
    menu_id
  }).select('id,restaurant_id,name,description,price,photo_url,menu_id,rating_bayesian,rating_count,emoji_tags').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 2. GET /restaurants/:restaurantId/menu-items
router.get('/restaurants/:restaurantId/menu-items', async (req, res) => {
  const { restaurantId } = req.params;
  const { data, error } = await supabase
    .from('menu_items')
    .select('id,restaurant_id,name,description,price,photo_url,menu_id,rating_bayesian,rating_count,emoji_tags')
    .eq('restaurant_id', restaurantId);

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

// 3. POST /menu-items/:menuItemId/rate
router.post('/menu-items/:menuItemId/rate', getUser, ratingLimiter, async (req, res) => {
  const { menuItemId } = req.params;
  const { rating, comment, restaurant_id } = req.body;
  const userRating = Number(rating);
  if (!userRating || userRating < 1 || userRating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });

  const { data: existingRows, error: existingError } = await supabase
    .from('dish_ratings')
    .select('id')
    .eq('menu_item_id', menuItemId)
    .eq('user_id', req.user.id)
    .limit(1);

  if (existingError) return res.status(400).json({ error: existingError.message });

  const hadRating = Array.isArray(existingRows) && existingRows.length > 0;

  const { data, error } = await supabase.from('dish_ratings').upsert({
    menu_item_id: menuItemId,
    user_id: req.user.id,
    restaurant_id,
    rating: userRating,
    comment
  }, { onConflict: ['menu_item_id', 'user_id'] }).select().single();
  if (error) return res.status(400).json({ error: error.message });

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('credibility_score,trust_multiplier,bot_score,cluster_id,ratings_count,last_rating_at,created_at')
    .eq('id', req.user.id)
    .single();

  if (userError) return res.status(400).json({ error: userError.message });

  const now = new Date();
  const lastRatingAt = userRow?.last_rating_at ? new Date(userRow.last_rating_at) : null;
  const secondsSinceLast = lastRatingAt ? (now - lastRatingAt) / 1000 : null;

  const recentCutoff = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const { count: recentCount, error: recentError } = await supabase
    .from('dish_ratings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .gte('created_at', recentCutoff);

  if (recentError) return res.status(400).json({ error: recentError.message });

  const { data: recentRatings, error: recentRatingsError } = await supabase
    .from('dish_ratings')
    .select('rating,created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(6);

  if (recentRatingsError) return res.status(400).json({ error: recentRatingsError.message });

  const isExtreme = (value) => value <= 1.5 || value >= 4.5;
  const hasExtremeStreak = recentRatings?.length === 6 && recentRatings.every(row => isExtreme(Number(row.rating)));

  const accountCreatedAt = userRow?.created_at ? new Date(userRow.created_at) : null;
  const accountAgeDays = accountCreatedAt ? (now - accountCreatedAt) / (1000 * 60 * 60 * 24) : null;
  const isNewAccount = accountAgeDays !== null && accountAgeDays <= 7;

  let computedBot = 0;
  if (secondsSinceLast !== null && secondsSinceLast < 10) computedBot += 0.25;
  if ((recentCount || 0) >= 8) computedBot += 0.30;
  if (hasExtremeStreak) computedBot += 0.20;
  if (isNewAccount && (recentCount || 0) >= 5) computedBot += 0.15;

  computedBot = clamp(computedBot, MIN_BOT, MAX_BOT);

  const currentBot = Number.isFinite(userRow?.bot_score) ? userRow.bot_score : 0.0;
  const newBot = clamp((0.7 * currentBot) + (0.3 * computedBot), MIN_BOT, MAX_BOT);

  const { data: userSpreadRows, error: spreadError } = await supabase
    .from('dish_ratings')
    .select('rating')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (spreadError) return res.status(400).json({ error: spreadError.message });

  const spreadValues = (userSpreadRows || []).map(row => Number(row.rating)).filter(Number.isFinite);
  const ratingSpread = computeStddev(spreadValues);
  const spreadNatural = ratingSpread >= 0.5 && ratingSpread <= 1.5;

  const currentTrust = Number.isFinite(userRow?.trust_multiplier) ? userRow.trust_multiplier : 1.0;
  const ratingsCount = Number.isFinite(userRow?.ratings_count) ? userRow.ratings_count : 0;

  let trustTarget = 1.0;
  if (ratingsCount >= 20 && newBot < 0.2 && spreadNatural) trustTarget = 1.2;
  if (newBot >= 0.6) trustTarget = 0.6;
  else if (newBot >= 0.3) trustTarget = 0.8;

  const newTrust = clamp((0.8 * currentTrust) + (0.2 * trustTarget), MIN_TRUST, MAX_TRUST);

  const { data: dishStatsRows, error: statsError } = await supabase
    .rpc('get_effective_dish_stats', { dish_id: menuItemId });

  if (statsError) return res.status(400).json({ error: statsError.message });

  const dishStats = Array.isArray(dishStatsRows) ? dishStatsRows[0] : dishStatsRows;
  const ratingCount = Number(dishStats?.rating_count || 0);
  const weightedAverage = Number(dishStats?.weighted_average);
  const volatilityStddev = Number(dishStats?.volatility_stddev || 0);

  if (!Number.isFinite(weightedAverage) && ratingCount > 0) {
    return res.status(400).json({ error: 'Weighted average unavailable for dish stats.' });
  }

  const { data: globalStats, error: globalStatsError } = await fetchGlobalStats();
  if (globalStatsError) return res.status(400).json({ error: globalStatsError.message });

  const bayesRow = globalStats.get('bayes_m');
  const globalMeanRow = globalStats.get('global_mean_rating');

  const bayesM = Number.isFinite(bayesRow?.value_int) ? bayesRow.value_int : 10;
  let globalMean = Number.isFinite(globalMeanRow?.value_float) ? globalMeanRow.value_float : null;

  if (!Number.isFinite(globalMean)) {
    const { data: computedMean, error: computedMeanError } = await ensureGlobalMean();
    if (computedMeanError) return res.status(400).json({ error: computedMeanError.message });
    globalMean = computedMean;
  }

  const safeGlobalMean = Number.isFinite(globalMean) ? globalMean : (Number.isFinite(weightedAverage) ? weightedAverage : 0);
  const bayesian = ratingCount > 0
    ? ((ratingCount / (ratingCount + bayesM)) * weightedAverage) + ((bayesM / (ratingCount + bayesM)) * safeGlobalMean)
    : safeGlobalMean;

  const confidenceScore = clamp(1 - (volatilityStddev / 2), 0, 1);

  const recentWindow = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentDishRows, error: recentDishError } = await supabase
    .from('dish_ratings')
    .select('rating')
    .eq('menu_item_id', menuItemId)
    .gte('created_at', recentWindow);

  if (recentDishError) return res.status(400).json({ error: recentDishError.message });

  const recentRatingsValues = (recentDishRows || []).map(row => Number(row.rating)).filter(Number.isFinite);
  const recentAvg = recentRatingsValues.length
    ? recentRatingsValues.reduce((sum, v) => sum + v, 0) / recentRatingsValues.length
    : null;

  const emojiTags = computeDishTags({
    rating_bayesian: bayesian,
    rating_count: ratingCount,
    volatility_stddev: volatilityStddev,
    recent_avg: recentAvg,
    lifetime_avg: weightedAverage
  });

  const { error: dishUpdateError } = await supabase
    .from('menu_items')
    .update({
      rating_weighted: Number.isFinite(weightedAverage) ? weightedAverage : null,
      rating_bayesian: Number.isFinite(bayesian) ? bayesian : null,
      rating_count: ratingCount,
      volatility_stddev: Number.isFinite(volatilityStddev) ? volatilityStddev : null,
      emoji_tags: emojiTags,
      confidence_score: confidenceScore,
      last_computed_at: now.toISOString()
    })
    .eq('id', menuItemId);

  if (dishUpdateError) return res.status(400).json({ error: dishUpdateError.message });

  let referenceAverage = weightedAverage;
  if (userRow?.cluster_id !== null && userRow?.cluster_id !== undefined) {
    const { data: clusterStats, error: clusterError } = await supabase
      .from('dish_cluster_stats')
      .select('rating_weighted,rating_count')
      .eq('cluster_id', userRow.cluster_id)
      .eq('menu_item_id', menuItemId)
      .limit(1);

    if (clusterError) return res.status(400).json({ error: clusterError.message });

    const clusterRow = clusterStats && clusterStats[0];
    if (clusterRow && clusterRow.rating_count >= MIN_RATINGS_FOR_CRED_UPDATE) {
      const clusterAverage = Number(clusterRow.rating_weighted);
      if (Number.isFinite(clusterAverage)) referenceAverage = clusterAverage;
    }
  }

  let newCredibility = Number.isFinite(userRow?.credibility_score) ? userRow.credibility_score : 1.0;
  if (ratingCount >= MIN_RATINGS_FOR_CRED_UPDATE && Number.isFinite(referenceAverage)) {
    const difference = Math.abs(userRating - referenceAverage);
    if (difference < 0.5) {
      newCredibility += 0.02;
    } else {
      newCredibility -= difference * 0.03;
    }
    newCredibility = clamp(newCredibility, MIN_CREDIBILITY, MAX_CREDIBILITY);
  }

  const nextRatingsCount = ratingsCount + (hadRating ? 0 : 1);

  const { error: userUpdateError } = await supabase
    .from('users')
    .update({
      credibility_score: newCredibility,
      trust_multiplier: newTrust,
      bot_score: newBot,
      ratings_count: nextRatingsCount,
      last_rating_at: now.toISOString()
    })
    .eq('id', req.user.id);

  if (userUpdateError) return res.status(400).json({ error: userUpdateError.message });

  res.json(data);
});

// 4. GET /restaurants/:restaurantId/best-dish
router.get('/restaurants/:restaurantId/best-dish', async (req, res) => {
  const { restaurantId } = req.params;
  // Require at least 3 ratings for a dish to be considered
  const { data, error } = await supabase.rpc('best_dish_for_restaurant', { rest_id: restaurantId });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 5. GET /users/me/ratings
router.get('/users/me/ratings', getUser, async (req, res) => {
  const { data, error } = await supabase
    .from('dish_ratings')
    .select('id,menu_item_id,restaurant_id,rating,comment,created_at,menu_items(id,name,description,price,photo_url,menu_id,rating_bayesian,rating_count,emoji_tags)')
    .eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Add POST /ratings endpoint
router.post('/ratings', async (req, res) => {
  try {
    console.log('Incoming rating body:', req.body);

    const { menu_item_id, rating, user_id } = req.body;

    const result = await supabase
      .from('ratings')
      .insert([
        {
          menu_item_id,
          rating,
          user_id
        }
      ])
      .select();

    if (result.error) {
      console.error('Supabase insert error:', result.error);
      return res.status(500).json({ error: result.error.message });
    }

    console.log('Insert success:', result.data);
    return res.status(201).json(result.data);

  } catch (err) {
    console.error('Unhandled rating error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;

// GET /restaurants/:restaurantId/full-menu
router.get('/restaurants/:restaurantId/full-menu', async (req, res) => {
  const { restaurantId } = req.params;
  try {
    // Fetch menu items for the restaurant
    const { data: items, error } = await supabase
      .from('menu_items')
      .select('id,name,description,price,category,photo_url')
      .eq('restaurant_id', restaurantId);
    if (error) return res.status(400).json({ error: error.message });
    // Group items by category
    const categories = {};
    (items || []).forEach(item => {
      const cat = item.category || 'Menu';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        photo_url: item.photo_url
      });
    });
    const result = Object.entries(categories).map(([category, items]) => ({ category, items }));
    res.json({ success: true, categories: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
