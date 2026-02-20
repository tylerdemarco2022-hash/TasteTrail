// This script extracts and parses the Content property from restaurants_raw.json
// and prints the first 5 restaurant objects to the console for inspection.

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'restaurants_raw.json');

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) throw err;
  // Find the Content property and extract its value
  const contentMatch = data.match(/Content\s*:\s*([\s\S]*?)RawContent/);
  if (!contentMatch) {
    console.error('Content property not found');
    return;
  }
  let contentStr = contentMatch[1]
    .replace(/\n/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,$/, '');
  // Try to find the JSON array
  const jsonStart = contentStr.indexOf('[');
  const jsonEnd = contentStr.lastIndexOf(']') + 1;
  if (jsonStart === -1 || jsonEnd === -1) {
    console.error('JSON array not found in Content');
    return;
  }
  const jsonArrayStr = contentStr.slice(jsonStart, jsonEnd);
  try {
    const restaurants = JSON.parse(jsonArrayStr);
    console.log('Sample restaurant objects:', restaurants.slice(0, 5));
    // Optionally, print all keys of the first object
    if (restaurants.length > 0) {
      console.log('Keys in first object:', Object.keys(restaurants[0]));
    }
  } catch (e) {
    console.error('Failed to parse JSON:', e);
  }
});
