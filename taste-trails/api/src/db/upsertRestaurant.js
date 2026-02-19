const supabase = require('./supabase');

/**
 * Get a restaurant by google_place_id
 */
async function getRestaurantByPlaceId(google_place_id) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('google_place_id', google_place_id)
    .single();
  if (error && error.code !== 'PGRST116') return { error };
  return { data };
}

/**
 * Upsert restaurant by google_place_id
 * Only update details_fetched_at if detailsFetched is true
 */
async function upsertRestaurant(normalized, detailsFetched) {
  const now = new Date().toISOString();
  const updateFields = {
    ...normalized,
    last_ingested_at: now,
    updated_at: now,
  };
  if (detailsFetched) {
    updateFields.details_fetched_at = now;
  }
  const { data, error } = await supabase
    .from('restaurants')
    .upsert(updateFields, { onConflict: ['google_place_id'] })
    .select()
    .single();
  return { data, error };
}

module.exports = { getRestaurantByPlaceId, upsertRestaurant };
