import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Script directory:', __dirname);
console.log('Process cwd:', process.cwd());

dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});

console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'Missing');
console.log('SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Missing');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
      .from('dishes')
      .select('id')
      .limit(1);
    
    console.log('Connection test result:', { data: data ? 'OK' : null, error });
    
    if (error) {
      console.error('Connection error object:', error);
      throw error;
    }
  } catch (err) {
    console.error('Full error object:', err);
    if (err?.cause) console.error('Error cause:', err.cause);
    throw err;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

async function ensureGlobalMean() {
  console.log('Updating global mean');
  const { data: globalMean, error: meanError } = await supabase.rpc('get_global_weighted_mean');
  if (meanError) throw new Error(meanError.message);

  const meanValue = Number(globalMean);
  if (!Number.isFinite(meanValue)) return null;

  const { error } = await supabase
    .from('global_stats')
    .upsert({ key: 'global_mean_rating', value_float: meanValue, updated_at: new Date().toISOString() }, { onConflict: ['key'] });

  if (error) throw new Error(error.message);

  return meanValue;
}

async function loadBayesM() {
  const { data, error } = await supabase
    .from('global_stats')
    .select('value_int')
    .eq('key', 'bayes_m')
    .single();

  if (error) return 10;
  return Number.isFinite(data?.value_int) ? data.value_int : 10;
}

async function recomputeDishStats() {
  console.log('Recomputing dish stats');
  const bayesM = await loadBayesM();
  const globalMean = await ensureGlobalMean();

  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data: dishes, error } = await supabase
      .from('dishes')
      .select('id')
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!dishes || dishes.length === 0) break;

    for (const item of dishes) {
      const dishId = item.id;

      const { data: dishStatsRows, error: statsError } = await supabase
        .rpc('get_effective_dish_stats', { dish_id: dishId });

      if (statsError) throw new Error(statsError.message);

      const dishStats = Array.isArray(dishStatsRows) ? dishStatsRows[0] : dishStatsRows;
      const ratingCount = Number(dishStats?.rating_count || 0);
      const weightedAverage = Number(dishStats?.weighted_average);
      const volatilityStddev = Number(dishStats?.volatility_stddev || 0);

      const safeGlobalMean = Number.isFinite(globalMean)
        ? globalMean
        : (Number.isFinite(weightedAverage) ? weightedAverage : 0);

      const bayesian = ratingCount > 0 && Number.isFinite(weightedAverage)
        ? ((ratingCount / (ratingCount + bayesM)) * weightedAverage) + ((bayesM / (ratingCount + bayesM)) * safeGlobalMean)
        : safeGlobalMean;

      const confidenceScore = clamp(1 - (volatilityStddev / 2), 0, 1);

      const recentWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentRows, error: recentError } = await supabase
        .from('ratings')
        .select('rating')
        .eq('dish_id', dishId)
        .gte('created_at', recentWindow);

      if (recentError) throw new Error(recentError.message);

      const recentRatings = (recentRows || []).map(row => Number(row.rating)).filter(Number.isFinite);
      const recentAvg = recentRatings.length
        ? recentRatings.reduce((sum, v) => sum + v, 0) / recentRatings.length
        : null;

      const emojiTags = computeDishTags({
        rating_bayesian: bayesian,
        rating_count: ratingCount,
        volatility_stddev: volatilityStddev,
        recent_avg: recentAvg,
        lifetime_avg: weightedAverage
      });

      const { error: updateError } = await supabase
        .from('dishes')
        .update({
          rating_weighted: Number.isFinite(weightedAverage) ? weightedAverage : null,
          rating_bayesian: Number.isFinite(bayesian) ? bayesian : null,
          rating_count: ratingCount,
          volatility_stddev: Number.isFinite(volatilityStddev) ? volatilityStddev : null,
          emoji_tags: emojiTags,
          confidence_score: confidenceScore,
          last_computed_at: new Date().toISOString()
        })
        .eq('id', dishId);

      if (updateError) throw new Error(updateError.message);
    }

    offset += pageSize;
  }
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (!magnitude) return vector;
  return vector.map(v => v / magnitude);
}

