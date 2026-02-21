// Stub implementation for Google Places provider
export default {
  async nearbySearch(lat, lng, radius, pageToken) {
    // Return mock data for testing
    return {
      results: [],
      next_page_token: null
    };
  },
  async placeDetails(placeId) {
    // Return mock details for testing
    return {
      place_id: placeId,
      name: 'Mock Restaurant',
      photos: [],
      website: 'https://mockrestaurant.com',
      rating: 4.5
    };
  },
  photoUrl(photoReference) {
    // Return a mock photo URL
    return `https://mockphotos.com/${photoReference}`;
  }
};
