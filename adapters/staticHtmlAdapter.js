// Adapter for static HTML restaurant sites
export default async function staticHtmlAdapter({ html, headers, restaurant }) {
  // ...extraction logic...
  return {
    restaurant,
    platform: 'static-html',
    sections: [],
    primaryItemCount: 0,
    modifierCount: 0,
    extractionMethod: 'static-html',
    confidence: 0
  };
}
