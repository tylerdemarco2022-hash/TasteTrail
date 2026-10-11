/**
 * Restaurant metadata for the on-device menu catalog.
 * Coordinates are approximate public locations so distance sorting works
 * before a geocoder is configured. The owner should replace them with
 * exact coordinates from their restaurant records.
 */
export const RESTAURANT_META = [
  {
    file: '131_Main_Dinner_Menu.json',
    name: '131 Main',
    address: 'Phillips Place, Charlotte, NC',
    latitude: 35.1529,
    longitude: -80.8254,
    approximate: true
  },
  {
    file: 'Angelines_Dinner_Menu.json',
    name: "Angeline's",
    address: 'Uptown, Charlotte, NC',
    latitude: 35.2274,
    longitude: -80.8438,
    approximate: true
  },
  {
    file: 'Culinary_Dropout_Menu.json',
    name: 'Culinary Dropout',
    address: 'SouthPark, Charlotte, NC',
    latitude: 35.1526,
    longitude: -80.8268,
    approximate: true
  },
  {
    file: "Dean_s_Steakhouse_Menu.json",
    name: "Dean's Steakhouse",
    address: 'Charlotte, NC',
    latitude: null,
    longitude: null,
    approximate: true
  },
  {
    file: 'Fahrenheit_Charlotte_Menu.json',
    name: 'Fahrenheit Charlotte',
    address: '222 S Caldwell St, Charlotte, NC 28202',
    latitude: 35.2237,
    longitude: -80.8427,
    approximate: true
  },
  {
    file: 'Figtree_Dinner_Menu.json',
    name: 'Figtree',
    address: 'Elizabeth, Charlotte, NC',
    latitude: 35.2136,
    longitude: -80.8268,
    approximate: true
  },
  {
    file: 'La_Belle_Helene_Menu.json',
    name: 'La Belle Helene',
    address: 'Charlotte, NC',
    latitude: null,
    longitude: null,
    approximate: true
  },
  {
    file: 'Mama_Ricotta_s_Menu.json',
    name: "Mama Ricotta's",
    address: '601 Providence Rd, Charlotte, NC',
    latitude: 35.2008,
    longitude: -80.8258,
    approximate: true
  },
  {
    file: 'Postino_Menu.json',
    name: 'Postino',
    address: 'Elizabeth, Charlotte, NC',
    latitude: 35.2108,
    longitude: -80.8465,
    approximate: true
  },
  {
    file: 'Restaurant_Constance_Menu.json',
    name: 'Restaurant Constance',
    address: '2200 Thrift Rd, Charlotte, NC 28208',
    latitude: 35.2362,
    longitude: -80.8905,
    approximate: true
  },
  {
    file: 'Sea_Grill_Diner_Menu.json',
    name: 'Sea Grill Diner',
    address: 'Charlotte, NC',
    latitude: null,
    longitude: null,
    approximate: true
  },
  {
    file: 'Sixty_Vines_Menu.json',
    name: 'Sixty Vines',
    address: '6000 Fairview Rd, Charlotte, NC 28210',
    latitude: 35.1517,
    longitude: -80.8346,
    approximate: true
  },
  {
    file: 'Stir_Charlotte_Menu.json',
    name: 'Stir Charlotte',
    address: '1422 S Tryon St, Charlotte, NC 28203',
    latitude: 35.2144,
    longitude: -80.8583,
    approximate: true
  },
  {
    file: 'Supper_Land_Menu.json',
    name: 'Supper Land',
    address: 'Charlotte, NC',
    latitude: null,
    longitude: null,
    approximate: true
  },
  {
    file: 'The_Crunkleton_Dinner_Menu.json',
    name: 'The Crunkleton',
    address: 'NoDa, Charlotte, NC',
    latitude: 35.2478,
    longitude: -80.8062,
    approximate: true
  },
  {
    file: 'Chilis_Menu.json',
    name: "Chili's",
    address: 'Charlotte, NC',
    latitude: null,
    longitude: null,
    approximate: true
  }
]

