const { classifyUrl, isPdfUrl } = require("./menuDetector");

function scoreUrl(url) {
  const lower = url.toLowerCase();
  let score = 0;

  if (lower.includes("menu")) score += 50;
  if (lower.includes("dinner")) score += 30;
  if (lower.includes("lunch")) score += 20;
  if (lower.includes("brunch")) score += 20;
  if (lower.includes("drinks")) score += 10;
  if (lower.includes("pdf")) score += 10;

  // Penalize obviously wrong
  if (lower.includes("catering")) score -= 30;
  if (lower.includes("events")) score -= 20;
  if (lower.includes("careers") || lower.includes("jobs")) score -= 50;

  return score;
}

function pickBestByType(urls) {
  const buckets = { dinner: [], lunch: [], brunch: [], drinks: [], pdf: [], menu: [] };

  for (const u of urls) {
    const { type } = classifyUrl(u);
    buckets[type] = buckets[type] || [];
    buckets[type].push(u);
  }

  const best = {};
  for (const [type, arr] of Object.entries(buckets)) {
    if (!arr.length) continue;
    const sorted = [...arr].sort((a, b) => scoreUrl(b) - scoreUrl(a));
    best[type] = sorted[0];
  }

  // Provide ranked list too
  const ranked = [...urls].sort((a, b) => scoreUrl(b) - scoreUrl(a));

  return { best, ranked };
}

module.exports = { scoreUrl, pickBestByType };