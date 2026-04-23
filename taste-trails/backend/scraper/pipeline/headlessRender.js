/**
 * Headless Render Fallback (Playwright)
 *
 * Only used when:
 * - Bot/JS block detected
 * - Structured extraction failed and page appears dynamic
 *
 * Renders the page, waits for networkidle + menu-ish selector, extracts HTML.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const MENU_SELECTORS = [
  '[class*="menu"]',
  '[class*="Menu"]',
  '[id*="menu"]',
  '[class*="dish"]',
  '[class*="food"]',
  '[class*="item"]',
  'table',
  'ul',
  'article',
];

/**
 * Render a URL headlessly and return the fully rendered HTML.
 * @param {string} url - URL to render
 * @param {string} sessionDir - Directory to save rendered HTML artifact
 * @param {object} options - { timeout }
 * @returns {string} Rendered HTML
 */
export async function renderHeadless(url, sessionDir, options = {}) {
  const { timeout = 30000 } = options;
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-gpu', '--no-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });

    // Only block images/fonts — keep CSS so Cloudflare challenges can render
    await context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2}', route => route.abort());

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(timeout);

    // Use domcontentloaded first, then wait separately for idle
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    // Wait for network to settle (but don't fail if it doesn't)
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (_) {
      // Network didn't go idle — page might have persistent connections
    }

    // Wait for a menu-ish element to appear
    for (const selector of MENU_SELECTORS) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        break;
      } catch (_) {
        // Try next selector
      }
    }

    // Small extra wait for lazy-loaded content
    await page.waitForTimeout(1000);

    const html = await page.content();

    // Save rendered HTML artifact
    if (sessionDir) {
      try {
        fs.writeFileSync(path.join(sessionDir, 'html_rendered.html'), html);
      } catch (_) {}
    }

    await browser.close();
    browser = null;

    return html;
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    throw err;
  }
}
