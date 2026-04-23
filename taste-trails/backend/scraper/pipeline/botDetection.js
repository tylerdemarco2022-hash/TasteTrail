/**
 * Bot/JS Detection Gate
 *
 * After fetching HTML, detect if the page is bot-blocked or requires JS rendering.
 * If html.length < 1500 OR contains bot indicators → BOT_OR_JS_BLOCK = true
 * Caller should use headless render fallback when true.
 */

const BOT_INDICATORS = [
  'enable javascript',
  'you need to enable javascript',
  'please enable javascript',
  'cloudflare',
  'cf-browser-verification',
  'access denied',
  'captcha',
  'are you a robot',
  'are you human',
  'checking your browser',
  'just a moment',
  'please verify you are a human',
  'bot protection',
  'ddos protection',
  'security check',
];

export function detectBotOrJsBlock(html) {
  if (!html || typeof html !== 'string') {
    return { BOT_OR_JS_BLOCK: true, reason: 'No HTML content' };
  }

  if (html.length < 1500) {
    return { BOT_OR_JS_BLOCK: true, reason: `HTML too short (${html.length} bytes)` };
  }

  const lowerHtml = html.toLowerCase();

  for (const indicator of BOT_INDICATORS) {
    if (lowerHtml.includes(indicator)) {
      return { BOT_OR_JS_BLOCK: true, reason: `Found indicator: ${indicator}` };
    }
  }

  // Check for empty body with only script tags (JS-rendered SPA)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyContent = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').trim();
    if (bodyContent.length < 200) {
      return { BOT_OR_JS_BLOCK: true, reason: 'Body content too small after removing scripts (likely SPA)' };
    }
  }

  return { BOT_OR_JS_BLOCK: false, reason: null };
}
