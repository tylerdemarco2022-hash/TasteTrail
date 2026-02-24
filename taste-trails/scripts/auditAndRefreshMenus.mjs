import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverRestaurantURL } from '../backend/services/urlDiscovery.js';
import { scrapeMenu } from '../backend/scraper/menuScraperAgent.js';
import {
  flattenScrapedMenuItems,
  sanitizeMenuItems,
  buildMenuCompletenessReport,
  passesMenuCompleteness
} from '../backend/services/menuQuality.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const RESTAURANTS_DIR = path.join(ROOT_DIR, 'backend', 'restaurants');
const REPORT_PATH = path.join(RESTAURANTS_DIR, '_menu_quality_report.json');

const DEFAULT_MIN_URL_CONFIDENCE = 0.8;
const DEFAULT_MIN_SCRAPE_CONFIDENCE = 0.8;
const DEFAULT_MIN_MENU_COMPLETENESS = 0.65;
const DEFAULT_MIN_MENU_ITEMS = 12;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumberFlag(name, fallback) {
  const arg = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = Number(arg.split('=').slice(1).join('='));
  return Number.isFinite(value) ? value : fallback;
}

function parseIntegerFlag(name, fallback) {
  const value = parseNumberFlag(name, fallback);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function parseMinFromEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, 0, 1);
}

