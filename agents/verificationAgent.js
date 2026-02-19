const logger = require('../services/logger');
const metrics = require('../services/metrics');

function scoreVerification(menu, restaurant) {
  let score = 0;
  const reasons = [];

  // Domain matches restaurant name (weak check)
  if (restaurant.website && restaurant.name) {
    try {
      const domain = new URL(restaurant.website).hostname.toLowerCase();
      if (restaurant.name.toLowerCase().split(' ')[0] && domain.includes(restaurant.name.toLowerCase().split(' ')[0])) {
        score += 30;
      }
    } catch (e) {}
  }

  // At least 3 sections
  if (menu.menu_sections && menu.menu_sections.length >= 3) {
    score += 30;
  } else {
    reasons.push('Less than 3 sections');
  }

  // Prices detected
  const hasPrices = (menu.menu_sections || []).some(s => s.items && s.items.some(i => /\$|\d+\.\d{2}/.test(i.name + (i.price || ''))));
  if (hasPrices) score += 20; else reasons.push('No prices detected');

  // No junk
  const junk = (menu.menu_sections || []).some(s => s.items && s.items.some(i => /view cart|add to cart|checkout/i.test(i.name)));
  if (!junk) score += 20; else reasons.push('Contains ordering junk');

  const confidence = Math.min(100, score);
  const approved = confidence >= 75;
  return { approved, confidence_score: confidence, reasons };
}

async function verificationAgent(menu, restaurant) {
  try {
    const res = scoreVerification(menu, restaurant);
    try { metrics.menusVerified.inc(1); } catch (e) {}
    return res;
  } catch (err) {
    logger.error('verificationAgent error: %s', err.message);
    return { approved: false, confidence_score: 0, reasons: ['agent_error'] };
  }
}

module.exports = verificationAgent;
