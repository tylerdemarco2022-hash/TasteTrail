
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

import googlePlaces from '../src/providers/googlePlaces.js';
import normalizeRestaurant from '../src/normalize/restaurantNormalize.js';
import upsertRestaurant from '../src/db/upsertRestaurant.js';
import upsertMenu from '../src/db/upsertMenu.js';
import findMenuLink from '../src/utils/findMenuLink.js';
import supabase from '../src/db/supabase.js';
import generateGeoGrid from '../src/utils/generateGeoGrid.js';

// Configurable for any city
const CITY = 'Charleston';
const STATE = 'South Carolina';
const CENTER_LAT = 32.7765;
const CENTER_LNG = -79.9311;
const RADIUS = 12000;
const STEP_METERS = 2200; // ~2.2km grid step for good overlap
const TYPE = 'restaurant';
const REPORT_DIR = path.join(__dirname, '../../docs');
const REPORT_PATH = path.join(REPORT_DIR, `sc_ingest_charleston_${new Date().toISOString().slice(0,10)}.md`);

async function main() {
  // 1. Generate grid points
  const gridPoints = generateGeoGrid(CENTER_LAT, CENTER_LNG, RADIUS, STEP_METERS);
  // 2. Create or resume ingest job row
  let job, jobError;
  let { data: existingJob } = await supabase
    .from('ingest_jobs')
    .select('*')
    .eq('scope', STATE)
    .eq('city', CITY)
    .eq('status', 'running')
    .single();
  if (existingJob) {
    job = existingJob;
  } else {
    const result = await supabase
      .from('ingest_jobs')
      .insert({
        scope: STATE,
        city: CITY,
        status: 'running',
        progress: {
          total_grid_points: gridPoints.length,
          completed_grid_points: 0,
          current_grid_index: 0,
        },
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    job = result.data;
    jobError = result.error;
    if (jobError) {
      console.error('Failed to create ingest job:', jobError);
      process.exit(1);
    }
  }
  const jobId = job.id;
  let progress = job.progress || { total_grid_points: gridPoints.length, completed_grid_points: 0, current_grid_index: 0 };

  let allRestaurants = [];
  let errors = [];
  let totalCount = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let gridApiCalls = 0;
  let uniquePlaceIds = new Set();

  try {
    for (let gridIdx = progress.current_grid_index || 0; gridIdx < gridPoints.length; gridIdx++) {
      const { lat, lng } = gridPoints[gridIdx];
      let pageToken = undefined;
      let pageCount = 0;
      do {
        // Google Places nearby search for this grid point
        const res = await googlePlaces.nearbySearch(lat, lng, RADIUS / 3, pageToken); // Use smaller radius per tile
        gridApiCalls++;
        const places = res.results || [];
        pageToken = res.next_page_token;
        pageCount++;

        for (const place of places) {
          // Deduplicate by google_place_id across all grid points
          if (uniquePlaceIds.has(place.place_id)) continue;
          uniquePlaceIds.add(place.place_id);
          try {
            // 3. Pre-fetch check for idempotency and freshness
            const { getRestaurantByPlaceId, upsertRestaurant } = require('../src/db/upsertRestaurant');
            const { getMenuByRestaurantId, upsertMenu } = require('../src/db/upsertMenu');
            const placeId = place.place_id;
            let details = null;
            let detailsFetched = false;
            let menuUrl = null;
            let restaurantRow = null;

            // Check if restaurant exists and is fresh
            const { data: existing, error: fetchErr } = await getRestaurantByPlaceId(placeId);
            const now = new Date();
            let isFresh = false;
            if (existing && existing.details_fetched_at) {
              const fetchedAt = new Date(existing.details_fetched_at);
              const days = (now - fetchedAt) / (1000 * 60 * 60 * 24);
              if (days < 30) {
                // Fresh, skip details fetch
                isFresh = true;
                skipped++;
                // Update last_ingested_at
                await upsertRestaurant({
                  ...existing,
                  last_ingested_at: now.toISOString(),
                  updated_at: now.toISOString(),
                }, false);
                totalCount++;
                continue;
              }
            }

            // Not fresh or not found, fetch details
            details = await googlePlaces.placeDetails(placeId);
            detailsFetched = true;
            // Build photo URLs
            const photoUrls = (details.photos || []).map(p => googlePlaces.photoUrl(p.photo_reference));

            // Normalize data
            const normalized = normalizeRestaurant(details, photoUrls, null);
            // Upsert restaurant (detailsFetched = true)
            const { data: restaurant, error: upsertErr } = await upsertRestaurant(normalized, true);
            if (upsertErr) throw upsertErr;
            restaurantRow = restaurant;

            // Menu caching logic
            if (restaurant.website) {
              const { data: menuRow } = await getMenuByRestaurantId(restaurant.id);
              let menuFresh = false;
              if (menuRow && menuRow.last_checked) {
                const lastChecked = new Date(menuRow.last_checked);
                const menuDays = (now - lastChecked) / (1000 * 60 * 60 * 24);
                if (menuDays < 60) {
                  menuFresh = true;
                  menuUrl = menuRow.menu_url;
                }
              }
              if (!menuFresh) {
                menuUrl = await findMenuLink(restaurant.website);
                if (menuUrl) {
                  await upsertMenu(restaurant.id, menuUrl);
                }
              }
            }

            // Update restaurant with menu_url if found
            if (menuUrl) {
              // Optionally, you could update the restaurant row with menu_url if schema allows
            }

            allRestaurants.push({
              name: restaurantRow.name,
              address: restaurantRow.address,
              website: restaurantRow.website,
              cover_photo_url: restaurantRow.cover_photo_url,
              menu_url: menuUrl,
              rating: restaurantRow.rating,
            });
            totalCount++;
            if (existing) {
              updated++;
            } else {
              inserted++;
            }
            if (totalCount % 25 === 0) {
              console.log(`Ingested ${totalCount} restaurants...`);
            }
          } catch (err) {
            errors.push({ place_id: place.place_id, error: err.message || err.toString() });
            continue;
          }
        }
        // Google requires a delay before using next_page_token
        if (pageToken) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } while (pageToken);
      // Update progress in ingest_jobs
      progress.completed_grid_points = gridIdx + 1;
      progress.current_grid_index = gridIdx + 1;
      await supabase
        .from('ingest_jobs')
        .update({ progress })
        .eq('id', jobId);
    }
  } catch (err) {
    errors.push({ fatal: true, error: err.message || err.toString() });
  }

  // 10. Mark ingest job complete
  await supabase
    .from('ingest_jobs')
    .update({
      status: 'done',
      progress: {
        total_grid_points: gridPoints.length,
        completed_grid_points: gridPoints.length,
        current_grid_index: gridPoints.length,
        total: totalCount,
        inserted,
        updated,
        skipped,
        grid_api_calls: gridApiCalls,
        unique_restaurants: uniquePlaceIds.size,
        errors: errors.length
      },
      finished_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  // 11. Write markdown report
  const reportLines = [
    `# Charleston, SC Ingestion Report (${new Date().toISOString().slice(0,10)})`,
    '',
    `**Grid points processed:** ${gridPoints.length}`,
    `**Unique restaurants discovered:** ${uniquePlaceIds.size}`,
    `**Total processed:** ${totalCount}`,
    `**Inserted:** ${inserted}`,
    `**Updated:** ${updated}`,
    `**Skipped (fresh):** ${skipped}`,
    `**API calls (grid):** ${gridApiCalls}`,
    `**Errors:** ${errors.length}`,
    '',
    '| Name | Address | Website | Cover Photo URL | Menu URL | Rating |',
    '|------|---------|---------|-----------------|----------|--------|',
    ...allRestaurants.map(r =>
      `| ${r.name || ''} | ${r.address || ''} | ${r.website || ''} | ${r.cover_photo_url || ''} | ${r.menu_url || ''} | ${r.rating || ''} |`
    ),
    '',
    '## Errors',
    '```json',
    JSON.stringify(errors, null, 2),
    '```'
  ];
  fs.writeFileSync(REPORT_PATH, reportLines.join('\n'), 'utf8');
  console.log(`Ingestion complete. Report written to ${REPORT_PATH}`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
