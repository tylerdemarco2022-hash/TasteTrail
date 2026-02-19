const supabase = require('./supabase');

/**
 * Get menu by restaurant_id
 */
async function getMenuByRestaurantId(restaurant_id) {
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .single();
  if (error && error.code !== 'PGRST116') return { error };
  return { data };
}

/**
 * Upsert menu by restaurant_id and menu_url
 */
async function upsertMenu(restaurant_id, menu_url) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('menus')
    .upsert({
      restaurant_id,
      menu_url,
      last_checked: now,
      source: 'google_places',
    }, { onConflict: ['restaurant_id', 'menu_url'] })
    .select()
    .single();
  return { data, error };
}

module.exports = { getMenuByRestaurantId, upsertMenu };