function kMeans(vectors, k, iterations = 10) {
  if (vectors.length === 0) return [];
  const dimension = vectors[0].length;
  const centroids = vectors.slice(0, k).map(v => v.slice());
  const assignments = new Array(vectors.length).fill(0);

  for (let iter = 0; iter < iterations; iter += 1) {
    for (let i = 0; i < vectors.length; i += 1) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let c = 0; c < k; c += 1) {
        let distance = 0;
        for (let d = 0; d < dimension; d += 1) {
          const diff = vectors[i][d] - centroids[c][d];
          distance += diff * diff;
        }
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = c;
        }
      }
      assignments[i] = bestIndex;
    }

    const sums = Array.from({ length: k }, () => new Array(dimension).fill(0));
    const counts = new Array(k).fill(0);

    for (let i = 0; i < vectors.length; i += 1) {
      const cluster = assignments[i];
      counts[cluster] += 1;
      for (let d = 0; d < dimension; d += 1) {
        sums[cluster][d] += vectors[i][d];
      }
    }

    for (let c = 0; c < k; c += 1) {
      if (!counts[c]) continue;
      for (let d = 0; d < dimension; d += 1) {
        centroids[c][d] = sums[c][d] / counts[c];
      }
    }
  }

  return assignments;
}

async function recomputeClusters() {
  console.log('Updating clusters');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id');

  if (usersError) throw new Error(usersError.message);
  if (!users || users.length === 0) return;

  const { data: topRestaurants, error: topError } = await supabase
    .rpc('get_top_restaurants_by_ratings', { limit_n: 20 });

  if (topError) throw new Error(topError.message);

  const restaurantIds = (topRestaurants || []).map(row => row.restaurant_id).filter(Boolean);
  if (restaurantIds.length === 0) return;

  const { data: userAverages, error: averagesError } = await supabase
    .rpc('get_user_restaurant_averages', { target_restaurants: restaurantIds });

  if (averagesError) throw new Error(averagesError.message);

  const restaurantIndex = new Map();
  restaurantIds.forEach((id, index) => restaurantIndex.set(id, index));

  const userIndex = new Map();
  users.forEach((user, index) => userIndex.set(user.id, index));

  const vectors = users.map(() => new Array(restaurantIds.length).fill(0));

  for (const row of userAverages || []) {
    const uIndex = userIndex.get(row.user_id);
    const rIndex = restaurantIndex.get(row.restaurant_id);
    if (uIndex === undefined || rIndex === undefined) continue;
    vectors[uIndex][rIndex] = Number(row.avg_rating) || 0;
  }

  const normalized = vectors.map(normalizeVector);
  const clusterCount = Math.min(10, Math.max(2, users.length));
  const assignments = kMeans(normalized, clusterCount, 12);

  const updates = users.map((user, idx) => ({ id: user.id, cluster_id: assignments[idx] }));
  const { error: updateError } = await supabase
    .from('users')
    .upsert(updates, { onConflict: ['id'] });

  if (updateError) throw new Error(updateError.message);

  for (let clusterId = 0; clusterId < clusterCount; clusterId += 1) {
    const { data: clusterStats, error: clusterError } = await supabase
      .rpc('get_cluster_dish_stats', { target_cluster: clusterId });

    if (clusterError) throw new Error(clusterError.message);
    if (!clusterStats || clusterStats.length === 0) continue;

    const upserts = clusterStats.map(row => ({
      cluster_id: clusterId,
      dish_id: row.dish_id,
      rating_weighted: Number(row.rating_weighted),
      rating_count: Number(row.rating_count || 0),
      updated_at: new Date().toISOString()
    }));

    const { error: upsertError } = await supabase
      .from('dish_cluster_stats')
      .upsert(upserts, { onConflict: ['cluster_id', 'dish_id'] });

    if (upsertError) throw new Error(upsertError.message);
  }
}

async function main() {
  try {
    console.log('Starting recompute');
    await testConnection();
    await recomputeDishStats();
    await recomputeClusters();
    console.log('Finished successfully');
    process.exit(0);
  } catch (error) {
    console.error('Intelligence recompute failed:', error.message || error);
    process.exit(1);
  }
}

main();
