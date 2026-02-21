// Adapter for Toast POS-powered restaurant sites
export default async function toastAdapter({ html, headers, restaurant }) {
  // ...extraction logic...
  return {
    restaurant,
    platform: 'toast',
    sections: [],
    primaryItemCount: 0,
    modifierCount: 0,
    extractionMethod: 'toast',
    confidence: 0
  };
}
