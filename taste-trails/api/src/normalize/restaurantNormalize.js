// Stub implementation for restaurant normalization
export default function normalizeRestaurant(details, photoUrls, extra) {
  return {
    name: details.name || 'Unknown',
    address: details.address || 'Unknown',
    website: details.website || '',
    cover_photo_url: photoUrls[0] || '',
    menu_url: '',
    rating: details.rating || null,
    ...extra
  };
}
