// Menu Type Constants
// Defines the supported menu type categories

export const MENU_TYPES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  DRINKS: 'drinks'
};

export const MENU_TYPES_ARRAY = Object.values(MENU_TYPES);

export const MENU_TYPE_LABELS = {
  breakfast: '🌅 Breakfast',
  lunch: '🌞 Lunch',
  dinner: '🌙 Dinner',
  drinks: '🍹 Drinks'
};

export const DEFAULT_MENU_TYPE = MENU_TYPES.DINNER;

/**
 * Validate if a menu type is valid
 * @param {string} type - Menu type to validate
 * @returns {boolean} - True if valid
 */
export function isValidMenuType(type) {
  return MENU_TYPES_ARRAY.includes(type);
}

/**
 * Normalize menu type to valid value or default
 * @param {string} type - Menu type to normalize
 * @returns {string} - Valid menu type or default
 */
export function normalizeMenuType(type) {
  if (isValidMenuType(type)) return type;
  return DEFAULT_MENU_TYPE;
}

/**
 * Get display label for menu type
 * @param {string} type - Menu type
 * @returns {string} - Display label with emoji
 */
export function getMenuTypeLabel(type) {
  return MENU_TYPE_LABELS[type] || MENU_TYPE_LABELS[DEFAULT_MENU_TYPE];
}
