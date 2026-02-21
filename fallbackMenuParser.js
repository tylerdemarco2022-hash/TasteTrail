const fs = require('fs');

function parseMenuFromText(rawText) {
  // Normalize input
  let lines = rawText
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => line !== 'Back to top')
    .filter(line => !/^add |^Add /.test(line));

  // Price regex
  const priceRegex = /^\$?\d{1,3}(\.\d{1,2})?$/;

  // Section header detection
  function isSectionHeader(line, nextLine) {
    if (priceRegex.test(line)) return false;
    if (line.length > 40) return false;
    if (line !== '' && line[0] === line[0].toUpperCase() && line.slice(1).toLowerCase() !== line.slice(1)) {
      // Title case check: first letter uppercase, rest not all lowercase
      if (nextLine && !priceRegex.test(nextLine)) return true;
    }
    return false;
  }

  let sections = [];
  let currentSection = { name: 'Uncategorized', items: [] };
  let priceMatches = 0;
  let totalItems = 0;
  let itemsPerSection = [];
  let avgDescriptionLength = 0;
  let descriptions = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    if (isSectionHeader(line, nextLine)) {
      if (currentSection.items.length) {
        sections.push(currentSection);
        itemsPerSection.push(currentSection.items.length);
      }
      currentSection = { name: line, items: [] };
      continue;
    }
    if (priceRegex.test(line)) {
      priceMatches++;
      // Find item name
      let itemName = lines[i - 1] || '';
      // Find description
      let description = '';
      if (nextLine && !priceRegex.test(nextLine) && !isSectionHeader(nextLine, lines[i + 2] || '')) {
        description = nextLine;
        descriptions.push(description);
      }
      currentSection.items.push({
        name: itemName,
        price: line,
        description
      });
      totalItems++;
    }
  }
  if (currentSection.items.length) {
    sections.push(currentSection);
    itemsPerSection.push(currentSection.items.length);
  }

  // Confidence calculation
  avgDescriptionLength = descriptions.length
    ? descriptions.reduce((a, b) => a + b.length, 0) / descriptions.length
    : 0;
  let confidenceScore = 0;
  if (priceMatches >= 20) confidenceScore += 0.4;
  if (totalItems >= 40) confidenceScore += 0.2;
  if (itemsPerSection.every(n => n >= 2)) confidenceScore += 0.2;
  if (avgDescriptionLength > 15) confidenceScore += 0.2;
  confidenceScore = Math.min(confidenceScore, 1.0);

  // Debug artifact
  const debugArtifact = {
    totalSections: sections.length,
    totalItems,
    itemsPerSection,
    first3Items: sections.flatMap(s => s.items).slice(0, 3),
    confidenceScore
  };
  fs.writeFileSync('debug_menu_output.json', JSON.stringify(debugArtifact, null, 2));

  return {
    totalSections: sections.length,
    totalItems,
    sections
  };
}

module.exports = { parseMenuFromText };