/**
 * Persistence + Safety
 *
 * - If items >= 8: save to DB
 * - If new scrape drops >50% items vs previous: DO NOT overwrite; flag suspicious
 * - Track scrape metadata in restaurants table
 */

import { supabase } from '../../supabase.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

function computeMenuHash(items) {
  const sorted = items
    .map(i => `${(i.name || '').toLowerCase()}|${i.price || ''}`)
    .sort()
    .join('\n');
  return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 16);
}

/**
 * Check if we should overwrite existing menu items.
 * Returns false if new scrape drops >50% vs previous count.
 */
export async function shouldOverwrite(restaurantId, newItemCount) {
  try {
    const { count, error } = await supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId);

    if (error || count == null) return true; // Can't check, allow overwrite
    if (count === 0) return true; // No existing items

    const dropRatio = 1 - (newItemCount / count);
    if (dropRatio > 0.5) {
      logger.warn({
        event: 'scrape_drop_protection',
        restaurantId,
        existingCount: count,
        newCount: newItemCount,
        dropPercent: Math.round(dropRatio * 100)
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ event: 'should_overwrite_check_failed', restaurantId, error: err.message });
    return true; // Fail open
  }
}

/**
 * Save menu items to the database.
 * Upserts by (restaurant_id, name) to avoid duplicates.
 */
export async function saveMenuItemsToDb(restaurantId, items, _sourceUrl, options = {}) {
  const { menuType = 'dinner' } = options;

  if (!items || items.length < 8) {
    logger.warn({ event: 'save_skipped_too_few', restaurantId, count: items?.length || 0 });
    return { saved: false, reason: 'too_few_items' };
  }

  // Safety check: don't overwrite if massive drop
  const canOverwrite = await shouldOverwrite(restaurantId, items.length);
  if (!canOverwrite) {
    // Flag as suspicious instead of overwriting
    await updateScrapeStatus(restaurantId, {
      scrape_status: 'suspicious',
      scrape_confidence: 0
    });
    return { saved: false, reason: 'drop_protection' };
  }

  const rows = items.map(item => ({
    restaurant_id: restaurantId,
    name: item.name,
    description: item.description || null,
    price: item.price || null,
    section_name: item.section_name || item.category || 'Menu',
    menu_type: menuType
  }));

  const { data, error } = await supabase
    .from('menu_items')
    .upsert(rows, { onConflict: 'restaurant_id,name' })
    .select('id');

  if (error) {
    logger.error({ event: 'save_menu_items_failed', restaurantId, error: error.message });
    return { saved: false, reason: error.message };
  }

  logger.info({ event: 'menu_items_saved', restaurantId, count: data?.length || items.length });
  return { saved: true, count: data?.length || items.length };
}

/**
 * Update scrape tracking fields on the restaurants table.
 */
export async function updateScrapeStatus(restaurantId, fields) {
  const update = {};
  const now = new Date().toISOString();

  // Map logical field names to existing/new DB columns
  if (fields.scrape_status != null) update.menu_status = fields.scrape_status;
  if (fields.scrape_confidence != null) update.menu_confidence = fields.scrape_confidence;
  if (fields.service_model != null) update.service_model = fields.service_model;
  if (fields.cuisine_tags != null) update.cuisine_tags = fields.cuisine_tags;

  update.menu_last_checked = now;

  const { error } = await supabase
    .from('restaurants')
    .update(update)
    .eq('id', restaurantId);

  if (error) {
    logger.error({ event: 'update_scrape_status_failed', restaurantId, error: error.message });
  }
}

/**
 * Save a discovered/scraped menu URL back to the restaurants table.
 * Only writes to fields that are currently empty — never overwrites admin-saved URLs.
 */
export async function saveMenuUrl(restaurantId, url) {
  if (!restaurantId || !url) return;

  // Pick the most specific field based on URL content
  const u = url.toLowerCase();
  let field = 'website';
  if (/\.pdf(\?|$)/.test(u)) field = 'pdf_url';
  else if (/lunch/.test(u)) field = 'lunch_url';
  else if (/dinner/.test(u)) field = 'dinner_url';
  else if (/drink|cocktail|wine|beer/.test(u)) field = 'drinks_url';

  try {
    // Fetch current value — only save if the field is blank
    const { data: row } = await supabase
      .from('restaurants')
      .select(field)
      .eq('id', restaurantId)
      .single();

    if (row && row[field]) {
      logger.info({ event: 'menu_url_already_set', restaurantId, field, existing: row[field] });
      return; // Admin has already set a URL — don't overwrite
    }

    const { error } = await supabase
      .from('restaurants')
      .update({ [field]: url, updated_at: new Date().toISOString() })
      .eq('id', restaurantId);

    if (error) {
      logger.error({ event: 'save_menu_url_failed', restaurantId, url, error: error.message });
    } else {
      logger.info({ event: 'menu_url_saved', restaurantId, url, field });
    }
  } catch (err) {
    logger.error({ event: 'save_menu_url_error', restaurantId, error: err.message });
  }
}

export { computeMenuHash };
