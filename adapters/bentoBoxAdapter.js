// Adapter for BentoBox-powered restaurant sites
export default async function bentoBoxAdapter({ html, headers, restaurant }) {
  // ...extraction logic...
  return {
    restaurant,
    platform: 'bentobox',
    sections: [],
    primaryItemCount: 0,
    modifierCount: 0,
    extractionMethod: 'bentobox',
    confidence: 0
  };
}