function normalizeRestaurantName(dirName = '') {
  return String(dirName)
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function shouldProcessRestaurant({
  forceAll,
  existingItems,
  existingMeta,
  existingCompleteness,
  minScrapeConfidence,
  minMenuCompleteness,
  minMenuItems
}) {
  if (forceAll) return true;
  const scrapeConfidence = Number(existingMeta?.scrape_confidence);
  const hasGoodScrapeConfidence =
    Number.isFinite(scrapeConfidence) && scrapeConfidence >= minScrapeConfidence;
  const menuLooksComplete = passesMenuCompleteness(
    existingCompleteness,
    minMenuCompleteness,
    minMenuItems
  );
  const hasEnoughItems = Array.isArray(existingItems) && existingItems.length >= minMenuItems;
  return !(hasGoodScrapeConfidence && menuLooksComplete && hasEnoughItems);
}

function isImprovedResult({
  existingItems,
  existingCompleteness,
  nextItems,
  nextCompleteness
}) {
  const existingCount = Array.isArray(existingItems) ? existingItems.length : 0;
  const nextCount = Array.isArray(nextItems) ? nextItems.length : 0;
  const existingScore = Number(existingCompleteness?.score || 0);
  const nextScore = Number(nextCompleteness?.score || 0);
  if (nextCount > existingCount + 2) return true;
  if (nextScore >= existingScore + 0.03) return true;
  return existingCount === 0 && nextCount > 0;
}

async function run() {
  const forceAll = process.argv.includes('--all');
  const dryRun = process.argv.includes('--dry-run');
  const limit = parseIntegerFlag('limit', 0);

  const minUrlConfidence = parseMinFromEnv('MIN_URL_CONFIDENCE', DEFAULT_MIN_URL_CONFIDENCE);
  const minScrapeConfidence = parseMinFromEnv('MIN_SCRAPE_CONFIDENCE', DEFAULT_MIN_SCRAPE_CONFIDENCE);
  const minMenuCompleteness = parseMinFromEnv('MIN_MENU_COMPLETENESS', DEFAULT_MIN_MENU_COMPLETENESS);
  const minMenuItems = Math.max(
    1,
    parseIntegerFlag('min-items', Number(process.env.MIN_MENU_ITEMS || DEFAULT_MIN_MENU_ITEMS))
  );

  const dirs = fs.readdirSync(RESTAURANTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const toProcess = limit > 0 ? dirs.slice(0, limit) : dirs;
  const results = [];

  for (const dirName of toProcess) {
    const displayName = normalizeRestaurantName(dirName);
    const dirPath = path.join(RESTAURANTS_DIR, dirName);
    const menuPath = path.join(dirPath, 'menu.json');
    const metaPath = path.join(dirPath, 'menu.meta.json');

    const existingMenuRaw = readJsonIfExists(menuPath);
    const existingMeta = readJsonIfExists(metaPath);
    const existingItems = sanitizeMenuItems(Array.isArray(existingMenuRaw) ? existingMenuRaw : []);
    const existingCompleteness = buildMenuCompletenessReport({
      items: existingItems,
      scrapeConfidence: Number(existingMeta?.scrape_confidence),
      urlConfidence: Number(existingMeta?.url_confidence)
    });

    const needsRefresh = shouldProcessRestaurant({
      forceAll,
      existingItems,
      existingMeta,
      existingCompleteness,
      minScrapeConfidence,
      minMenuCompleteness,
      minMenuItems
    });

    if (!needsRefresh) {
      results.push({
        restaurant: displayName,
        status: 'skipped_healthy',
        existing_item_count: existingItems.length,
        existing_menu_completeness: Number(existingCompleteness.score || 0)
      });
      continue;
    }

    const row = {
      restaurant: displayName,
      status: 'failed',
      existing_item_count: existingItems.length,
      existing_menu_completeness: Number(existingCompleteness.score || 0),
      min_url_confidence: minUrlConfidence,
      min_scrape_confidence: minScrapeConfidence,
      min_menu_completeness: minMenuCompleteness,
      min_menu_items: minMenuItems
    };

    try {
      const discovery = await discoverRestaurantURL(displayName);
      row.discovery_method = discovery?.method || null;
      row.url = discovery?.url || null;
      row.url_confidence = Number(discovery?.confidence || 0);
      row.url_confidence_report = discovery?.confidence_report || null;

      if (!discovery?.url) {
        row.status = 'failed_no_url';
        results.push(row);
        continue;
      }
      if (row.url_confidence < minUrlConfidence) {
        row.status = 'failed_low_url_confidence';
        results.push(row);
        continue;
      }

      const scraped = await scrapeMenu(discovery.url);
      const scrapeConfidence = Number(scraped?.confidence || 0);
      const nextItems = sanitizeMenuItems(flattenScrapedMenuItems(scraped));
      const nextCompleteness = buildMenuCompletenessReport({
        items: nextItems,
        scrapeConfidence,
        urlConfidence: row.url_confidence
      });

      row.scrape_confidence = scrapeConfidence;
      row.scrape_confidence_report = scraped?.confidence_report || null;
      row.next_item_count = nextItems.length;
      row.next_menu_completeness = Number(nextCompleteness.score || 0);

      const completeEnough = passesMenuCompleteness(
        nextCompleteness,
        minMenuCompleteness,
        minMenuItems
      );
      const scrapePass = Number.isFinite(scrapeConfidence) && scrapeConfidence >= minScrapeConfidence;
      if (!scrapePass) {
        row.status = 'failed_low_scrape_confidence';
        results.push(row);
        continue;
      }
      if (!completeEnough) {
        row.status = 'failed_low_menu_completeness';
        results.push(row);
        continue;
      }

      const improved = isImprovedResult({
        existingItems,
        existingCompleteness,
        nextItems,
        nextCompleteness
      });

      if (!improved && !forceAll) {
        row.status = 'skipped_not_improved';
        results.push(row);
        continue;
      }

      row.status = dryRun ? 'dry_run_would_update' : 'updated';
      results.push(row);

      if (!dryRun) {
        fs.mkdirSync(dirPath, { recursive: true });
        writeJson(menuPath, nextItems);
        writeJson(metaPath, {
          source_url: discovery.url,
          url_confidence: row.url_confidence,
          url_discovery_method: discovery.method || null,
          scrape_confidence: scrapeConfidence,
          scrape_confidence_report: scraped?.confidence_report || null,
          menu_completeness_score: Number(nextCompleteness.score || 0),
          menu_completeness_report: nextCompleteness,
          min_scrape_confidence: minScrapeConfidence,
          min_menu_completeness: minMenuCompleteness,
          min_menu_items: minMenuItems,
          updated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      row.status = 'failed_exception';
      row.error = error?.message || String(error);
      results.push(row);
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    total_restaurants: toProcess.length,
    force_all: forceAll,
    dry_run: dryRun,
    min_url_confidence: minUrlConfidence,
    min_scrape_confidence: minScrapeConfidence,
    min_menu_completeness: minMenuCompleteness,
    min_menu_items: minMenuItems,
    counts: {
      updated: results.filter((row) => row.status === 'updated').length,
      dry_run_would_update: results.filter((row) => row.status === 'dry_run_would_update').length,
      skipped_healthy: results.filter((row) => row.status === 'skipped_healthy').length,
      skipped_not_improved: results.filter((row) => row.status === 'skipped_not_improved').length,
      failed: results.filter((row) => String(row.status || '').startsWith('failed')).length
    },
    results
  };

  writeJson(REPORT_PATH, summary);
  console.log(`Audit complete. Report saved to ${REPORT_PATH}`);
  console.log(JSON.stringify(summary.counts, null, 2));
}

run().catch((error) => {
  console.error('auditAndRefreshMenus failed:', error?.message || error);
  process.exitCode = 1;
});
