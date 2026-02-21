// Platform detection logic for menu extraction
// Returns { platform, confidence, signals }

export function detectPlatform({ html = '', headers = {}, scripts = [], url = '' }) {
  let platform = 'unknown';
  let confidence = 0;
  let signals = [];
  // --- HOSTING PLATFORM DETECTION (never used for routing) ---
  if (html.includes('wp-content') || html.includes('wp-json') || scripts.some(s => /wp-/.test(s))) {
    signals.push('hosting:wordpress');
  }
  if (html.includes('wix.com')) {
    signals.push('hosting:wix');
  }
  if (html.includes('squarespace')) {
    signals.push('hosting:squarespace');
  }
  const htmlLower = html.toLowerCase();
  const urlLower = url.toLowerCase();
  // PDF
  if (urlLower.endsWith('.pdf')) {
    platform = 'pdf';
    confidence = 100;
    signals.push('url:endsWith.pdf');
    return { platform, confidence, signals };
  }
  // WORDPRESS (never route to this as menu platform)
  let wpSignals = 0;
  if (htmlLower.includes('wp-content')) {
    wpSignals += 40;
    signals.push('html:wp-content');
  }
  if (htmlLower.includes('wp-json')) {
    wpSignals += 40;
    signals.push('html:wp-json');
  }
  if (Object.entries(headers).some(([k, v]) => k.toLowerCase() === 'x-powered-by' && String(v).toLowerCase().includes('wordpress'))) {
    wpSignals += 40;
    signals.push('header:x-powered-by-wordpress');
  }
  if (scripts.some(s => /\/wp-/.test(s))) {
    wpSignals += 40;
    signals.push('script:/wp-');
  }
  if (wpSignals > 0) {
    // Only mark as hosting, never as menu platform
    return { platform: 'wordpress', confidence: Math.min(100, wpSignals), signals };
  }
  // TOAST
  if (urlLower.includes('toasttab')) {
    platform = 'toast';
    confidence = 60;
    signals.push('url:toasttab');
    return { platform, confidence, signals };
  }
  if (scripts.some(s => s.toLowerCase().includes('toasttab'))) {
    platform = 'toast';
    confidence = 60;
    signals.push('script:toasttab');
    return { platform, confidence, signals };
  }
  // FOCUSPOS
  if (urlLower.includes('focuspos')) {
    platform = 'focuspos';
    confidence = 60;
    signals.push('url:focuspos');
    return { platform, confidence, signals };
  }
  if (scripts.some(s => s.toLowerCase().includes('focuspos'))) {
    platform = 'focuspos';
    confidence = 60;
    signals.push('script:focuspos');
    return { platform, confidence, signals };
  }
  // BENTOBOX
  if (scripts.some(s => s.toLowerCase().includes('bentobox'))) {
    platform = 'bentobox';
    confidence = 60;
    signals.push('script:bentobox');
    return { platform, confidence, signals };
  }
  if (htmlLower.includes('powered by bentobox')) {
    platform = 'bentobox';
    confidence = 60;
    signals.push('html:powered-by-bentobox');
    return { platform, confidence, signals };
  }
  // SHOPIFY
  let shopifySignals = 0;
  if (htmlLower.includes('cdn.shopify.com')) {
    shopifySignals += 50;
    signals.push('html:cdn.shopify.com');
  }
  if (html.includes('Shopify.theme')) {
    shopifySignals += 50;
    signals.push('html:Shopify.theme');
  }
  if (shopifySignals > 0) {
    platform = 'shopify';
    confidence = Math.min(100, shopifySignals);
    return { platform, confidence, signals };
  }
  // STATIC
  const majorFrameworks = [
    'react', 'angular', 'vue', 'svelte', 'next', 'nuxt', 'gatsby', 'ember', 'backbone', 'meteor', 'preact', 'alpinejs', 'solidjs', 'remix', 'astro'
  ];
  if (!majorFrameworks.some(fw => htmlLower.includes(fw)) && html.length > 3000) {
    platform = 'static';
    confidence = 40;
    signals.push('static:html-length>3000');
    return { platform, confidence, signals };
  }
  // UNKNOWN
  return { platform, confidence, signals };
}
