// Adapter for WordPress-powered restaurant sites

import { extractStructuredMenu } from '../agents/menuScraperAgent.js';

export async function wordPressAdapter({ html, headers, scripts, restaurant }) {
  // TEMP: fallback to JS-rendered extraction logic (unified engine)
  // If you add WordPress-specific logic, put it above this fallback
  let sections = [];
  let extractionMethod = 'js-rendered';
  let confidence = 0;
  let primaryItemCount = 0;
  let modifierCount = 0;

  if (html && typeof html === 'string') {
    try {
      sections = extractStructuredMenu(html);
      extractionMethod = 'js-rendered';
      for (const sec of sections) {
        if (Array.isArray(sec.items)) {
          primaryItemCount += sec.items.length;
          for (const item of sec.items) {
            if (item.modifiers && Array.isArray(item.modifiers)) {
              modifierCount += item.modifiers.length;
            }
          }
        }
      }
      if (primaryItemCount >= 10 && sections.length >= 2) confidence = 80;
      else if (primaryItemCount >= 5) confidence = 50;
      else confidence = 20;
    } catch (err) {
      console.error('[WORDPRESS_ADAPTER_EXTRACTION_ERROR]', err);
      sections = [];
      confidence = 0;
    }
  }

  return {
    restaurant,
    platform: 'wordpress',
    sections,
    primaryItemCount,
    modifierCount,
    extractionMethod,
    confidence
  };
}
