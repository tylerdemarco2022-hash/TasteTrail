const stringSimilarity = require('string-similarity');
const supabase = require('../services/supabaseClient');
const logger = require('../services/logger');

async function findDuplicate(restaurant) {
  try {
    // basic query by name similarity
    const { data: rows, error } = await supabase.rpc('search_restaurants_by_name', { name: restaurant.name });
    // If RPC not available, fallback to simple name scan (this is scalable via proper index in production)
    if (error) {
      logger.debug('RPC search failed, falling back');
      const { data, error: e2 } = await supabase.from('restaurants').select('id,name,google_place_id');
      if (e2) throw e2;
      if (!data || !data.length) return null;
      let best = null;
      for (const r of data) {
        const s = stringSimilarity.compareTwoStrings((r.name||'').toLowerCase(), (restaurant.name||'').toLowerCase()) * 100;
        if (s > 85) {
          best = r; break;
        }
      }
      return best;
    }

    if (!rows || !rows.length) return null;
    // choose top similarity > 85%
    for (const r of rows) {
      const s = stringSimilarity.compareTwoStrings((r.name||'').toLowerCase(), (restaurant.name||'').toLowerCase()) * 100;
      if (s > 85) return r;
    }
    return null;
  } catch (err) {
    logger.error('entityResolutionAgent error: %s', err.message);
    return null;
  }
}

module.exports = { findDuplicate };
