  const scrapeStart = Date.now();
  function logStage(stage, type, data) {
    if (type === 'start') console.log(`STAGE_START: ${stage}`);
    if (type === 'result') console.log(`STAGE_RESULT:`, data);
    if (type === 'error') console.log(`STAGE_ERROR:`, data);
  }
  let timing = { fetch_time_ms: 0, parse_time_ms: 0 };
  logStage('domain_detection', 'start');
  logStage('platform_detection', 'start');
  const fetchHtmlStart = Date.now();
  logStage('fetch_html', 'start');
  timing.fetch_time_ms = Date.now() - fetchHtmlStart;
  logStage('fetch_html', 'result', { fetch_time_ms: timing.fetch_time_ms });
  logStage('fetch_json', 'start');
  logStage('pdf_detection', 'start');
  const parseStart = Date.now();
  logStage('html_parse', 'start');
  timing.parse_time_ms = Date.now() - parseStart;
  logStage('html_parse', 'result', { parse_time_ms: timing.parse_time_ms });
  logStage('json_parse', 'start');
  logStage('section_extraction', 'start');
  logStage('item_extraction', 'start');
  logStage('price_extraction', 'start');
  logStage('confidence_calculation', 'start');
  // Log confidence details
  // (Moved to after 'result' is defined in runScrapePipeline)
  logStage('final_output', 'start');
  const scrapeEnd = Date.now();
  const total_scrape_time_ms = scrapeEnd - scrapeStart;
/**
 * Scrape Pipeline Orchestrator
 *
 * Executes the full scrape pipeline in order:
 * 1. URL Discovery (find best menu URL)
 * 2. Fetch HTML
 * 3. Bot/JS detection gate
 * 4. Provider detection + adapter fetch
 * 5. Structured data extraction (JSON-LD, app state, API hints)
 * 6. Headless render fallback (if bot-blocked or structured failed on dynamic page)
 * 7. DOM heuristics extraction
 * 8. Confidence scoring
 * 9. Scrape artifacts (debug dump)
 * 10. Persistence + safety
 */

import { discoverRestaurantURL } from '../../services/urlDiscovery.js';
import { detectBotOrJsBlock } from './botDetection.js';
import { extractStructuredData } from './structuredExtract.js';
import { detectProvider } from './providerDetect.js';
import { fetchProviderMenu } from './providerAdapters.js';
import { renderHeadless } from './headlessRender.js';
import { extractDomItems } from './domExtract.js';
import { computeConfidence } from './confidenceScore.js';
import { startScrapeSession, saveArtifact, saveJsonArtifact } from './scrapeArtifacts.js';
import { updateScrapeStatus, saveMenuUrl } from './persistence.js';
import { supabase } from '../../supabase.js';
import { classifyRestaurant } from '../../../server/utils/classifyRestaurant.js';
import { logger } from '../../utils/logger.js';

const REQUEST_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Menu container selectors that might contain images instead of text
const IMAGE_MENU_SELECTORS = [
  '[class*="menu"]', '[class*="Menu"]', '[id*="menu"]',
  '[class*="food"]', '[class*="dish"]', 'main', 'article'
];

/**
 * Detect if the page uses image-based menus (photos of menus instead of text).
 * Looks for <img> tags inside menu containers with dimensions suggesting menu images.
 */
