import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { supabase as supabaseClient } from '../../supabase.js';
import { classifyDietaryFlags } from '../../utils/dietaryClassifier.js';
import { filterProfanity, hasProfanity } from '../../utils/profanityFilter.js';
import { logger } from '../../utils/logger.js';
// import { isRestaurantHealthy, getIntegrityDetails } from '../index.js';
import { integrityCache } from '../../utils/integrityCache.js';
import { validateAdminKey } from '../../utils/constantTimeCompare.js';
import { MENU_TYPES_ARRAY, normalizeMenuType, DEFAULT_MENU_TYPE } from '../../constants/menuTypes.js';
import { addScrapeJob } from '../../../server/workers/queueSetup.js';

const router = express.Router();
const supabase = supabaseClient;

const MIN_CREDIBILITY = 0.2;
const MAX_CREDIBILITY = 3.0;
const MIN_TRUST = 0.5;
const MAX_TRUST = 1.5;
const MIN_BOT = 0.0;
const MAX_BOT = 1.0;
const MIN_RATINGS_FOR_CRED_UPDATE = 5;
const DIET_FLAG_PARAM_MAP = Object.freeze({
  vegan: 'is_vegan',
  vegetarian: 'is_vegetarian',
  gluten_free: 'is_gluten_free',
  dairy_free: 'is_dairy_free',
  nut_free: 'is_nut_free',
  shellfish_free: 'is_shellfish_free',
  egg_free: 'is_egg_free',
  keto: 'is_keto',
  paleo: 'is_paleo',
  halal: 'is_halal',
  kosher: 'is_kosher'
});
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

