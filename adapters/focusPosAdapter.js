// Adapter for Focus POS-powered restaurant sites
export default async function focusPosAdapter({ html, headers, restaurant }) {
  // ...extraction logic...
  return {
    restaurant,
    platform: 'focuspos',
    sections: [],
    primaryItemCount: 0,
    modifierCount: 0,
    extractionMethod: 'focuspos',
    confidence: 0
  };
}
