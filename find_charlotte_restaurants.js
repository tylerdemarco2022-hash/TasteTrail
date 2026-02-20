// This script will use the Google Places API to search for restaurants in Charlotte, NC
// and output a JSON file with their names and website URLs (if available).
// You must set your Google Places API key in the environment variable GOOGLE_API_KEY.

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('Set GOOGLE_API_KEY in your environment.');
  process.exit(1);
}

const OUTPUT = path.join(__dirname, 'charlotte_restaurants_google.json');
const LOCATION = '35.2271,-80.8431'; // Charlotte, NC
const RADIUS = 15000; // meters
const TYPE = 'restaurant';

async function fetchRestaurants() {
  let nextPageToken = null;
  let allResults = [];
  let page = 1;
  do {
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${LOCATION}&radius=${RADIUS}&type=${TYPE}&key=${API_KEY}`;
    if (nextPageToken) url += `&pagetoken=${nextPageToken}`;
    const res = await axios.get(url);
    const results = res.data.results || [];
    allResults = allResults.concat(results);
    nextPageToken = res.data.next_page_token || null;
    if (nextPageToken) await new Promise(r => setTimeout(r, 2000)); // Google requires a short wait
    page++;
  } while (nextPageToken && page <= 3); // Google returns max 60 results (3 pages)
  return allResults;
}

async function enrichWithDetails(places) {
  const detailed = [];
  for (const place of places) {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,formatted_address&key=${API_KEY}`;
    const res = await axios.get(detailsUrl);
    const info = res.data.result;
    if (info && info.website) {
      detailed.push({ name: info.name, website: info.website, address: info.formatted_address });
    }
    await new Promise(r => setTimeout(r, 100)); // avoid rate limits
  }
  return detailed;
}

(async () => {
  const places = await fetchRestaurants();
  const withWebsites = await enrichWithDetails(places);
  fs.writeFileSync(OUTPUT, JSON.stringify(withWebsites, null, 2));
  console.log(`Saved ${withWebsites.length} Charlotte restaurants with websites to charlotte_restaurants_google.json`);
})();
