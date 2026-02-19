const axios = require('axios');
const pdf = require('pdf-parse');

async function parsePdfMenu(pdfUrl) {
  try {
    console.log('📄 Downloading PDF:', pdfUrl);

    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const dataBuffer = Buffer.from(response.data);
    console.log(`📊 PDF size: ${dataBuffer.length} bytes`);

    const pdfData = await pdf(dataBuffer);
    const rawText = pdfData.text;

    console.log(`✓ Extracted ${rawText.length} characters from PDF (${pdfData.numpages} pages)`);

    return {
      text: rawText,
      pageCount: pdfData.numpages,
      length: rawText.length,
      status: rawText.length > 200 ? 'success' : 'low_quality'
    };
  } catch (error) {
    console.error('❌ PDF Parsing Error:', error.message);
    throw error;
  }
}

function cleanMenuItems(items) {
  if (!Array.isArray(items)) return [];

  return items.filter(item => {
    if (!item || typeof item !== 'object') return false;

    const name = (item.name || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();

    // Filter out non-food items
    const excluded = [
      'copyright', 'www', 'phone', 'hours', 'address', 'toll-free',
      'email', 'fax', 'website', 'reservation', 'all rights reserved',
      'terms of service', 'privacy policy', 'printed', 'page'
    ];

    return (
      item.name && 
      item.name.length > 2 && 
      item.name.length < 100 &&
      !excluded.some(word => name.includes(word) || desc.includes(word))
    );
  });
}

function validateExtraction(extractedData) {
  const result = {
    isValid: true,
    warnings: [],
    requiresManualReview: false
  };

  // Check for critically low extraction
  if (extractedData.length < 200) {
    result.requiresManualReview = true;
    result.warnings.push('Very low text extraction - likely image-based PDF or extraction failure');
  }

  // Check if PDF had multiple pages but little text (image-only PDF)
  if (extractedData.pageCount > 3 && extractedData.length < 500) {
    result.requiresManualReview = true;
    result.warnings.push('Multi-page PDF with little extracted text - likely image-only');
  }

  if (result.warnings.length > 0) {
    result.isValid = false;
  }

  return result;
}

module.exports = {
  parsePdfMenu,
  cleanMenuItems,
  validateExtraction
};
