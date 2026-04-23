import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_URL = 'http://localhost:8081/api/restaurants';

async function getRestaurants() {
  const { data, error } = await supabase.from('restaurants').select('id, name, menu_status, menu_confidence').limit(100);
  if (error) throw error;

  // Categorize by menu_status
  const imageMenu = data.filter(r => r.menu_status === 'image_menu');
  const success = data.filter(r => r.menu_status === 'success');
  const failed = data.filter(r => r.menu_status === 'failed');
  const notStarted = data.filter(r => !r.menu_status || r.menu_status === 'not_started');

  // Pick a diverse sample: some successful, some not started, some failed, some image_menu
  return [
    ...success.slice(0, 3),
    ...notStarted.slice(0, 4),
    ...failed.slice(0, 2),
    ...imageMenu.slice(0, 1)
  ].slice(0, 10);
}

async function resetRestaurant(r) {
  await supabase.from('menu_items').delete().eq('restaurant_id', r.id);
  await supabase.from('restaurants').update({
    menu_status: 'not_started',
    menu_confidence: null,
    menu_last_checked: null
  }).eq('id', r.id);
}

async function triggerAndWait(r) {
  const start = Date.now();
  try {
    await fetch(`${API_URL}/${encodeURIComponent(r.name)}`);
  } catch (e) {
    return { name: r.name, type: 'error', items: 0, status: 'fetch_error', confidence: null, duration: Date.now() - start };
  }

  let status = null;
  let confidence = null;
  let items = 0;
  let waited = 0;

  while (waited < 90000) {
    await new Promise(res => setTimeout(res, 3000));
    waited += 3000;

    const { data, error } = await supabase.from('restaurants').select('menu_status, menu_confidence').eq('id', r.id).single();
    if (error) continue;

    status = data.menu_status;
    confidence = data.menu_confidence;

    if (['success', 'image_menu', 'failed', 'error', 'suspicious'].includes(status)) break;
  }

  const { count } = await supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('restaurant_id', r.id);
  items = count || 0;

  const duration = Date.now() - start;
  let type = 'html';
  if (status === 'image_menu') type = 'image_menu';
  else if (items >= 8) type = 'success';
  else type = 'insufficient';

  return { name: r.name, type, items, status, confidence, duration };
}

async function main() {
  const restaurants = await getRestaurants();

  if (restaurants.length === 0) {
    console.error('No restaurants found in database.');
    process.exit(1);
  }

  console.error(`Testing ${restaurants.length} restaurants...`);

  const results = [];
  for (const r of restaurants) {
    console.error(`  Scraping: ${r.name}...`);
    await resetRestaurant(r);
    const res = await triggerAndWait(r);
    results.push(res);
    console.error(`  Done: ${r.name} → ${res.status} (${res.items} items, ${res.duration}ms)`);
  }

  // Results table
  console.table(results.map(r => ({
    restaurant: r.name,
    type: r.type,
    items: r.items,
    status: r.status,
    confidence: r.confidence != null ? r.confidence.toFixed(2) : 'N/A',
    time_ms: r.duration
  })));

  // Metrics
  const total = results.length;
  const successCount = results.filter(r => r.items >= 8).length;
  const avgTime = results.reduce((a, b) => a + b.duration, 0) / total;
  const imageMenuCount = results.filter(r => r.status === 'image_menu').length;

  console.log(`success_rate: ${(successCount / total * 100).toFixed(1)}%`);
  console.log(`avg_duration_ms: ${avgTime.toFixed(0)}`);
  console.log(`image_menu_percent: ${(imageMenuCount / total * 100).toFixed(1)}%`);
}

main().catch(err => {
  console.error('Validation failed:', err.message);
  process.exit(1);
});
