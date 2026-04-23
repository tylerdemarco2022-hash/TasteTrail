/**
 * BullMQ Queue Setup
 *
 * Provides addScrapeJob() for enqueuing scrape jobs from the API routes.
 * Gracefully handles Redis connection failures so the API doesn't crash.
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';

let redis = null;
let menuScrapeQueue = null;

try {
  redis = new Redis({
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 500, 5000)
  });

  redis.on('error', (err) => {
    console.error(`[QUEUE] Redis error: ${err.message}`);
  });

  menuScrapeQueue = new Queue('menuScrapeQueue', { connection: redis });
} catch (err) {
  console.error(`[QUEUE] Failed to initialize Redis/BullMQ: ${err.message}`);
}

export { menuScrapeQueue };

export async function addScrapeJob({ restaurantId, restaurantName, jobType }) {
  if (!menuScrapeQueue) {
    console.warn('[QUEUE] Queue not available — Redis may be down. Skipping job.');
    return null;
  }

  return menuScrapeQueue.add(jobType, { restaurantId, restaurantName, jobType }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 50
  });
}

/**
 * Enqueue an OCR job for an image-based menu restaurant.
 * Only enqueues if scrape_status is 'image_menu'.
 * This does NOT run automatically — it must be triggered manually (e.g., from admin panel).
 */
export async function addOcrJob({ restaurantId, restaurantName }) {
  if (!menuScrapeQueue) {
    console.warn('[QUEUE] Queue not available — Redis may be down. Skipping OCR job.');
    return null;
  }

  return menuScrapeQueue.add('ocr_image_menu', {
    restaurantId,
    restaurantName,
    jobType: 'ocr_image_menu'
  }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: 50,
    removeOnFail: 25
  });
}
