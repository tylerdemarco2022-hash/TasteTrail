// Automated Menu Source Resolver
// Finds authoritative menu URLs for a restaurant using official and trusted sources only
// NEVER guesses or generates

import axios from 'axios';

/**
 * Attempts to resolve the authoritative menu source for a restaurant.
 * @param {Object} restaurant - { name, address, website, yelp_url, google_place_id }
 * @returns {Promise<{source_url: string, source_type: string}|{error: string}>}
 */
export async function resolveMenuSource(restaurant) {
  // 1. Prefer official website
  if (restaurant.website) {
    try {
      const homepage = (await axios.get(restaurant.website)).data;
      // Look for links containing 'menu' or 'menus'
      const menuLink = homepage.match(/href=["']([^"']*menu[^"']*)["']/i);
      if (menuLink && menuLink[1]) {
        let url = menuLink[1];
        if (!url.startsWith('http')) {
          // Relative path
          url = new URL(url, restaurant.website).href;
        }
        return { source_url: url, source_type: 'official' };
      }
    } catch (e) {
      console.error('[MenuSourceResolver] Fetch failed:', {
        url: restaurant.website,
        error: e,
        stack: e.stack,
        line: (e.stack || '').split('\n')[1] || ''
      });
      return { error: `Fetch failed for ${restaurant.website}: ${e.code || e.name} ${e.message}` };
    }
  }
  // 2. Fallback: trusted sources
  if (restaurant.yelp_url) {
    // Yelp menu page pattern
    const yelpMenuUrl = restaurant.yelp_url.replace(/(\?.*)?$/, '/menu');
    return { source_url: yelpMenuUrl, source_type: 'yelp' };
  }
  if (restaurant.google_place_id) {
    // Google Place menu links require scraping or SerpApi (not implemented here)
    return { error: 'Google Place menu scraping not implemented yet' };
  }
  // 3. No menu found
  return { error: 'No authoritative menu source found for this restaurant.' };
}
