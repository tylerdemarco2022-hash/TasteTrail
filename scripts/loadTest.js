const axios = require('axios');

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const REQUESTS = parseInt(process.env.LOAD_TEST_REQUESTS || '20', 10);

async function run() {
  const promises = [];
  for (let i = 0; i < REQUESTS; i++) {
    promises.push(axios.post(`${API_URL}/run-city`, { city: `LoadTestCity-${i}` }, { timeout: 5000 }).then(r => ({ status: r.status })).catch(e => ({ status: e.response ? e.response.status : 'ERR' })));
  }
  const results = await Promise.all(promises);
  const counts = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log('Load test results:', counts);
  const has429 = !!counts[429];
  if (has429) console.log('Rate limit behavior: PASS (429 responses detected)'); else console.log('Rate limit behavior: WARN/FAIL (no 429 responses)');
}

run().catch(e => { console.error('Load test failed:', e.message); process.exit(1); });
