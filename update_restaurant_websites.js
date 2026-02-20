// This script will update the restaurants_raw.json file with valid website URLs from _ingest_report.json
// It will match by restaurant name and add a 'website' property to each restaurant in restaurants_raw.json

const fs = require('fs');
const path = require('path');

const ingestPath = path.join(__dirname, 'taste-trails/backend/restaurants/_ingest_report.json');
const rawPath = path.join(__dirname, 'restaurants_raw.json');
const outPath = path.join(__dirname, 'restaurants_with_websites.json');

// Helper to parse the Content property from restaurants_raw.json
function extractRestaurantsRaw() {
  const data = fs.readFileSync(rawPath, 'utf8');
  const contentMatch = data.match(/Content\s*:\s*([\s\S]*?)RawContent/);
  if (!contentMatch) throw new Error('Content property not found');
  let contentStr = contentMatch[1]
    .replace(/\n/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,$/, '');
  const jsonStart = contentStr.indexOf('[');
  const jsonEnd = contentStr.lastIndexOf(']') + 1;
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('JSON array not found');
  const jsonArrayStr = contentStr.slice(jsonStart, jsonEnd);
  return JSON.parse(jsonArrayStr);
}

const ingest = JSON.parse(fs.readFileSync(ingestPath, 'utf8'));
const restaurants = extractRestaurantsRaw();

// Build a map of name -> url from ingest report
const urlMap = {};
ingest.forEach(r => {
  if (r.name && r.url) urlMap[r.name.trim().toLowerCase()] = r.url;
});

// Update restaurants with website URLs
restaurants.forEach(r => {
  const nameKey = (r.name || '').trim().toLowerCase();
  if (urlMap[nameKey]) {
    r.website = urlMap[nameKey];
  }
});

fs.writeFileSync(outPath, JSON.stringify(restaurants, null, 2));
console.log('Updated restaurants_with_websites.json with website URLs.');
