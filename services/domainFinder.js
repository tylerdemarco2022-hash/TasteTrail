// domainFinder.js
// Given restaurant name, city, state, returns official website domain using Google Places API
// Usage: const findDomain = require('./domainFinder');
// await findDomain({ name: 'Harpers', city: 'Charlotte', state: 'NC' })


import axios from 'axios';
import dotenv from 'dotenv';
try { dotenv.config(); } catch {}
const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_KEY) {
  throw new Error('GOOGLE_PLACES_KEY or GOOGLE_PLACES_API_KEY environment variable is not set');
}

function extractRootDomain(url) {
  try {
    const { hostname } = new URL(url);
    // Remove www. prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function findDomain({ name, city, state }) {
  try {
    if (!name) {
      throw new Error('Missing required parameter: name');
    }
    // Allow missing city/state, fallback gracefully
    // Append 'restaurant' to query if not already in name
    let query = name;
    if (!/restaurant/i.test(name)) {
      query += ' restaurant';
    }
    if (city) query += ` ${city}`;
    if (state) query += ` ${state}`;
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json`;
    // 1. Text Search: get place_id only
    const textRes = await axios.get(textSearchUrl, {
      params: {
        query,
        key: GOOGLE_PLACES_KEY
      },
      timeout: 8000
    });
    // TEMP: Log full raw Google API response
    console.log("=== RAW GOOGLE RESPONSE ===");
    console.dir(textRes.data, { depth: null });
    // TEMP: Log raw Google Places response and key fields
    console.log("RAW GOOGLE RESPONSE:");
    console.dir(textRes.data, { depth: null });
    console.log("response.data.results:");
    console.dir(textRes.data.results, { depth: null });
    if (textRes.data.candidates) {
      console.log("response.data.candidates:");
      console.dir(textRes.data.candidates, { depth: null });
    }
    (textRes.data.results || []).forEach((r, i) => {
      console.log(`Result [${i}]:`);
      console.log("  place_id:", r.place_id);
      console.log("  types:", r.types);
      console.log("  business_status:", r.business_status);
      console.log("  name:", r.name);
    });
    const results = textRes.data.results || [];
    if (results.length === 0) {
      return { found: false, domain: null, rawWebsite: null, reason: 'no_results' };
    }
    // Score top 5 results
    const candidates = results.slice(0, 5).map(r => {
      let score = 0;
      const nameLower = (r.name || '').toLowerCase();
      const queryLower = name.toLowerCase();
      if (nameLower.includes(queryLower)) score += 50;
      if ((r.types || []).includes('restaurant')) score += 40;
      if ((r.types || []).includes('food')) score += 30;
      if (/(gift|boutique|invitation|shop)/i.test(r.name)) score -= 40;
      if ((r.types || []).includes('store') && !(r.types || []).includes('restaurant')) score -= 50;
      return { ...r, score };
    });
    // Log all candidates and their scores
    console.log('[domainFinder] Text Search Candidates:');
    candidates.forEach((c, i) => {
      console.log(`  [${i}] ${c.name} (types: ${(c.types||[]).join(',')}) - score: ${c.score}`);
    });
    // Pick highest scoring above threshold
    const threshold = 30;
    const best = candidates.filter(c => c.score > threshold).sort((a, b) => b.score - a.score)[0];
    if (!best) {
      return { found: false, domain: null, rawWebsite: null, reason: 'No strong restaurant match', candidates: candidates.map(c => ({ name: c.name, types: c.types, score: c.score })) };
    }
    if (!best.place_id) {
      return { found: false, domain: null, rawWebsite: null, reason: 'no_place_id', candidates: candidates.map(c => ({ name: c.name, types: c.types, score: c.score })) };
    }
    // 2. Place Details: always call with fields=website,name,url,formatted_address
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json`;
    const detailsRes = await axios.get(detailsUrl, {
      params: {
        place_id: best.place_id,
        fields: 'website,name,url,formatted_address',
        key: GOOGLE_PLACES_KEY
      },
      timeout: 8000
    });
    const result = detailsRes.data.result || {};
    const website = result.website;
    if (!website) {
      return { found: false, domain: null, rawWebsite: null, reason: 'no_website', placeDetails: result };
    }
    const domain = extractRootDomain(website);
    if (!domain) {
      return { found: false, domain: null, rawWebsite: website, reason: 'bad_url', placeDetails: result };
    }
    return {
      found: true,
      domain,
      rawWebsite: website,
      types: best.types || [],
      placeDetails: result
    };
  } catch (e) {
    return { found: false, domain: null, rawWebsite: null, reason: 'api_error', error: e.message, stack: e.stack };
  }
}

if (import.meta.url === process.argv[1]) {
  const [,, name, city, state] = process.argv;
  if (!name) {
    console.log("Usage: node domainFinder.js \"Restaurant Name\" City State");
    process.exit(1);
  }
  (async () => {
    try {
      console.log("=== RUNNING DOMAIN FINDER DEBUG ===");
      const result = await findDomain({ name, city, state });
      console.log("=== FINAL RESULT ===");
      console.dir(result, { depth: null });
    } catch (err) {
      console.error("ERROR:", err);
    }
  })();
}
