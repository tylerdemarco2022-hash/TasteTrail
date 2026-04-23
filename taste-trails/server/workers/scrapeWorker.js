import 'dotenv/config';
console.log('WORKER ENV CHECK:', {
  hasUrl: !!process.env.SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});
/**
 * BullMQ Background Scrape Worker
 *
 * Queue: menuScrapeQueue
 * Job types: initial_scrape, scheduled_refresh, low_confidence_retry, manual_override
 * Throttle: concurrency 1, per-domain delay with jitter
 */

import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { runScrapePipeline } from '../../backend/scraper/pipeline/index.js';
import { saveMenuItemsToDb, updateScrapeStatus, saveMenuUrl } from '../../backend/scraper/pipeline/persistence.js';

const redis = new Redis({ maxRetriesPerRequest: null });

// Per-domain delay tracking to avoid hammering
const domainLastScrape = new Map();
const MIN_DOMAIN_DELAY_MS = 5000;
const MAX_JITTER_MS = 3000;

function getDomain(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function waitForDomainDelay(domain) {
  const lastTime = domainLastScrape.get(domain);
  if (lastTime) {
    const elapsed = Date.now() - lastTime;
    const jitter = Math.floor(Math.random() * MAX_JITTER_MS);
    const delay = MIN_DOMAIN_DELAY_MS + jitter - elapsed;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  domainLastScrape.set(domain, Date.now());
}

const scrapeWorker = new Worker('menuScrapeQueue', async (job) => {
  const { restaurantId, restaurantName, jobType } = job.data;
  const domain = getDomain(restaurantName);

  console.log(`[SCRAPE_WORKER] Job started: ${jobType} for ${restaurantName} (${restaurantId})`);

  // OCR jobs are not yet implemented — log and skip
  if (jobType === 'ocr_image_menu') {
    console.log(`[SCRAPE_WORKER] OCR job for ${restaurantName} — not yet implemented, skipping.`);
    return { status: 'skipped', reason: 'ocr_not_implemented' };
  }

  // Mark as in_progress
  try {
    await updateScrapeStatus(restaurantId, { scrape_status: 'in_progress' });
  } catch (_) {}

  // Per-domain throttle
  await waitForDomainDelay(domain);

  try {
    const result = await runScrapePipeline(restaurantName, { restaurantId, jobType });
    const items = result.normalizedItems || [];

    if (items.length >= 8) {
      const saveResult = await saveMenuItemsToDb(restaurantId, items, result.sourceUrl);

      if (saveResult.saved) {
        await updateScrapeStatus(restaurantId, {
          scrape_status: 'success',
          scrape_confidence: result.confidence
        });

        // Save the discovered URL back so future scrapes skip discovery
        if (result.sourceUrl && !result.urlFromDb) {
          await saveMenuUrl(restaurantId, result.sourceUrl);
        }

        console.log(`[SCRAPE_WORKER] SUCCESS: ${restaurantName} — ${items.length} items, confidence=${result.confidence}`);
      } else {
        console.warn(`[SCRAPE_WORKER] Save blocked for ${restaurantName}: ${saveResult.reason}`);
      }
    } else if (result.failReason === 'image_menu') {
      // Image-based menu detected — mark as image_menu, don't retry
      await updateScrapeStatus(restaurantId, {
        scrape_status: 'image_menu',
        scrape_confidence: 0.2
      });

      console.warn(`[SCRAPE_WORKER] IMAGE_MENU: ${restaurantName} — menu appears to be image-based`);
    } else {
      await updateScrapeStatus(restaurantId, {
        scrape_status: 'failed',
        scrape_confidence: result.confidence
      });

      console.warn(`[SCRAPE_WORKER] INSUFFICIENT: ${restaurantName} — ${items.length} items, reason=${result.failReason}`);
    }

    return {
      itemCount: items.length,
      confidence: result.confidence,
      status: items.length >= 8 ? 'success' : 'failed',
      failReason: result.failReason,
      sessionDir: result.sessionDir
    };
  } catch (err) {
    try {
      await updateScrapeStatus(restaurantId, { scrape_status: 'error' });
    } catch (_) {}

    console.error(`[SCRAPE_WORKER] ERROR: ${restaurantName} — ${err.message}`);
    throw err; // Let BullMQ handle retry
  }
}, {
  connection: redis,
  concurrency: 1,
  limiter: {
    max: 2,
    duration: 10000  // Max 2 jobs per 10 seconds
  }
});

scrapeWorker.on('failed', (job, err) => {
  console.error(`[SCRAPE_WORKER] Job failed: ${job?.data?.restaurantName} — ${err.message}`);
});

console.log(`[SCRAPE_WORKER] Running with concurrency=1, rate-limited...`);

export default scrapeWorker;
