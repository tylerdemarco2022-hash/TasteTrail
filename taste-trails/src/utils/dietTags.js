/**
 * Infer dietary tags from menu item name and description
 * Provides accurate classification for Healthy, Vegetarian, and Spicy filters
 */
export function inferDietTags(item) {
  const text = `${item.name ?? ""} ${item.description ?? ""}`.toLowerCase()

  const has = (arr) => arr.some(w => text.includes(w))
  const hasAny = has

  // Hard non-veg signals
  const nonVeg = [
    "chicken", "beef", "steak", "pork", "bacon", "ham", "sausage", "pepperoni",
    "turkey", "lamb", "fish", "salmon", "tuna", "shrimp", "crab", "lobster", "anchovy",
    "prosciutto", "salami", "chorizo", "meatball", "ribs", "brisket"
  ]

  // Vegetarian signals (but can be false positives if meat also present)
  const vegSignals = [
    "vegetarian", "veggie", "plant-based", "tofu", "tempeh", "falafel", "lentil",
    "black bean", "chickpea", "mushroom", "cauliflower", "eggplant"
  ]

  // Healthy-ish signals
  const healthySignals = [
    "salad", "bowl", "grilled", "roasted", "steamed", "fresh", "greens", "kale",
    "quinoa", "brown rice", "cauliflower rice", "protein bowl", "light",
    "avocado", "spinach", "arugula", "broccoli"
  ]

  // Unhealthy signals to exclude from "Healthy"
  const unhealthySignals = [
    "fried", "deep fried", "crispy", "breaded", "loaded", "nachos", "mac and cheese",
    "milkshake", "cake", "brownie", "donut", "cheesecake", "buffalo", "smothered",
    "creamy", "butter sauce", "alfredo", "carbonara"
  ]

  const tags = new Set()

  const isNonVeg = hasAny(nonVeg)
  const isVeg = !isNonVeg && (hasAny(vegSignals) || text.includes("vegetarian"))

  if (isVeg) tags.add("vegetarian")

  const isHealthy = hasAny(healthySignals) && !hasAny(unhealthySignals)
  if (isHealthy) tags.add("healthy")

  // Spicy detection
  const spicySignals = ["spicy", "hot", "jalapeño", "jalapeno", "habanero", "sriracha", "chili", "buffalo", "cajun", "🌶"]
  if (hasAny(spicySignals)) tags.add("spicy")

  return Array.from(tags)
}
