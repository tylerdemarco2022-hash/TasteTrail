const axios = require('axios');
const logger = require('../services/logger');
const { googleLimiter } = require('../services/rateLimiter');
const metrics = require('../services/metrics');

const CHAIN_KEYWORDS = [
  'mcdonald', 'burger king', 'wendy', 'taco bell', 'subway', 'kfc', 'domino', 'starbuck', 'chipotle', 'dunkin'
];

async function discoveryAgent(city) {
  if (!process.env.GOOGLE_PLACES_API_KEY) throw new Error('Missing GOOGLE_PLACES_API_KEY');
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const q = encodeURIComponent(`restaurants in ${city}, SC`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&type=restaurant&key=${key}`;

  const results = [];
  try {
    let nextPageToken = null;
    let page = 0;
    do {
      const pageUrl = nextPageToken ? `${url}&pagetoken=${nextPageToken}` : url;
      // Respect Google rate limit
      await googleLimiter.removeToken();
      try { metrics.googlePlacesCalls.inc(1); } catch (e) {}
      const res = await axios.get(pageUrl, { timeout: 20000 });
      const body = res.data;
      logger.info(`Google returned ${body.results?.length || 0} results`);
      if (!body.results) break;
      for (const p of body.results) {
        const nameLower = (p.name || '').toLowerCase();
        if (CHAIN_KEYWORDS.some(k => nameLower.includes(k))) continue;
        results.push({
          name: p.name,
          address: p.formatted_address || null,
          city,
          state: null,
          phone: null,
          website: null,
          google_place_id: p.place_id,
        });
      }
      nextPageToken = body.next_page_token;
      page += 1;
      // Google may require a short pause before next_page_token becomes valid
      if (nextPageToken) await new Promise(r => setTimeout(r, 1500));
    } while (nextPageToken && page < 3);

    // fetch place details for phone/website
    for (const place of results) {
        try {
        await googleLimiter.removeToken();
        try { metrics.googlePlacesCalls.inc(1); } catch (e) {}
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.google_place_id}&fields=website,formatted_phone_number,adr_address&key=${key}`;
        const dres = await axios.get(detailsUrl, { timeout: 10000 });
        const bodyDetails = dres.data;
        logger.info(`Google returned ${bodyDetails.results?.length || 0} results`);
        const d = bodyDetails.result || {};
        place.phone = d.formatted_phone_number || place.phone;
        place.website = d.website || place.website;
        // try to extract state from adr_address if present
        if (d.adr_address) {
          const match = d.adr_address.match(/,\s*([^,<>]+)\s*<span/);
          place.state = match ? match[1] : null;
        }
      } catch (err) {
        logger.warn('Place details fetch failed for %s: %s', place.google_place_id, err.message);
      }
    }

    try { metrics.restaurantsDiscovered.inc(results.length); } catch (e) {}
    return results;
  } catch (err) {
    logger.error('discoveryAgent error: %s', err.message);
    throw err;
  }
}

module.exports = discoveryAgent;
