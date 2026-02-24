const MEAT_KEYWORDS = [
  'beef', 'chicken', 'pork', 'steak', 'shrimp', 'fish', 'lamb', 'turkey', 'bacon', 'ham',
  'sausage', 'pepperoni', 'prosciutto', 'anchovy', 'tuna', 'salmon', 'meatball', 'meatballs'
];

const DAIRY_KEYWORDS = [
  'milk', 'cheese', 'cream', 'butter', 'whey', 'casein', 'yogurt', 'parmesan', 'mozzarella',
  'ricotta', 'alfredo'
];

const GLUTEN_KEYWORDS = [
  'flour', 'bread', 'pasta', 'bun', 'soy sauce', 'wheat', 'barley', 'rye', 'breadcrumbs', 'noodle'
];

const NUT_KEYWORDS = [
  'almond', 'peanut', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia'
];

const SHELLFISH_KEYWORDS = ['shrimp', 'crab', 'lobster', 'scallop', 'oyster', 'mussel', 'clam'];

const EGG_KEYWORDS = ['egg', 'eggs', 'mayonnaise', 'aioli', 'mayo'];

const KETO_BLOCKER_KEYWORDS = [
  'rice', 'pasta', 'potato', 'sugar', 'honey', 'bread', 'bun', 'flour', 'noodle', 'syrup'
];

const VEGAN_POSITIVE_KEYWORDS = ['vegan', 'plant based', 'plant-based'];
const VEGETARIAN_POSITIVE_KEYWORDS = ['vegetarian', 'meatless'];
const GLUTEN_FREE_POSITIVE_KEYWORDS = ['gluten free', 'gluten-free', 'gf'];
const DAIRY_FREE_POSITIVE_KEYWORDS = ['dairy free', 'dairy-free', 'lactose free', 'lactose-free'];
const NUT_FREE_POSITIVE_KEYWORDS = ['nut free', 'nut-free', 'peanut free', 'peanut-free'];
const SHELLFISH_FREE_POSITIVE_KEYWORDS = ['shellfish free', 'shellfish-free'];
const EGG_FREE_POSITIVE_KEYWORDS = ['egg free', 'egg-free'];
const KETO_POSITIVE_KEYWORDS = ['keto', 'low carb', 'low-carb'];
const PALEO_POSITIVE_KEYWORDS = ['paleo'];
const HALAL_POSITIVE_KEYWORDS = ['halal'];
const KOSHER_POSITIVE_KEYWORDS = ['kosher'];

const VEGAN_BLOCKER_KEYWORDS = [
  ...MEAT_KEYWORDS,
  ...SHELLFISH_KEYWORDS,
  ...DAIRY_KEYWORDS,
  ...EGG_KEYWORDS,
  'honey',
  'gelatin'
];

function normalizeText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildInputText(menuItem = {}) {
  const ingredients = Array.isArray(menuItem?.ingredients)
    ? menuItem.ingredients.join(' ')
    : (menuItem?.ingredients || '');

  const parts = [menuItem?.name || '', menuItem?.description || '', ingredients];
  return normalizeText(parts.join(' '));
}

function hasKeyword(text, keyword) {
  const haystack = ` ${text} `;
  const needle = ` ${normalizeText(keyword)} `;
  return haystack.includes(needle);
}

function hasAnyKeyword(text, keywords = []) {
  return keywords.some((keyword) => hasKeyword(text, keyword));
}

function bool(value) {
  return value === true;
}

