/**
 * Scheduled Refresh
 *
 * Every 15 minutes, enqueue up to 5 restaurants where:
 * - Never scraped (menu_last_checked IS NULL)
 * - menu_last_checked > 30 days ago
 * - menu_confidence < 0.7
 */

import { addScrapeJob } from './queueSetup.js';
import { supabase } from '../../backend/supabase.js';

export async function scheduleAutoRefresh() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, menu_last_checked, menu_confidence, menu_status')
      .or(`menu_last_checked.is.null,menu_last_checked.lt.${thirtyDaysAgo},menu_confidence.lt.0.7`)
      .not('menu_status', 'eq', 'in_progress') // Don't re-enqueue active jobs
      .not('menu_status', 'eq', 'image_menu')   // Don't retry image-based menus
      .limit(5);

    if (error) {
      console.error('[CRON] Failed to query restaurants for refresh:', error.message);
      return;
    }

    const enqueued = [];
    for (const rest of restaurants || []) {
      try {
        await addScrapeJob({
          restaurantId: rest.id,
          restaurantName: rest.name,
          jobType: 'scheduled_refresh'
        });
        enqueued.push(rest.name);
      } catch (err) {
        console.error(`[CRON] Failed to enqueue ${rest.name}:`, err.message);
      }
    }

    if (enqueued.length > 0) {
      console.log(`[CRON] Enqueued ${enqueued.length} restaurants for refresh: ${enqueued.join(', ')}`);
    }
  } catch (err) {
    console.error('[CRON] scheduleAutoRefresh error:', err.message);
  }
}

// Run every 15 minutes
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
setInterval(scheduleAutoRefresh, REFRESH_INTERVAL_MS);

// Also run once on startup after a delay
setTimeout(scheduleAutoRefresh, 10000);

console.log(`[CRON] Scheduled auto-refresh every ${REFRESH_INTERVAL_MS / 60000} minutes`);
