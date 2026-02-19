const MENU_URL_KEYWORDS = [
  "menu", "menus",
  "dinner", "lunch", "brunch",
  "drinks", "drink", "cocktails", "cocktail", "bar",
  "wine", "beer", "spirits",
  "food", "eat",
  ".pdf"
];

const REJECT_URL_KEYWORDS = [
  "catering",
  "private-events", "privateevent",
  "events",
  "careers", "jobs",
  "gift-card", "giftcard",
  "franchise",
  "press",
  "blog",
  "order-online", "delivery", "takeout",
  "reservations", "reservation",
  "locations", "location-finder",
];

const FOOD_PAGE_KEYWORDS = [
  "appetizers", "starters", "small plates",
  "entrees", "mains", "main courses",
  "desserts", "sides",
  "salad", "soups",
  "cocktails", "wine", "beer",
  "served", "gluten", "allergens",
  "$", "€", "£"
];

function normalizeUrl(u) {
  return (u || "").trim();
}

function isPdfUrl(url) {
  return url.toLowerCase().includes(".pdf");
}

function urlLooksMenuLike(url) {
  const lower = url.toLowerCase();
  if (REJECT_URL_KEYWORDS.some((k) => lower.includes(k))) return false;
  return MENU_URL_KEYWORDS.some((k) => lower.includes(k));
}

function classifyUrl(url) {
  const lower = url.toLowerCase();
  const isPdf = isPdfUrl(lower);

  const hasDinner = lower.includes("dinner");
  const hasLunch = lower.includes("lunch");
  const hasBrunch = lower.includes("brunch");
  const hasDrink = lower.includes("drink") || lower.includes("cocktail") || lower.includes("bar") || lower.includes("wine");

  let type = "menu";
  if (hasDinner) type = "dinner";
  else if (hasLunch) type = "lunch";
  else if (hasBrunch) type = "brunch";
  else if (hasDrink) type = "drinks";
  else if (isPdf) type = "pdf";

  return { type, isPdf };
}

function scoreByPageText(text) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;

  // keyword hits
  for (const k of FOOD_PAGE_KEYWORDS) {
    if (lower.includes(k)) score += 2;
  }

  // menu-ish structure signals
  if (lower.includes("appetizer") || lower.includes("entrée") || lower.includes("entree")) score += 5;
  if (lower.includes("price") || lower.match(/\$\s?\d+/)) score += 5;

  // cap score
  return Math.min(score, 50);
}

function filterCandidateLinks(links) {
  const cleaned = [...new Set(links.map(normalizeUrl).filter(Boolean))];
  return cleaned.filter(urlLooksMenuLike);
}

module.exports = { filterCandidateLinks, classifyUrl, scoreByPageText, isPdfUrl };