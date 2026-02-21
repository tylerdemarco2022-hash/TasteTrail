
// Stub implementation for upsertRestaurant
export async function getRestaurantByPlaceId(placeId) {
  // Return mock restaurant or null
  return { data: null, error: null };
}

export async function upsertRestaurant(restaurant, detailsFetched) {
  // Return mock upsert result
  return { data: { ...restaurant, id: 'mock-id', details_fetched_at: new Date().toISOString() }, error: null };
}

export default {
  getRestaurantByPlaceId,
  upsertRestaurant
};