function detectImageMenu(html) {
  const lowerHtml = html.toLowerCase();

  // Count images inside menu-ish containers
  let menuImageCount = 0;

  for (const selector of IMAGE_MENU_SELECTORS) {
    // Extract the attribute and value from the selector
    const attrMatch = selector.match(/\[(\w+)\*="(\w+)"\]/);
    if (attrMatch) {
      const [, attr, val] = attrMatch;
      // Find containers with this attribute containing the value
      const containerPattern = new RegExp(
        `<[^>]+${attr}\\s*=\\s*["'][^"']*${val}[^"']*["'][^>]*>([\\s\\S]*?)(?=<\\/div>|<\\/section>|<\\/main>|<\\/article>)`,
        'gi'
      );
      let match;
      while ((match = containerPattern.exec(lowerHtml)) !== null) {
        const containerHtml = match[1];
        // Count <img> tags in this container
        const imgMatches = containerHtml.match(/<img\b/g);
        if (imgMatches) {
          menuImageCount += imgMatches.length;
        }
      }
    } else if (['main', 'article'].includes(selector)) {
      const tagPattern = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
      let match;
      while ((match = tagPattern.exec(lowerHtml)) !== null) {
        const imgMatches = match[1].match(/<img\b/g);
        if (imgMatches) {
          menuImageCount += imgMatches.length;
        }
      }
    }
  }

  // Also check for common image-menu patterns
  const hasMenuImageClass = /class\s*=\s*["'][^"']*(menu[_-]?image|menu[_-]?photo|menu[_-]?pdf|menu[_-]?img)[^"']*["']/i.test(html);
  const hasPdfEmbed = /<(embed|iframe|object)[^>]+(\.pdf|application\/pdf)/i.test(html);

  // Heuristic: if >= 2 images in menu containers OR has menu-image class OR has PDF embed
  return menuImageCount >= 2 || hasMenuImageClass || hasPdfEmbed;
}

async function fetchHtml(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': REQUEST_USER_AGENT }
    });
    const finalUrl = res.url || url;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const html = await res.text();
    return { html, finalUrl, contentType, status: res.status, error: null };
  } catch (err) {
    return { html: '', finalUrl: url, contentType: '', status: null, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Run the full scrape pipeline for a restaurant.
 * @param {string} restaurantName - Restaurant name
 * @param {object} options - { restaurantId, jobType }
 * @returns {object} { normalizedItems, confidence, confidenceComponents, sourceUrl, provider, failReason, sessionDir }
 */
export async function runScrapePipeline(restaurantName, options = {}) {
  const { restaurantId, jobType = 'initial_scrape' } = options;
  const startTime = Date.now();

  // Start debug session
  const domain = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const { sessionId, baseDir } = startScrapeSession(domain);

  const result = {
    normalizedItems: [],
    confidence: 0,
    confidenceComponents: null,
    sourceUrl: null,
    provider: null,
    failReason: null,
    sessionDir: baseDir,
    sessionId
  };

  try {
    // ── STEP 1: URL Discovery (DB-first) ──
    logger.info({ event: 'pipeline_start', restaurantName, jobType, sessionId });

    // Check if admin has already saved a menu URL for this restaurant
    let menuUrl = null;
    let discovery = null;
    let urlFromDb = false;

    if (restaurantId) {
      try {
        console.log('[PIPELINE] Awaiting supabase DB lookup...');
        const { data: row } = await supabase
          .from('restaurants')
          .select('dinner_url, lunch_url, drinks_url, pdf_url, breakfast_url, website')
          .eq('id', restaurantId)
          .single();
        console.log('[PIPELINE] DB lookup complete.');

        if (row) {
          menuUrl = row.dinner_url
            || row.lunch_url
            || row.drinks_url
            || row.pdf_url
            || row.breakfast_url
            || row.website;
        }
      } catch (dbErr) {
        console.log('[PIPELINE] DB lookup error:', dbErr.message);
      }

      if (menuUrl) {
        urlFromDb = true;
        logger.info({ event: 'url_from_db', restaurantId, menuUrl });
        console.log('[PIPELINE] USING_SAVED_URL:', menuUrl);
        saveJsonArtifact(baseDir, 'discovery.json', { method: 'db_saved', url: menuUrl });
      }
    }

    if (!menuUrl) {
      console.log('[PIPELINE] Awaiting discoverRestaurantURL...');
      discovery = await discoverRestaurantURL(restaurantName);
      console.log('[PIPELINE] discoverRestaurantURL complete.');
      menuUrl = discovery?.url;
      // Force dinner menu extraction if /menus is detected
      if (menuUrl && menuUrl.includes('/menus') && !menuUrl.includes('/menus/dinner')) {
        menuUrl = menuUrl.replace(/\/menus(\/)?$/, '/menus/dinner');
        console.log('[PIPELINE] FORCED_DINNER_MENU_URL:', menuUrl);
      }
      saveJsonArtifact(baseDir, 'discovery.json', discovery);
    }

    console.log("[PIPELINE] URL_DISCOVERY_DONE");
    if (!menuUrl) {
      result.failReason = 'url_discovery_failed';
      logger.warn({ event: 'url_discovery_failed', restaurantName, sessionId, report: discovery?.confidence_report });
      console.log("[PIPELINE] URL_DISCOVERY_FAILED");
      console.log("[PIPELINE] FINAL_RESULT", result);
      return result;
    }
    result.sourceUrl = menuUrl;
    result.urlFromDb = urlFromDb;
    saveArtifact(baseDir, 'request_url.txt', menuUrl);
    // ── STEP 2: Fetch HTML ──
    console.log('[PIPELINE] Awaiting fetchHtml:', menuUrl);
    const fetchResult = await fetchHtml(menuUrl);
    console.log('[PIPELINE] fetchHtml complete.');
    saveArtifact(baseDir, 'final_url.txt', fetchResult.finalUrl);
    console.log("[PIPELINE] FETCH_DONE");
    if (fetchResult.error || !fetchResult.html) {
      result.failReason = `fetch_failed: ${fetchResult.error || 'empty response'}`;
      saveJsonArtifact(baseDir, 'debug.json', { step: 'fetch', error: fetchResult.error });
      console.log("[PIPELINE] FETCH_FAILED");
      console.log("[PIPELINE] FINAL_RESULT", result);
      return result;
    }
    saveArtifact(baseDir, 'html_raw.html', fetchResult.html);
    let html = fetchResult.html;
    let usedHeadless = false;

    // ── STEP 3: Bot/JS Detection Gate ──
    console.log('[PIPELINE] Awaiting detectBotOrJsBlock...');
    const botResult = detectBotOrJsBlock(html);
    console.log('[PIPELINE] detectBotOrJsBlock complete.');
    let needsHeadless = botResult.BOT_OR_JS_BLOCK;
    console.log("[PIPELINE] BOT_CHECK_DONE");
    // ── STEP 4: Provider Detection ──
    console.log('[PIPELINE] Awaiting detectProvider...');
    const provider = detectProvider(html, menuUrl);
    console.log('[PIPELINE] detectProvider complete.');
    result.provider = provider;
    console.log("[PIPELINE] PROVIDER_DETECT_DONE");

    if (provider) {
      logger.info({ event: 'provider_detected', provider, restaurantName, sessionId });
      // Try provider adapter first
      try {
        console.log('[PIPELINE] Awaiting fetchProviderMenu...');
        const providerItems = await fetchProviderMenu(provider, menuUrl, html);
        console.log('[PIPELINE] fetchProviderMenu complete.');
        console.log("[PIPELINE] STRUCTURED_EXTRACT_DONE", providerItems.length);
        if (providerItems.length >= 10) {
          result.normalizedItems = providerItems;
          const conf = computeConfidence({ items: providerItems, source: 'provider', provider });
          result.confidence = conf.confidence;
          result.confidenceComponents = conf;
          saveJsonArtifact(baseDir, 'parse_result.json', { source: 'provider', provider, items: providerItems });
          saveJsonArtifact(baseDir, 'debug.json', {
            provider, botFlags: botResult, confidenceComponents: conf,
            elapsedMs: Date.now() - startTime
          });
          console.log("[PIPELINE] FINAL_RESULT", result);
          return result;
        }
      } catch (adapterErr) {
        logger.warn({ event: 'provider_adapter_failed', provider, error: adapterErr.message, sessionId });
        // Fall through to other extraction methods
      }
    }

    // ── STEP 5: Structured Data Extraction ──
    if (!needsHeadless) {
      console.log('[PIPELINE] Awaiting extractStructuredData...');
      const structuredItems = extractStructuredData(html);
      console.log('[PIPELINE] extractStructuredData complete.');
      console.log("[PIPELINE] STRUCTURED_EXTRACT_DONE", structuredItems.length);
      if (structuredItems.length >= 10) {
        result.normalizedItems = structuredItems;
        const conf = computeConfidence({ items: structuredItems, source: 'structured' });
        result.confidence = conf.confidence;
        result.confidenceComponents = conf;
        saveJsonArtifact(baseDir, 'parse_result.json', { source: 'structured', items: structuredItems });
        saveJsonArtifact(baseDir, 'debug.json', {
          provider, botFlags: botResult, confidenceComponents: conf,
          elapsedMs: Date.now() - startTime
        });
        console.log("[PIPELINE] FINAL_RESULT", result);
        return result;
      }
    }

    // ── STEP 6: Headless Render Fallback ──
    if (needsHeadless) {
      logger.info({ event: 'headless_fallback', reason: botResult.reason, restaurantName, sessionId });
      try {
        html = await renderHeadless(menuUrl, baseDir);
        usedHeadless = true;
        console.log("[PIPELINE] HEADLESS_DONE");
        // Re-try structured extraction on rendered HTML
        const structuredItems = extractStructuredData(html);
        console.log("[PIPELINE] STRUCTURED_EXTRACT_DONE", structuredItems.length);
        if (structuredItems.length >= 10) {
          result.normalizedItems = structuredItems;
          const conf = computeConfidence({ items: structuredItems, source: 'structured_headless' });
          result.confidence = conf.confidence;
          result.confidenceComponents = conf;
          saveJsonArtifact(baseDir, 'parse_result.json', { source: 'structured_headless', items: structuredItems });
          saveJsonArtifact(baseDir, 'debug.json', {
            provider, botFlags: botResult, confidenceComponents: conf,
            usedHeadless: true, elapsedMs: Date.now() - startTime
          });
          console.log("[PIPELINE] FINAL_RESULT", result);
          return result;
        }
      } catch (headlessErr) {
        logger.warn({ event: 'headless_failed', error: headlessErr.message, sessionId });
        // Continue with whatever HTML we have
      }
    }

    // ── STEP 7: DOM Heuristics Extraction ──
    const domResult = extractDomItems(html);
    const domItems = domResult.items || [];
    console.log("[PIPELINE] DOM_EXTRACT_DONE", domItems.length);
    if (domItems.length > 0) {
      result.normalizedItems = domItems;
    }

    // ── STEP 8: Confidence Scoring ──
    const conf = computeConfidence({
      items: result.normalizedItems,
      source: usedHeadless ? 'dom_headless' : 'dom',
      sections: domResult.sections
    });
    result.confidence = conf.confidence;
    result.confidenceComponents = conf;
    console.log("[PIPELINE] CONFIDENCE_CALCULATED", result.confidence);

    if (result.normalizedItems.length === 0) {
      result.failReason = 'no_items_extracted';
      console.log("[PIPELINE] FINAL_RESULT", result);
    }

    // ── STEP 8b: Image-Based Menu Detection ──
    // If headless rendered but extraction yielded < 5 items, check for image menus
    if (usedHeadless && result.normalizedItems.length < 5) {
      const isImageMenu = detectImageMenu(html);
        if (isImageMenu) {
          // Collect menu image URLs
          const imageUrlMatches = [];
          const imgTagRegex = /<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi;
          let match;
          while ((match = imgTagRegex.exec(html)) !== null) {
            imageUrlMatches.push(match[1]);
          }
          result.menuImageUrls = imageUrlMatches;
          // Attempt OCR (stub, replace with real OCR integration)
          let ocrResults = [];
          // Example: Use Tesseract.js or external OCR API here
          // for (const url of imageUrlMatches) {
          //   const ocrText = await runOcrOnImage(url);
          //   ocrResults.push({ url, text: ocrText });
          // }
          result.menuImageOcr = ocrResults;
          // Save artifacts
          saveJsonArtifact(baseDir, 'menu_image_urls.json', imageUrlMatches);
          saveJsonArtifact(baseDir, 'menu_image_ocr.json', ocrResults);
          result.failReason = 'image_menu';
          result.confidence = 0.2;
          logger.info({ event: 'image_menu_detected', restaurantName, sessionId, itemCount: result.normalizedItems.length, imageCount: imageUrlMatches.length });
          console.log("[PIPELINE] IMAGE_MENU_URLS", imageUrlMatches);
          console.log("[PIPELINE] IMAGE_MENU_OCR", ocrResults);
          console.log("[PIPELINE] FINAL_RESULT", result);
          return result;
        }
    }

    // ── STEP 9: Save Artifacts ──
    saveJsonArtifact(baseDir, 'parse_result.json', {
      source: usedHeadless ? 'dom_headless' : 'dom',
      items: result.normalizedItems,
      sections: domResult.sections,
      rejectionReasons: domResult.rejectionReasons
    });
    saveJsonArtifact(baseDir, 'debug.json', {
      provider,
      botFlags: botResult,
      confidenceComponents: conf,
      usedHeadless,
      domSections: domResult.sections?.length || 0,
      domRejections: domResult.rejectionReasons,
      elapsedMs: Date.now() - startTime
    });

    // ── STEP 10: Classification & Persistence ──
    if (restaurantId && result.normalizedItems.length > 0) {
      // Compose menuItems for classification
      const menuItems = result.normalizedItems.map(item => ({
        name: item.name,
        description: item.description
      }));
      // Use description from discovery if available
      const description = (discovery && discovery.description) || '';
      const classification = classifyRestaurant({
        name: restaurantName,
        description,
        menuItems
      });
      // Persist service_model and cuisine_tags
      await updateScrapeStatus(restaurantId, {
        service_model: classification.service_model,
        cuisine_tags: classification.cuisine_tags.join(',')
      });
      logger.info({ event: 'classification_persisted', restaurantId, service_model: classification.service_model, cuisine_tags: classification.cuisine_tags });
    }
    console.log("[PIPELINE] PERSISTENCE_DONE");
    console.log("[PIPELINE] FINAL_RESULT", result);
    return result;
  } catch (err) {
    result.failReason = `pipeline_error: ${err.message}`;
    logger.error({ event: 'pipeline_error', restaurantName, sessionId, error: err.message, stack: err.stack });
    try {
      saveJsonArtifact(baseDir, 'debug.json', { error: err.message, stack: err.stack });
    } catch (_) {}
    return result;
  }
}
