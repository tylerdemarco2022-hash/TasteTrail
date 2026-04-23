/**
 * Discovery Engine Utilities
 * 
 * Performs:
 * - Bounding box calculations
 * - Tile identification
 * - Trending score computation
 * - IP-based throttling
 */

/**
 * Calculate bounding box for radius search
 * Returns { minLat, maxLat, minLng, maxLng }
 */
export function calculateBoundingBox(lat, lng, radiusMiles) {
  const earthRadiusMiles = 3959;
  const latDelta = (radiusMiles / earthRadiusMiles) * (180 / Math.PI);
  const lngDelta = (radiusMiles / (earthRadiusMiles * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta
  };
}

/**
 * Identify which tile contains the given coordinates
 * Returns { city, center_lat, center_lng } or null
 */
export async function identifyTile(supabase, lat, lng) {
  try {
    // Find tile that contains this point
    const { data: tiles, error } = await supabase
      .from('discovery_tiles')
      .select('city, center_lat, center_lng, radius_m')
      .filter('city', 'not.is', null)
      .order('radius_m', { ascending: false })
      .limit(50);

    if (error || !tiles || tiles.length === 0) {
      return null;
    }

    // Find closest tile (simple distance-based approach)
    let closestTile = null;
    let minDistance = Infinity;

    for (const tile of tiles) {
      const dist = haversineDistance(lat, lng, tile.center_lat, tile.center_lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestTile = tile;
      }
    }

    return closestTile && minDistance < 50 ? closestTile : null;
  } catch (err) {
    console.error('Error identifying tile:', err);
    return null;
  }
}

/**
 * Boost tile priority when user searches
 * Increases priority and adjusts next_run_at
 */
export async function boostTilePriority(supabase, tileId) {
  try {
    // Get current tile
    const { data: tile, error: fetchError } = await supabase
      .from('discovery_tiles')
      .select('priority, next_run_at')
      .eq('id', tileId)
      .single();

    if (fetchError || !tile) {
      console.warn(`Could not boost tile ${tileId}: not found`);
      return null;
    }

    // Increase priority (max 10)
    const newPriority = Math.min(tile.priority + 1, 10);

    // If next_run_at is more than 6 hours away, bring it closer (to 2 hours)
    let newNextRunAt = tile.next_run_at;
    const sixHoursMs = 6 * 60 * 60 * 1000;
    const twoHoursMs = 2 * 60 * 60 * 1000;

    if (new Date(tile.next_run_at).getTime() - Date.now() > sixHoursMs) {
      const twoHoursFromNow = new Date(Date.now() + twoHoursMs);
      newNextRunAt = twoHoursFromNow.toISOString();
    }

    // Update tile
    const { error: updateError } = await supabase
      .from('discovery_tiles')
      .update({
        priority: newPriority,
        next_run_at: newNextRunAt,
        updated_at: new Date()
      })
      .eq('id', tileId);

    if (updateError) {
      console.error('Error boosting tile priority:', updateError);
      return null;
    }

    console.log(`✅ Boosted tile ${tileId}: priority ${tile.priority} → ${newPriority}`);
    return { priority: newPriority, next_run_at: newNextRunAt };
  } catch (err) {
    console.error('Error in boostTilePriority:', err);
    return null;
  }
}

/**
 * Haversine distance (miles)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate trending score
 * trending_score = (views_last_7_days * 1) + (confirms_last_30_days * 3)
 */
export function calculateTrendingScore(viewsLast7Days, confirmsLast30Days) {
  return (viewsLast7Days * 1) + (confirmsLast30Days * 3);
}

/**
 * Dynamic confidence calculation
 */
export function calculateDynamicConfidence(baseScore, scanCount, hasPhoto, userConfirmations, isFlaggedClosed) {
  let score = baseScore;

  // Boost for multiple scans
  if (scanCount > 1) {
    score += 1;
  }

  // Boost for photo
  if (hasPhoto) {
    score += 1;
  }

  // Boost for user confirmations
  if (userConfirmations > 0) {
    score += 1;
  }

  // Penalty for flagged closed
  if (isFlaggedClosed) {
    score -= 2;
  }

  // Cap 0-5
  return Math.max(0, Math.min(5, score));
}

/**
 * Get trending badge
 */
export function getTrendingBadge(trendingScore, threshold = 20) {
  if (trendingScore >= threshold) {
    return '🔥 Trending';
  }
  return null;
}

/**
 * Check if view should be logged (throttle: 1 per restaurant per 10 min per IP)
 */
export async function shouldLogView(supabase, restaurantId, ipAddress) {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: recentView, error } = await supabase
      .from('restaurant_activity')
      .select('id', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .eq('ip_address', ipAddress)
      .eq('type', 'view')
      .gte('created_at', tenMinutesAgo)
      .limit(1);

    if (error) {
      console.warn('Error checking recent views:', error);
      return true; // Log if we can't check
    }

    return !recentView || recentView.length === 0;
  } catch (err) {
    console.warn('Error in shouldLogView:', err);
    return true; // Log on error
  }
}

/**
 * Log activity event and update trending counters
 */
export async function logActivity(supabase, restaurantId, type, ipAddress) {
  try {
    // Insert activity record
    const { error } = await supabase
      .from('restaurant_activity')
      .insert({
        restaurant_id: restaurantId,
        type,
        ip_address: ipAddress,
        created_at: new Date()
      });

    if (error) {
      console.error('Error logging activity:', error);
      return;
    }

    // Update counters in restaurants table
    if (type === 'view') {
      // Increment views_7d counter
      const { error: updateError } = await supabase.rpc('increment_views', {
        restaurant_id_param: restaurantId
      });
      
      if (updateError) {
        console.error('Error incrementing views:', updateError);
      }
    } else if (type === 'confirm' || type === 'flag_closed') {
      // Increment confirms_30d counter
      const { error: updateError } = await supabase.rpc('increment_confirms', {
        restaurant_id_param: restaurantId
      });
      
      if (updateError) {
        console.error('Error incrementing confirms:', updateError);
      }
    }
  } catch (err) {
    console.error('Error in logActivity:', err);
  }
}