function normalizeDietParam(value = '') {
  return String(value || '').trim().toLowerCase().replace(/-/g, '_');
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
  const { name, description, price, photo_url, menu_id, ingredients, category } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const dietaryFlags = classifyDietaryFlags({
    name,
    description,
    ingredients
  });
  
  // EXPLICIT section_name persistence (never rely on DB default)
  const sectionName = category?.trim() || 'Uncategorized';
  if (!category?.trim()) {
    logger.warn({
      message: 'Backend persistence warning: Missing category for menu item',
      itemName: name,
      restaurantId,
      action: 'defaulting to Uncategorized'
    });
  }
  
  const { data, error } = await supabase.from('menu_items').insert({
    restaurant_id: restaurantId,
    name,
    description,
    price,
    photo_url,
    menu_id,
    section_name: sectionName,
    ...dietaryFlags
  }).select(
    'id,restaurant_id,name,description,price,photo_url,menu_id,rating_bayesian,rating_count,emoji_tags,' +
    'is_vegan,is_vegetarian,is_gluten_free,is_dairy_free,is_nut_free,is_shellfish_free,is_egg_free,is_keto,is_paleo,is_halal,is_kosher,dietary_confidence_score,dietary_manual_override'
  ).single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 2. GET /restaurants/:restaurantId/menu-items
// DB-FIRST: Never live-scrape on user request. Query Supabase, return if sufficient,
// otherwise enqueue a background scrape job and return menuPending.
// Supports ?type=breakfast|lunch|dinner|drinks (defaults to dinner)
router.get('/restaurants/:restaurantId/menu-items', async (req, res) => {
  const { restaurantId } = req.params;
  const menuType = normalizeMenuType(req.query.type || DEFAULT_MENU_TYPE);
  const requestId = req.requestId || 'unknown';
  const DB_FIRST_THRESHOLD = 8;

  const timings = {
    t_total_start: Date.now(),
    t_menu_query_db_ms: 0,
    t_total_ms: 0
  };

  try {
    // STEP 1: Query menu items from DB (always first, never scrape inline)
    const menuQueryStart = Date.now();
    const { data, error } = await supabase
      .from('menu_items')
      .select(
        'id,restaurant_id,name,description,price,photo_url,menu_id,menu_type,section_name,rating_bayesian,rating_count,emoji_tags,' +
        'is_vegan,is_vegetarian,is_gluten_free,is_dairy_free,is_nut_free,is_shellfish_free,is_egg_free,is_keto,is_paleo,is_halal,is_kosher,dietary_confidence_score,dietary_manual_override'
      )
      .eq('restaurant_id', restaurantId)
      .eq('menu_type', menuType);
    timings.t_menu_query_db_ms = Date.now() - menuQueryStart;

    if (error) {
      timings.t_total_ms = Date.now() - timings.t_total_start;
      logger.error({ event: 'menu_query_error', requestId, restaurantId, error: error.message, timings });
      return res.status(400).json({ error: error.message, requestId });
    }

    const items = data || [];
    timings.t_total_ms = Date.now() - timings.t_total_start;

    // STEP 2: If we have enough items, return immediately
    if (items.length >= DB_FIRST_THRESHOLD) {
      if (timings.t_total_ms > 1000) {
        logger.warn({ event: 'slow_menu_request', requestId, restaurantId, timings, threshold_ms: 1000 });
      }
      return res.json({ data: items, requestId });
    }

    // STEP 3: Not enough items — enqueue background scrape, do NOT scrape inline
    // Look up restaurant name for the scrape job
    const { data: restRow } = await supabase
      .from('restaurants')
      .select('name, menu_status')
      .eq('id', restaurantId)
      .single();

    const restaurantName = restRow?.name || restaurantId;
    const alreadyScraping = restRow?.menu_status === 'in_progress';

    // If this restaurant has an image-based menu, return menuUnavailable
    if (restRow?.menu_status === 'image_menu') {
      return res.json({
        data: items,
        menuUnavailable: true,
        reason: 'Image-based menu',
        requestId
      });
    }

    if (!alreadyScraping) {
      try {
        await addScrapeJob({
          restaurantId,
          restaurantName,
          jobType: items.length === 0 ? 'initial_scrape' : 'low_confidence_retry'
        });
        logger.info({
          event: 'scrape_enqueued',
          requestId,
          restaurantId,
          restaurantName,
          existingItems: items.length,
          jobType: items.length === 0 ? 'initial_scrape' : 'low_confidence_retry'
        });
      } catch (enqueueErr) {
        logger.error({ event: 'scrape_enqueue_failed', requestId, restaurantId, error: enqueueErr.message });
      }
    }

    // Return whatever we have (could be 0-7 items) plus menuPending flag
    return res.json({
      data: items,
      menuPending: true,
      message: items.length === 0
        ? 'Menu is being scraped in the background. Please check back shortly.'
        : `Only ${items.length} items found. A background scrape has been enqueued.`,
      requestId
    });
  } catch (err) {
    timings.t_total_ms = Date.now() - timings.t_total_start;
    logger.error({
      message: 'Error in GET /restaurants/:restaurantId/menu-items',
      requestId, restaurantId, error: err.message, stack: err.stack, timings
    });
    return res.status(500).json({ error: 'Internal server error', requestId });
  }
});

// 3. POST /menu-items/:menuItemId/rate
router.post('/menu-items/:menuItemId/rate', getUser, ratingLimiter, async (req, res) => {
  const { menuItemId } = req.params;
  const { rating, comment, restaurant_id } = req.body;
  const userRating = Number(rating);
  if (!userRating || userRating < 1 || userRating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });

  const rawComment = typeof comment === 'string' ? comment.trim() : '';
  const sanitizedComment = rawComment ? filterProfanity(rawComment) : null;
  const commentHadProfanity = rawComment ? hasProfanity(rawComment) : false;

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
    comment: sanitizedComment
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

  res.json({
    ...data,
    profanity_filtered: commentHadProfanity
  });
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

// Add POST /ratings endpoint (saves to community ratings table)
router.post('/ratings', async (req, res) => {
  try {
    const { dish_id, rating, comment, dish_name, restaurant_name } = req.body;
    let { user_id } = req.body;

    // Always resolve the real UUID from the Bearer token — never trust client-provided user_id
    // because local/test accounts (e.g. admin-user-001) have non-UUID ids that Postgres rejects
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const bearerToken = req.headers['authorization']?.replace('Bearer ', '').trim();
    if (bearerToken) {
      try {
        const { data: { user } } = await supabase.auth.getUser(bearerToken);
        if (user?.id) user_id = user.id;
      } catch (_) {}
    }

    console.log(`[RATING] dish_id=${dish_id}, user_id=${user_id}, rating=${rating}, dish_name=${dish_name}`);

    if (!dish_id || !rating) {
      return res.status(400).json({ error: 'Missing required fields: dish_id, rating' });
    }
    if (!user_id) {
      return res.status(401).json({ error: 'Authentication required to save ratings' });
    }
    // If user_id isn't a UUID (e.g. local test account "admin-user-001"), derive a stable UUID from it
    if (!UUID_RE.test(user_id)) {
      const hash = crypto.createHash('sha256').update(user_id).digest('hex');
      user_id = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
      console.log(`[RATING] Converted non-UUID user_id to stable UUID: ${user_id}`);
    }

    // Accept 1-5 star ratings directly from mobile
    const ratingAsNumber = Number(rating);
    const scaledRating = Math.min(5, Math.max(1, ratingAsNumber));

    console.log(`[RATING:SCALE] received ${ratingAsNumber} -> stored ${scaledRating}/5`);
    let menuItemId = dish_id;
    let restaurantId = null;
    let foundExisting = false;

    // Only query by dish_id if it's a valid UUID (avoids Postgres type errors)
    if (UUID_RE.test(dish_id)) {
      const { data: existingItem } = await supabase
        .from('menu_items')
        .select('id, restaurant_id')
        .eq('id', dish_id)
        .limit(1);

      if (existingItem && existingItem.length > 0) {
        menuItemId = existingItem[0].id;
        restaurantId = existingItem[0].restaurant_id;
        foundExisting = true;
        console.log(`[RATING:OK] Found existing menu item: ${menuItemId}`);
      }
    } else {
      console.log(`[RATING:SKIP] dish_id "${dish_id}" is not a valid UUID, will resolve by name`);
    }

    if (!foundExisting && dish_name && restaurant_name) {
      // dish_id doesn't match a menu_item — look up or create by name
      console.log(`[RATING:RESOLVE] dish_id not in menu_items, looking up by name: "${dish_name}" at "${restaurant_name}"`);

      // Find or create restaurant
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id')
        .ilike('name', restaurant_name)
        .limit(1);

      if (restaurants && restaurants.length > 0) {
        restaurantId = restaurants[0].id;
      } else {
        const { data: newRest, error: newRestError } = await supabase
          .from('restaurants')
          .insert([{ name: restaurant_name }])
          .select();
        if (!newRestError && newRest?.[0]) {
          restaurantId = newRest[0].id;
          console.log(`[RATING:CREATE] Created restaurant: ${restaurantId}`);
        }
      }

      if (restaurantId) {
        // Look up existing menu item by name + restaurant
        const { data: foundItems } = await supabase
          .from('menu_items')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .ilike('name', dish_name)
          .limit(1);

        if (foundItems && foundItems.length > 0) {
          menuItemId = foundItems[0].id;
          console.log(`[RATING:OK] Found menu item by name: ${menuItemId}`);
        } else {
          // Create menu item with explicit section_name
          const sectionName = 'Uncategorized'; // User-rated items have no known section
          console.warn(
            `⚠️ Backend Persistence Warning: ` +
            `Creating user-rated item "${dish_name}" at "${restaurant_name}" with section_name=Uncategorized`
          );
          
          const { data: newItem, error: newItemError } = await supabase
            .from('menu_items')
            .insert([{
              name: dish_name,
              restaurant_id: restaurantId,
              description: comment || 'User-rated item',
              section_name: sectionName
            }])
            .select();

          if (!newItemError && newItem?.[0]) {
            menuItemId = newItem[0].id;
            console.log(`[RATING:CREATE] Created menu item: ${menuItemId}`);
          } else {
            console.error('[ERROR:RATING:ITEM] Failed to create menu item:', newItemError);
            return res.status(500).json({ error: 'Could not create dish entry' });
          }
        }
      } else {
        console.error('[ERROR:RATING] Could not resolve restaurant');
        return res.status(500).json({ error: 'Could not resolve restaurant' });
      }
    } else {
      console.error('[ERROR:RATING] dish_id not found in menu_items and no dish_name/restaurant_name provided');
      return res.status(400).json({ error: 'Dish not found. Provide dish_name and restaurant_name for new dishes.' });
    }

    // Check if user already rated this dish — update if so, insert if not
    const { data: existingRating } = await supabase
      .from('dish_ratings')
      .select('id')
      .eq('menu_item_uuid', menuItemId)
      .eq('user_id', user_id)
      .limit(1);

    let insertedRating, insertError;
    if (existingRating && existingRating.length > 0) {
      const { data, error } = await supabase
        .from('dish_ratings')
        .update({ rating: scaledRating, comment: comment || null })
        .eq('id', existingRating[0].id)
        .select()
        .single();
      insertedRating = data; insertError = error;
    } else {
      const { data, error } = await supabase
        .from('dish_ratings')
        .insert({
          menu_item_uuid: menuItemId,
          restaurant_uuid: restaurantId,
          menu_item_id: 0,      // legacy INTEGER NOT NULL stub (actual ref is menu_item_uuid)
          restaurant_id: 0,     // legacy INTEGER NOT NULL stub (actual ref is restaurant_uuid)
          user_id,
          rating: scaledRating,
          comment: comment || null
        })
        .select()
        .single();
      insertedRating = data; insertError = error;
    }

    if (insertError) {
      console.error('[ERROR:RATING:INSERT] dish_ratings insert error:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    console.log(`[RATING:SAVED] Saved to dish_ratings: id=${insertedRating?.id}, menu_item=${menuItemId}, rating=${scaledRating}`);

    return res.status(201).json({
      success: true,
      rating: insertedRating,
      message: 'Rating saved successfully'
    });

  } catch (err) {
    console.error('[ERROR:RATING:UNHANDLED] Unhandled exception:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/menu-search - Look up dish ID by restaurant and dish name
router.get('/menu-search', async (req, res) => {
  try {
    const { restaurant, dish } = req.query;
    
    if (!restaurant || !dish) {
      return res.status(400).json({ 
        error: 'Missing required query parameters: restaurant, dish' 
      });
    }

    console.log(`[SEARCH:MENU] Looking for dish="${dish}" in restaurant="${restaurant}"`);

    // Get restaurant ID by name first
    const { data: restaurants, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name')
      .ilike('name', `%${restaurant}%`)
      .limit(1);

    if (restaurantError) {
      console.error('[ERROR:SEARCH:RESTAURANT] Error finding restaurant:', restaurantError);
      return res.status(500).json({ error: restaurantError.message });
    }

    if (!restaurants || restaurants.length === 0) {
      console.log(`[SEARCH:NOTFOUND] No restaurant found matching "${restaurant}"`);
      return res.json({ 
        success: false,
        message: `No restaurant found matching "${restaurant}"`,
        menu_items: [] 
      });
    }

    const restaurantId = restaurants[0].id;
    console.log(`[SEARCH:OK] Found restaurant: ${restaurants[0].name} (ID: ${restaurantId})`);

    // Now find menu items for this restaurant by dish name
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, description, price, category, photo_url')
      .eq('restaurant_id', restaurantId)
      .ilike('name', `%${dish}%`)
      .limit(10);

    if (menuError) {
      console.error('[ERROR:SEARCH:ITEMS] Error finding menu items:', menuError);
      return res.status(500).json({ error: menuError.message });
    }

    console.log(`[SEARCH:OK] Found ${menuItems?.length || 0} matching dishes`);

    return res.json({
      success: true,
      restaurant: restaurants[0],
      menu_items: menuItems || [],
      query: { restaurant, dish }
    });

  } catch (err) {
    console.error('[ERROR:SEARCH:UNHANDLED] Unhandled error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// DEBUG: GET all ratings from past 7 days
router.get('/ratings-debug', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();

    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .gte('created_at', cutoffISO)
      .limit(100);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      success: true,
      count: data?.length || 0,
      days_lookback: days,
      cutoff_date: cutoffISO,
      ratings: data || [],
      message: `Found ${data?.length || 0} ratings in the past ${days} days`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /restaurants/:restaurantId/full-menu
// Supports ?type=breakfast|lunch|dinner|drinks (defaults to dinner)
router.get('/restaurants/:restaurantId/full-menu', async (req, res) => {
  const { restaurantId } = req.params;
  const menuType = normalizeMenuType(req.query.type || DEFAULT_MENU_TYPE);
  try {
    const requestedDiet = normalizeDietParam(req.query?.diet || '');
    const dietFlagColumn = requestedDiet ? DIET_FLAG_PARAM_MAP[requestedDiet] : null;
    if (requestedDiet && !dietFlagColumn) {
      return res.status(400).json({
        error: 'Invalid diet filter',
        allowed_diets: Object.keys(DIET_FLAG_PARAM_MAP)
      });
    }

    // Fetch menu items for the restaurant
    let query = supabase
      .from('menu_items')
      .select('id,name,description,price,category,section_name,photo_url,restaurant_id,menu_type')
      .eq('restaurant_id', restaurantId)
      .eq('menu_type', menuType);

    // Note: dietary filtering disabled - columns don't exist in schema
    // if (dietFlagColumn) {
    //   query = query.eq(dietFlagColumn, true);
    // }

    const { data: items, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    
    // Group items: prefer section_name, fall back to category, then 'Menu'
    const sections = {};
    (items || []).forEach(item => {
      // PRIORITY: section_name > category > 'Menu'
      const sectionName = item.section_name || item.category || 'Menu';
      
      if (!sections[sectionName]) {
        sections[sectionName] = [];
      }
      sections[sectionName].push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        photo_url: item.photo_url,
        category: item.category,
        section_name: item.section_name,
        restaurant_id: item.restaurant_id
      });
    });
    
    // Return as both 'sections' and 'categories' for compatibility
    const result = Object.entries(sections).map(([name, items]) => ({ 
      name,
      category: name,
      items 
    }));
    
    res.json({ 
      success: true, 
      sections: result,
      categories: result,
      applied_diet_filter: requestedDiet || null 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DEBUG ENDPOINT: GET /api/debug/menu-sections/:restaurant
// Verifies menu section breakdown for quality assurance
// Supports ?type=breakfast|lunch|dinner|drinks (shows all types if not specified)
// SECURITY: Development only OR requires admin API key
router.get('/debug/menu-sections/:restaurant', async (req, res) => {
  const menuType = normalizeMenuType(req.query.type || DEFAULT_MENU_TYPE);
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = !isProduction;
  const adminApiKey = process.env.ADMIN_API_KEY || process.env.ADMIN_TOKEN;
  const providedKey = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  // Access control: dev only or admin key required
  if (isProduction && (!adminApiKey || !validateAdminKey(providedKey, adminApiKey))) {
    logger.warn({
      event: 'unauthorized_debug_endpoint_access',
      endpoint: '/debug/menu-sections',
      ip: req.ip,
      userAgent: req.headers['user-agent']
      // DO NOT log the key for security
    });
    
    // Return 404 in production to avoid endpoint discovery
    return res.status(isProduction ? 404 : 403).json({ 
      error: isProduction ? 'Not found' : 'Forbidden',
      message: isProduction ? undefined : 'This endpoint is restricted to development mode or requires admin authentication'
    });
  }
  
  try {
    const { restaurant } = req.params;
    
    // Find restaurant by name
    const { data: restaurants, error: restError } = await supabase
      .from('restaurants')
      .select('id, name')
      .ilike('name', `%${restaurant}%`)
      .limit(1);
    
    if (restError) {
      return res.status(500).json({ error: restError.message });
    }
    
    if (!restaurants || restaurants.length === 0) {
      return res.status(404).json({ 
        error: 'Restaurant not found',
        searched_for: restaurant 
      });
    }
    
    const restaurantId = restaurants[0].id;
    const restaurantName = restaurants[0].name;
    
    // Get all menu items with section_name and menu_type
    const { data: items, error: itemsError } = await supabase
      .from('menu_items')
      .select('id, name, section_name, menu_type, category')
      .eq('restaurant_id', restaurantId)
      .eq('menu_type', menuType);
    
    if (itemsError) {
      return res.status(500).json({ error: itemsError.message });
    }
    
    const totalItems = items?.length || 0;
    
    // Build section breakdown WITH sample items
    const sectionData = {};
    (items || []).forEach(item => {
      const section = item.section_name || 'NULL';
      if (!sectionData[section]) {
        sectionData[section] = {
          count: 0,
          sampleItems: []
        };
      }
      sectionData[section].count++;
      // Keep first 3 sample items per section
      if (sectionData[section].sampleItems.length < 3) {
        sectionData[section].sampleItems.push({
          name: item.name || '(unnamed)',
          category: item.category || '(no category)',
          id: item.id
        });
      }
    });
    
    const sectionBreakdown = Object.entries(sectionData)
      .map(([section, data]) => ({ 
        section, 
        count: data.count,
        sampleItems: data.sampleItems
      }))
      .sort((a, b) => b.count - a.count);
    
    const uncategorizedCount = sectionData['Uncategorized']?.count || 0;
    const uncategorizedPercent = totalItems > 0 ? (uncategorizedCount / totalItems) * 100 : 0;
    
    return res.json({
      restaurant: restaurantName,
      restaurant_id: restaurantId,
      menu_type_requested: menuType,
      totalItems,
      sectionBreakdown,
      quality: {
        uncategorized_count: uncategorizedCount,
        uncategorized_percent: uncategorizedPercent.toFixed(1) + '%',
        status: uncategorizedPercent > 20 ? '🚨 FAILING' : uncategorizedPercent > 10 ? '⚠️ WARNING' : '✅ PASSING'
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// NEW ENDPOINT: GET /api/restaurants/:restaurantId/menu-types
// Returns available menu types for a restaurant (breakfast, lunch, dinner, drinks)
// Only returns types that have items
router.get('/restaurants/:restaurantId/menu-types', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Query distinct menu_types for this restaurant
    const { data, error } = await supabase
      .from('menu_items')
      .select('menu_type')
      .eq('restaurant_id', restaurantId);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    // Get unique menu types that have items
    const availableTypes = [...new Set((data || []).map(item => item.menu_type))].filter(Boolean);
    const sortedTypes = availableTypes.sort((a, b) => {
      const order = ['breakfast', 'lunch', 'dinner', 'drinks'];
      return order.indexOf(a) - order.indexOf(b);
    });
    
    res.json({
      restaurant_id: restaurantId,
      available_menu_types: sortedTypes,
      total_types: sortedTypes.length,
      valid_types: MENU_TYPES_ARRAY
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NEW ENDPOINT: GET /api/restaurants/:name/types
// Returns available menu types for a restaurant (by name)
// Only returns types that have items
// Used for rendering top-level menu type tabs
router.get('/:name/types', async (req, res) => {
  try {
    const { name } = req.params;
    const restaurantName = decodeURIComponent(name);
    
    // Find restaurant by name
    const { data: restaurants, error: restError } = await supabase
      .from('restaurants')
      .select('id, name')
      .ilike('name', `%${restaurantName}%`)
      .limit(1);
    
    if (restError) {
      return res.status(500).json({ error: restError.message });
    }
    
    if (!restaurants || restaurants.length === 0) {
      return res.status(404).json({ 
        error: 'Restaurant not found',
        searched_for: restaurantName 
      });
    }
    
    const restaurantId = restaurants[0].id;
    const actualName = restaurants[0].name;
    
    // Query distinct menu_type values for this restaurant
    const { data: items, error: itemsError } = await supabase
      .from('menu_items')
      .select('menu_type')
      .eq('restaurant_id', restaurantId);
    
    if (itemsError) {
      return res.status(500).json({ error: itemsError.message });
    }
    
    // Get unique menu types that have items
    const availableTypes = [...new Set((items || []).map(item => item.menu_type))].filter(Boolean);
    
    // Sort in standard order: breakfast, lunch, dinner, drinks
    const sortedTypes = availableTypes.sort((a, b) => {
      const order = ['breakfast', 'lunch', 'dinner', 'drinks'];
      return order.indexOf(a) - order.indexOf(b);
    });
    
    res.json({
      restaurant: actualName,
      available_types: sortedTypes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
