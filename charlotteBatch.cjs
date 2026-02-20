function runFindMenuUrlFromName(name, city, debug = false) {
  return new Promise((resolve) => {
    const start = Date.now();
    const args = [name, city];
    if (debug) args.push('--debug');
    const proc = spawn('node', ['backend/scripts/findMenuUrlFromName.js', ...args], { shell: true });
    let output = '';
    let error = '';
    let finished = false;
    const timeout = setTimeout(() => {
      if (!finished) {
        proc.kill();
        finished = true;
        resolve({ success: false, error: 'Timeout', runtime: Date.now() - start });
      }
    }, TIMEOUT_MS);
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { error += data.toString(); });
    proc.on('close', (code) => {
      if (!finished) {
        clearTimeout(timeout);
        finished = true;
        resolve({ success: code === 0, output, error, runtime: Date.now() - start });
      }
    });
  });
}
// charlotteBatch.js
// Batch fetch Charlotte restaurants from Google Places, call findMenuUrlFromName, log results, and print summary.

const { spawn } = require('child_process');
const axios = require('axios');

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_API_KEY;
const maskedKey = GOOGLE_PLACES_API_KEY ? GOOGLE_PLACES_API_KEY.slice(0, 6) + '...' : 'undefined';
console.log(`[Startup] Google API Key (first 6 chars): ${maskedKey}`);
const CHARLOTTE_LOCATION = '35.2271,-80.8431'; // Charlotte, NC
const RADIUS = 15000; // meters
const MAX_RESULTS = 25;
const TIMEOUT_MS = 20000;

async function fetchRestaurants() {
  let restaurants = [];
  let nextPageToken = null;
  while (restaurants.length < MAX_RESULTS) {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${CHARLOTTE_LOCATION}&radius=${RADIUS}&type=restaurant&key=${GOOGLE_PLACES_API_KEY}` + (nextPageToken ? `&pagetoken=${nextPageToken}` : '');
    // Log API key (masked) and request URL
    const maskedKey = GOOGLE_PLACES_API_KEY ? GOOGLE_PLACES_API_KEY.slice(0, 6) + '...' : 'undefined';
    console.log(`[Google Places] API Key: ${maskedKey}`);
    console.log(`[Google Places] Request URL: ${url}`);
    try {
      const res = await axios.get(url);
      if (res.data && res.data.results) {
        restaurants.push(...res.data.results);
        nextPageToken = res.data.next_page_token;
        if (!nextPageToken) break;
        await new Promise(r => setTimeout(r, 2000));
      } else {
        break;
      }
    } catch (error) {
      break;
    }
  }
  return restaurants.slice(0, MAX_RESULTS);
}

async function main() {
  const restaurants = await fetchRestaurants();
  const filtered = restaurants.slice(0, MAX_RESULTS);
  let runtimes = [];
  let success = 0;
  let partial = 0;
  let fail = 0;
  for (let i = 0; i < filtered.length; i++) {
    const r = filtered[i];
    const name = r.name;
    const types = r.types || [];
    const city = 'Charlotte';
    console.log(`\n[${i + 1}/${filtered.length}] ${name}`);
    // Call findMenuUrlFromName and capture output
    const result = await runFindMenuUrlFromName(name, city);
    runtimes.push(result.runtime);
    let domain = 'N/A', menuUrl = null, method = null, confidence = null, itemsExtracted = null;
    if (result.output) {
      try {
        const parsed = JSON.parse(result.output);
        domain = parsed.domain || 'N/A';
        menuUrl = parsed.url || null;
        method = parsed.method || null;
        confidence = parsed.confidence || null;
      } catch {}
    }
    console.log(`  types: ${types.join(',')}`);
    console.log(`  domain: ${domain}`);
    console.log(`  menuUrl: ${menuUrl}`);
    console.log(`  method: ${method}`);
    console.log(`  confidence: ${confidence}`);
    if (menuUrl) {
      try {
        const scraper = require('./services/menuExtractor');
        if (typeof scraper.scrapeMenu === 'function') {
          const items = await scraper.scrapeMenu(menuUrl);
          itemsExtracted = Array.isArray(items) ? items.length : 0;
        }
      } catch {}
    }
    console.log(`  items extracted: ${itemsExtracted !== null ? itemsExtracted : 'N/A'}`);
    if (menuUrl && itemsExtracted > 10) success++;
    else if (menuUrl && itemsExtracted > 0) partial++;
    else fail++;
  }
  const avgRuntime = runtimes.length ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : 0;
  const total = filtered.length;
  const successRate = total ? ((success / total) * 100).toFixed(1) : 0;
  console.log('\nBatch Summary:');
  console.log(`Total: ${total}`);
  console.log(`Success: ${success}`);
  console.log(`Partial: ${partial}`);
  console.log(`Fail: ${fail}`);
  console.log(`Success rate: ${successRate}%`);
}

main().catch(err => {
  console.error('Batch failed:', err);
});
