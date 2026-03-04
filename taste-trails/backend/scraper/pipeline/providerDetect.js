/**
 * Provider Detection
 *
 * Detect which menu platform/provider a restaurant uses based on URL and HTML content.
 * Returns provider name string or null.
 */

const PROVIDERS = [
  {
    name: 'Toast',
    urlPatterns: ['toasttab.com'],
    htmlIndicators: ['data-toast', 'toasttab.com', 'toast-restaurant', 'toastMeta'],
  },
  {
    name: 'Square',
    urlPatterns: ['square.site', 'squareup.com'],
    htmlIndicators: ['square.site', 'squareup.com', 'sq-widget', 'square-online'],
  },
  {
    name: 'Clover',
    urlPatterns: ['clover.com'],
    htmlIndicators: ['clover.com', 'data-clover', 'clover-online-ordering'],
  },
  {
    name: 'ChowNow',
    urlPatterns: ['chownow.com', 'ordering.chownow.com'],
    htmlIndicators: ['chownow.com', 'chownow', 'cn-ordering'],
  },
  {
    name: 'BentoBox',
    urlPatterns: ['getbento.com', 'bentobox.com'],
    htmlIndicators: ['getbento.com', 'bentobox', 'bento-menu', 'data-bento'],
  },
  {
    name: 'Popmenu',
    urlPatterns: ['popmenu.com'],
    htmlIndicators: ['popmenu.com', 'popmenu', 'pm-menu', 'data-popmenu'],
  },
];

export function detectProvider(html, url) {
  const lowerUrl = (url || '').toLowerCase();
  const lowerHtml = (html || '').toLowerCase();

  for (const provider of PROVIDERS) {
    // Check URL patterns
    for (const pattern of provider.urlPatterns) {
      if (lowerUrl.includes(pattern)) return provider.name;
    }

    // Check HTML indicators
    for (const indicator of provider.htmlIndicators) {
      if (lowerHtml.includes(indicator)) return provider.name;
    }
  }

  return null;
}

/**
 * Returns all detected providers (for cases where multiple are present).
 */
export function detectAllProviders(html, url) {
  const lowerUrl = (url || '').toLowerCase();
  const lowerHtml = (html || '').toLowerCase();
  const found = [];

  for (const provider of PROVIDERS) {
    const matched = provider.urlPatterns.some(p => lowerUrl.includes(p)) ||
      provider.htmlIndicators.some(i => lowerHtml.includes(i));
    if (matched) found.push(provider.name);
  }

  return found;
}
