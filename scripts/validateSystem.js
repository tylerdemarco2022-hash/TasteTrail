const axios = require('axios');
const supabase = require('../services/supabaseClient');
const IORedis = require('ioredis');

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEST_CITY = process.env.VALIDATION_TEST_CITY || 'Validation City';

const TIMEOUT_MS = 60 * 1000; // overall timeout

function now() { return new Date().toISOString(); }

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkHealth() {
  try {
    const res = await axios.get(`${API_URL}/health`, { timeout: 5000 });
    const ok = res && res.data && res.data.status === 'ok';
    console.log(now(), 'Health check:', ok ? 'PASS' : 'FAIL');
    return ok;
  } catch (e) {
    console.log(now(), 'Health check: FAIL', e.message);
    return false;
  }
}

async function checkRedis() {
  try {
    const r = new IORedis(REDIS_URL);
    const pong = await r.ping();
    await r.quit();
    const ok = pong === 'PONG';
    console.log(now(), 'Redis ping:', ok ? 'PASS' : 'FAIL');
    return ok;
  } catch (e) {
    console.log(now(), 'Redis ping: FAIL', e.message);
    return false;
  }
}

async function checkRateLimit() {
  const apiLimit = parseInt(process.env.API_RATE_LIMIT || '10', 10);
  const attempts = apiLimit + 2;
  const results = await Promise.allSettled(Array.from({ length: attempts }).map(() => axios.post(`${API_URL}/run-city`, { city: TEST_CITY }, { timeout: 5000 }).catch(e => e.response ? e.response : e)));
  const statusCounts = results.reduce((acc, r) => {
    if (r.status === 'fulfilled') {
      const s = r.value.status || 200; acc[s] = (acc[s] || 0) + 1;
    } else {
      acc.error = (acc.error || 0) + 1;
    }
    return acc;
  }, {});
  const has429 = !!statusCounts[429];
  console.log(now(), `Rate limit test: sent ${attempts} requests; 429 count=${statusCounts[429] || 0}`);
  return has429;
}

async function enqueueAndVerify() {
  try {
    // Enqueue single job
    const r = await axios.post(`${API_URL}/run-city`, { city: TEST_CITY }, { timeout: 5000 });
    const jobId = r.data && r.data.jobId;
    console.log(now(), 'Enqueued jobId:', jobId || '(none)');

    // Poll Supabase for restaurant/menu/menu_items
    const deadline = Date.now() + (TIMEOUT_MS - 5000);
    let foundRestaurant = null;
    while (Date.now() < deadline) {
      const { data: restaurants, error } = await supabase.from('restaurants').select('id,city').eq('city', TEST_CITY).limit(1);
      if (!error && restaurants && restaurants.length) { foundRestaurant = restaurants[0]; break; }
      await wait(3000);
    }

    const okRestaurant = !!foundRestaurant;
    console.log(now(), 'Supabase restaurant check:', okRestaurant ? 'PASS' : 'FAIL');

    let okMenuItems = false;
    if (okRestaurant) {
      const restaurantId = foundRestaurant.id;
      // check menu_items table
      const deadline2 = Date.now() + (TIMEOUT_MS - 10000);
      while (Date.now() < deadline2) {
        const { data: items, error } = await supabase.from('menu_items').select('id').eq('restaurant_id', restaurantId).limit(1);
        if (!error && items && items.length) { okMenuItems = true; break; }
        await wait(3000);
      }
    }
    console.log(now(), 'Supabase menu_items check:', okMenuItems ? 'PASS' : 'FAIL');

    return okRestaurant && okMenuItems;
  } catch (e) {
    console.log(now(), 'Enqueue/verify error:', e.message || e);
    return false;
  }
}

async function fetchMetrics() {
  try {
    const res = await axios.get(`${API_URL}/metrics`, { timeout: 5000 });
    const body = res.data || res;
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const extract = (name) => {
      const m = text.match(new RegExp(`^${name}\\s+(\\d+)`, 'm'));
      return m ? Number(m[1]) : null;
    };
    const jobsProcessed = extract('jobs_processed_total');
    const restaurantsDiscovered = extract('restaurants_discovered_total');
    console.log(now(), 'Metrics snapshot:', { jobsProcessed, restaurantsDiscovered });
    return true;
  } catch (e) {
    console.log(now(), 'Metrics fetch failed:', e.message);
    return false;
  }
}

async function runAll() {
  const overallDeadline = setTimeout(() => {
    console.error(now(), 'Validation timed out');
    process.exit(1);
  }, TIMEOUT_MS);

  const results = {};
  results.health = await checkHealth();
  results.redis = await checkRedis();
  results.rateLimit = await checkRateLimit();

  results.enqueueVerify = await enqueueAndVerify();
  results.metrics = await fetchMetrics();

  clearTimeout(overallDeadline);

  const allPass = Object.values(results).every(Boolean);
  console.log(now(), 'Validation results:', results);
  console.log(now(), allPass ? 'ALL TESTS PASS' : 'SOME TESTS FAILED');
  process.exit(allPass ? 0 : 1);
}

runAll();
