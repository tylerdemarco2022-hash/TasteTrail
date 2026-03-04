/**
 * Confidence Scoring (Component-Based)
 *
 * Computes and logs individual score components so confidence is always explainable.
 * No "mystery 0" — every score has named factors.
 */

function clamp01(v) { return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)); }
function round2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

/**
 * Compute confidence score from extracted items.
 * @param {object} params
 * @param {Array} params.items - Extracted menu items
 * @param {string} params.source - Extraction source (provider, structured, dom, etc.)
 * @param {string} [params.provider] - Provider name if applicable
 * @param {string[]} [params.sections] - Detected section headings
 * @returns {object} { confidence, tier, components }
 */
export function computeConfidence({ items = [], source = 'unknown', provider = null, sections = [] }) {
  const count = items.length;

  // Component: Item Count (0-0.30)
  const itemCountScore = round2(
    count >= 30 ? 0.30 :
    count >= 20 ? 0.25 :
    count >= 12 ? 0.20 :
    count >= 8 ? 0.15 :
    count >= 4 ? 0.08 :
    count >= 1 ? 0.03 : 0
  );

  // Component: Price Ratio (0-0.25)
  const pricedCount = items.filter(i => i.price != null && i.price > 0).length;
  const priceRatio = count > 0 ? pricedCount / count : 0;
  const priceRatioScore = round2(0.25 * clamp01(priceRatio));

  // Component: Section Coverage (0-0.15)
  const uniqueSections = new Set(items.map(i => i.section_name || 'Menu').filter(s => s !== 'Menu'));
  const sectionCount = Math.max(uniqueSections.size, sections?.length || 0);
  const sectionCoverageScore = round2(
    sectionCount >= 5 ? 0.15 :
    sectionCount >= 3 ? 0.10 :
    sectionCount >= 1 ? 0.05 : 0
  );

  // Component: Duplicate Penalty (0-0.10)
  const nameCounts = {};
  for (const item of items) {
    const key = (item.name || '').toLowerCase();
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  }
  const dupeCount = Object.values(nameCounts).filter(c => c > 1).length;
  const dupeRatio = count > 0 ? dupeCount / count : 0;
  const duplicatePenalty = round2(0.10 * clamp01(dupeRatio));

  // Component: Name Quality (0-0.15)
  const goodNames = items.filter(i => {
    const name = (i.name || '').trim();
    return name.length >= 3 && name.includes(' ') && /[a-z]/i.test(name);
  }).length;
  const nameQualityScore = round2(0.15 * clamp01(count > 0 ? goodNames / count : 0));

  // Component: Source Bonus (0-0.15)
  const sourceBonus = round2(
    source === 'provider' ? 0.15 :
    source === 'structured' ? 0.12 :
    source === 'structured_headless' ? 0.10 :
    source === 'dom' ? 0.05 :
    source === 'dom_headless' ? 0.03 : 0
  );

  // Final Score
  const raw = itemCountScore + priceRatioScore + sectionCoverageScore + nameQualityScore + sourceBonus - duplicatePenalty;
  const confidence = round2(clamp01(raw));

  const tier =
    confidence >= 0.80 ? 'high' :
    confidence >= 0.55 ? 'medium' :
    confidence >= 0.30 ? 'low' : 'very_low';

  return {
    confidence,
    tier,
    itemCountScore,
    priceRatioScore,
    sectionCoverageScore,
    duplicatePenalty,
    nameQualityScore,
    sourceBonus,
    metrics: {
      totalItems: count,
      pricedItems: pricedCount,
      uniqueSections: sectionCount,
      duplicateNames: dupeCount,
      goodNameCount: goodNames,
      source,
      provider
    }
  };
}
