#!/usr/bin/env node
/**
 * Quick endpoint verification tests
 */

const API_BASE = 'http://localhost:8081';
const ADMIN_TOKEN = 'dev-token-change-me';

async function test(name, method, path, options = {}) {
  console.log(`\n🔍 Testing: ${name}`);
  console.log(`   ${method} ${path}`);
  
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN_TOKEN,
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      ...options
    });
    
    console.log(`   ✅ Status: ${response.status}`);
    
    if (response.headers.get('content-type')?.includes('json')) {
      const data = await response.json();
      console.log(`   Response: ${JSON.stringify(data).substring(0, 150)}...`);
    }
    
    return response;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n╔═════════════════════════════════════════════════════════╗');
  console.log('║      ENDPOINT VERIFICATION TESTS                    ║');
  console.log('╚═════════════════════════════════════════════════════════╝');

  // Test 1: Health
  await test('Health Check', 'GET', '/api/health');

  // Test 2: Restaurants (discovery)
  await test('Discovery API', 'GET', '/api/restaurants?lat=35.227&lng=-80.843&radius=5&sort=distance');

  // Test 3: Admin status
  await test('Admin Status', 'GET', '/admin/discovery/status');

  // Test 4: Flag-closed endpoint without token
  console.log('\n🔍 Testing: Flag-closed without token (should fail)');
  try {
    const response = await fetch(`${API_BASE}/admin/restaurants/1/flag-closed`, {
      method: 'POST',
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'test' })
    });
    console.log(`   Status: ${response.status} (expected 401 or 400)`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  // Test 5: Flag-closed endpoint WITH token
  console.log('\n🔍 Testing: Flag-closed WITH token');
  try {
    const response = await fetch(`${API_BASE}/admin/restaurants/test-id-123/flag-closed`, {
      method: 'POST',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN_TOKEN
      },
      body: JSON.stringify({ reason: 'test' })
    });
    console.log(`   Status: ${response.status}`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  console.log('\n✅ Endpoint verification complete\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