export function classifyDietaryFlags(menuItem = {}) {
  const text = buildInputText(menuItem);

  const hasMeat = hasAnyKeyword(text, MEAT_KEYWORDS);
  const hasDairy = hasAnyKeyword(text, DAIRY_KEYWORDS);
  const hasGluten = hasAnyKeyword(text, GLUTEN_KEYWORDS);
  const hasNuts = hasAnyKeyword(text, NUT_KEYWORDS);
  const hasShellfish = hasAnyKeyword(text, SHELLFISH_KEYWORDS);
  const hasEgg = hasAnyKeyword(text, EGG_KEYWORDS);
  const hasKetoBlockers = hasAnyKeyword(text, KETO_BLOCKER_KEYWORDS);

  const hasVeganPositive = hasAnyKeyword(text, VEGAN_POSITIVE_KEYWORDS);
  const hasVegetarianPositive = hasAnyKeyword(text, VEGETARIAN_POSITIVE_KEYWORDS);
  const hasGlutenFreePositive = hasAnyKeyword(text, GLUTEN_FREE_POSITIVE_KEYWORDS);
  const hasDairyFreePositive = hasAnyKeyword(text, DAIRY_FREE_POSITIVE_KEYWORDS);
  const hasNutFreePositive = hasAnyKeyword(text, NUT_FREE_POSITIVE_KEYWORDS);
  const hasShellfishFreePositive = hasAnyKeyword(text, SHELLFISH_FREE_POSITIVE_KEYWORDS);
  const hasEggFreePositive = hasAnyKeyword(text, EGG_FREE_POSITIVE_KEYWORDS);
  const hasKetoPositive = hasAnyKeyword(text, KETO_POSITIVE_KEYWORDS);
  const hasPaleoPositive = hasAnyKeyword(text, PALEO_POSITIVE_KEYWORDS);
  const hasHalalPositive = hasAnyKeyword(text, HALAL_POSITIVE_KEYWORDS);
  const hasKosherPositive = hasAnyKeyword(text, KOSHER_POSITIVE_KEYWORDS);
  const hasVeganBlockers = hasAnyKeyword(text, VEGAN_BLOCKER_KEYWORDS);

  let isVegan = false;
  let isVegetarian = false;
  let isGlutenFree = false;
  let isDairyFree = false;
  let isNutFree = false;
  let isShellfishFree = false;
  let isEggFree = false;
  let isKeto = false;
  let isPaleo = false;
  let isHalal = false;
  let isKosher = false;

  if (hasVeganPositive && !hasVeganBlockers && !hasGluten) isVegan = true;
  if ((hasVegetarianPositive || isVegan) && !hasMeat && !hasShellfish) isVegetarian = true;
  if (hasGlutenFreePositive && !hasGluten) isGlutenFree = true;
  if (hasDairyFreePositive && !hasDairy) isDairyFree = true;
  if (hasNutFreePositive && !hasNuts) isNutFree = true;
  if (hasShellfishFreePositive && !hasShellfish) isShellfishFree = true;
  if (hasEggFreePositive && !hasEgg) isEggFree = true;
  if ((hasKetoPositive || hasPaleoPositive) && !hasKetoBlockers) isKeto = true;
  if (hasPaleoPositive && !hasKetoBlockers && !hasDairy) isPaleo = true;
  if (hasHalalPositive) isHalal = true;
  if (hasKosherPositive) isKosher = true;

  const strongSignals = [
    hasMeat, hasDairy, hasGluten, hasNuts, hasShellfish, hasEgg, hasKetoBlockers,
    hasVeganPositive, hasVegetarianPositive, hasGlutenFreePositive, hasDairyFreePositive,
    hasNutFreePositive, hasShellfishFreePositive, hasEggFreePositive,
    hasKetoPositive, hasPaleoPositive, hasHalalPositive, hasKosherPositive
  ].some(bool);

  const dietaryConfidenceScore =
    strongSignals ? 0.9 :
    text.length < 3 ? 0.3 : 0.5;

  return {
    is_vegan: isVegan,
    is_vegetarian: isVegetarian,
    is_gluten_free: isGlutenFree,
    is_dairy_free: isDairyFree,
    is_nut_free: isNutFree,
    is_shellfish_free: isShellfishFree,
    is_egg_free: isEggFree,
    is_keto: isKeto,
    is_paleo: isPaleo,
    is_halal: isHalal,
    is_kosher: isKosher,
    dietary_confidence_score: dietaryConfidenceScore
  };
}

export default classifyDietaryFlags;
