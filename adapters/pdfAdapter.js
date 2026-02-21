// Adapter for PDF menu extraction
export default async function pdfAdapter({ buffer, headers, restaurant }) {
  // ...extraction logic...
  return {
    restaurant,
    platform: 'pdf',
    sections: [],
    primaryItemCount: 0,
    modifierCount: 0,
    extractionMethod: 'pdf',
    confidence: 0
  };
}
