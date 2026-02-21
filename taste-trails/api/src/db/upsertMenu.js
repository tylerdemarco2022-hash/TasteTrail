
// Stub implementation for upsertMenu
export async function getMenuByRestaurantId(restaurantId) {
  // Return mock menu or null
  return { data: null, error: null };
}

export async function upsertMenu(restaurantId, menuUrl) {
  // Return mock upsert result
  return { data: { restaurant_id: restaurantId, menu_url: menuUrl, last_checked: new Date().toISOString() }, error: null };
}

export default {
  getMenuByRestaurantId,
  upsertMenu
};