/** Sample dishes already shown in the app feed, kept searchable with the real menus. */
export const SEED_MENUS = [
  {
    name: 'Bao & Co',
    address: 'South End, Charlotte, NC',
    latitude: 35.214,
    longitude: -80.858,
    approximate: true,
    items: [
      { name: 'Pork Belly Bao', price: 3, description: 'Steamed bun with pork belly' },
      { name: 'Chicken Bao', price: 3, description: 'Steamed bun with chicken' },
      { name: 'Shrimp Bao', price: 3, description: 'Steamed bun with shrimp' },
      { name: 'Veggie Bao', price: 2, description: 'Steamed vegetable bun' },
      { name: 'Edamame', price: 2, description: 'Salted steamed soybeans' },
      { name: 'Dumpling (6pcs)', price: 3, description: 'Pork dumplings' },
      { name: 'Spring Rolls (3pcs)', price: 3, description: 'Crispy vegetable spring rolls' },
      { name: 'Bubble Tea', price: 2, description: 'Milk tea with tapioca' },
      { name: 'Mango Lassi', price: 2, description: 'Yogurt mango drink' },
      { name: 'Lychee Lemonade', price: 2, description: 'Lychee lemonade' },
      { name: 'Sesame Noodles', price: 3, description: 'Noodles with sesame sauce' },
      { name: 'Crispy Tofu', price: 2, description: 'Fried tofu, vegetarian' }
    ]
  },
  {
    name: 'Saffron Spoon',
    address: 'SouthPark, Charlotte, NC',
    latitude: 35.151,
    longitude: -80.83,
    approximate: true,
    items: [
      { name: 'Lamb Biryani', price: 4, description: 'Spiced rice with lamb' },
      { name: 'Chicken Biryani', price: 4, description: 'Spiced rice with chicken' },
      { name: 'Vegetable Biryani', price: 3, description: 'Spiced rice with vegetables, vegetarian' },
      { name: 'Lamb Curry', price: 4, description: 'Lamb in curry sauce' },
      { name: 'Chicken Tikka Masala', price: 4, description: 'Chicken in tomato cream sauce' },
      { name: 'Chicken Korma', price: 3, description: 'Chicken in a mild cream sauce' },
      { name: 'Paneer Tikka Masala', price: 3, description: 'Vegetarian cheese in tomato cream sauce' },
      { name: 'Chana Masala', price: 2, description: 'Chickpea curry, vegan' },
      { name: 'Naan Bread', price: 2, description: 'Baked bread' },
      { name: 'Garlic Naan', price: 2, description: 'Baked bread with garlic and butter' },
      { name: 'Samosa (3pcs)', price: 2, description: 'Spiced potato pastry, vegetarian' },
      { name: 'Mango Lassi', price: 2, description: 'Yogurt mango drink' }
    ]
  },
  {
    name: 'Green Fork',
    address: 'Uptown, Charlotte, NC',
    latitude: 35.2271,
    longitude: -80.8431,
    approximate: true,
    items: [
      { name: 'Avocado Toast', price: 3, description: 'Sourdough with avocado, vegetarian' },
      { name: 'Acai Bowl', price: 4, description: 'Acai, fruit, and granola, vegan' },
      { name: 'Smoked Salmon Toast', price: 4, description: 'Toast with smoked salmon' },
      { name: 'Shakshuka', price: 3, description: 'Eggs in tomato sauce, vegetarian' },
      { name: 'Quinoa Bowl', price: 4, description: 'Quinoa and vegetables, vegan' },
      { name: 'Organic Salad', price: 3, description: 'Mixed greens, vegetarian' },
      { name: 'Green Smoothie', price: 3, description: 'Spinach and fruit smoothie, vegan' },
      { name: 'Berry Smoothie Bowl', price: 4, description: 'Berry smoothie bowl, vegan' },
      { name: 'Cappuccino', price: 2, description: 'Espresso with milk' },
      { name: 'Cold Brew Coffee', price: 2, description: 'Cold brew coffee' },
      { name: 'Matcha Latte', price: 3, description: 'Matcha with milk' },
      { name: 'Carrot Cake', price: 2, description: 'Carrot cake with cream cheese frosting' }
    ]
  }
]

export const DIETARY_FILTERS = [
  { key: 'vegan', label: 'Vegan' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'gluten_free', label: 'Gluten-free' },
  { key: 'dairy_free', label: 'Dairy-free' },
  { key: 'nut_free', label: 'Nut-free' },
  { key: 'shellfish_free', label: 'Shellfish-free' },
  { key: 'egg_free', label: 'Egg-free' },
  { key: 'halal', label: 'Halal' },
  { key: 'kosher', label: 'Kosher' },
  { key: 'keto', label: 'Keto' },
  { key: 'paleo', label: 'Paleo' }
]
