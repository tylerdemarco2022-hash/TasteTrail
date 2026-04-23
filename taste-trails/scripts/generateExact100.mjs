import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../backend/data')

// 100 Charlotte-area restaurants
const restaurants = [
  { name: '131 Main', cuisine: 'Contemporary American' },
  { name: 'Angeline\'s Pizzeria', cuisine: 'Italian' },
  { name: 'Blue Bar Smokehouse', cuisine: 'BBQ' },
  { name: 'Bulla Gastrobar', cuisine: 'Spanish Tapas' },
  { name: 'Captain Steve\'s Family Seafood Restaurant', cuisine: 'Seafood' },
  { name: 'Culinary Dropout', cuisine: 'American' },
  { name: 'Dean\'s Steakhouse', cuisine: 'Steakhouse' },
  { name: 'Fahrenheit', cuisine: 'Contemporary' },
  { name: 'Figtree', cuisine: 'Fine Dining' },
  { name: 'Firebirds Wood Fired Grill', cuisine: 'American Grill' },
  { name: 'Grapevine', cuisine: 'Southern' },
  { name: 'Ilios Crafted Greek', cuisine: 'Greek' },
  { name: 'Jekyll & Hyde Taphouse Grill', cuisine: 'Pub Food' },
  { name: 'La Belle Helene', cuisine: 'French' },
  { name: 'Letty\'s Tavern', cuisine: 'American Pub' },
  { name: 'Link & Pin', cuisine: 'Bowling Alley Food' },
  { name: 'Lupie\'s Cafe', cuisine: 'Latin' },
  { name: 'Mama Ricotta\'s', cuisine: 'Italian' },
  { name: 'North Italia', cuisine: 'Italian' },
  { name: 'Peppervine', cuisine: 'Mediterranean' },
  { name: 'Poppyseed Kitchen', cuisine: 'American Comfort' },
  { name: 'Postino', cuisine: 'Italian' },
  { name: 'Restaurant Constance', cuisine: 'Contemporary' },
  { name: 'Salmeris Italian Kitchen', cuisine: 'Italian' },
  { name: 'Sea Grill Diner', cuisine: 'Seafood' },
  { name: 'Sea Level NC', cuisine: 'Seafood' },
  { name: 'Sixty Vines', cuisine: 'Wine Bar' },
  { name: 'Spice Asian Kitchen', cuisine: 'Asian Fusion' },
  { name: 'STIR Charlotte', cuisine: 'Contemporary American' },
  { name: 'Supper Land', cuisine: 'New Southern' },
  { name: 'The Cellar at Duckworth\'s', cuisine: 'American Pub' },
  { name: 'The Crunkleton', cuisine: 'New American' },
  { name: 'The Foxhole Restaurant', cuisine: 'American' },
  { name: 'The Goodyear House', cuisine: 'Contemporary' },
  { name: 'The Improper Pig', cuisine: 'Southern BBQ' },
  { name: 'Whitakers', cuisine: 'American Casual' },
  { name: 'The Catbird Seat', cuisine: 'Contemporary American' },
  { name: 'Amélie\'s French Bakery', cuisine: 'French Bakery' },
  { name: 'Kepley\'s Hamburgers', cuisine: 'Classic Burgers' },
  { name: 'The Pewter Rose Bistro', cuisine: 'French' },
  { name: 'Midwood Smokehouse', cuisine: 'BBQ' },
  { name: 'Uyên Hy', cuisine: 'Vietnamese' },
  { name: 'Elmo\'s Diner', cuisine: 'American Diner' },
  { name: 'Bonterra Dining & Lounge', cuisine: 'Contemporary' },
  { name: 'Vivace Italian Restaurant', cuisine: 'Italian' },
  { name: 'The Sycamore Brewing', cuisine: 'Craft Brewery' },
  { name: 'Bad Daddy\'s Burger Bar', cuisine: 'Burgers' },
  { name: 'Pork & Beans', cuisine: 'Southern' },
  { name: 'Mojo Asian Cuisine', cuisine: 'Asian' },
  { name: 'The Blue', cuisine: 'Seafood' },
  { name: 'Aqua Restaurant', cuisine: 'Seafood' },
  { name: 'Whiskey Kitchen', cuisine: 'American Pub' },
  { name: 'Diamond Restaurant', cuisine: 'Fine Dining' },
  { name: 'Sotto', cuisine: 'Italian' },
  { name: 'Cowfish Sushi & Burger', cuisine: 'Sushi/Burgers' },
  { name: 'Sabor Latin Bistro', cuisine: 'Latin' },
  { name: 'Bleu Restaurant & Bar', cuisine: 'French' },
  { name: 'Shoga Asian Cuisine', cuisine: 'Asian' },
  { name: 'The Ritz Café', cuisine: 'American' },
  { name: 'Cote Restaurant', cuisine: 'Steakhouse' },
  { name: 'Habima Mediterranean Grill', cuisine: 'Mediterranean' },
  { name: 'Oka Asian Cuisine', cuisine: 'Japanese' },
  { name: 'Fig & Olive Mediterranean', cuisine: 'Mediterranean' },
  { name: 'Halloumi House', cuisine: 'Mediterranean' },
  { name: 'Rooster\'s Wood Fired Kitchen', cuisine: 'Wood Fired' },
  { name: 'Picasso Cafe', cuisine: 'Mediterranean' },
  { name: 'The Dining Room', cuisine: 'Fine Dining' },
  { name: 'Tarry Lake Kitchen', cuisine: 'Southern' },
  { name: 'Customshop Restaurant', cuisine: 'American' },
  { name: 'Mama\'s Thai Restaurant', cuisine: 'Thai' },
  { name: 'Wakame Sushi', cuisine: 'Japanese' },
  { name: 'Rare Italian Kitchen', cuisine: 'Italian' },
  { name: 'Stone Brewing Tap Room', cuisine: 'Brewery' },
  { name: 'Priya Indian Cuisine', cuisine: 'Indian' },
  { name: 'Taco Bell Express', cuisine: 'Mexican' },
  { name: 'Aroy Thai Restaurant', cuisine: 'Thai' },
  { name: 'Kim Chi Asian Fusion', cuisine: 'Asian Fusion' },
  { name: 'The Southern Kitchen', cuisine: 'Southern' },
  { name: 'Ember & Hearth', cuisine: 'Contemporary' },
  { name: 'Urban Grail Pub', cuisine: 'Pub' },
  { name: 'Mojo Urban Marketplace', cuisine: 'Contemporary' },
  { name: 'The Tavern on the Tracks', cuisine: 'American Pub' },
  { name: 'Fogo de Chao', cuisine: 'Brazilian Steakhouse' },
  { name: 'Taj Indian Cuisine', cuisine: 'Indian' },
  { name: 'The Crossing', cuisine: 'American' },
  { name: 'Rustic House Restaurant', cuisine: 'American' },
  { name: 'Brazas Tacos & Tequila', cuisine: 'Mexican' },
  { name: 'Passion8 Tapas Bar', cuisine: 'Spanish' },
  { name: 'Whispers Southern Cooking', cuisine: 'Southern' },
  { name: 'The Wandering Vine', cuisine: 'Contemporary' },
  { name: 'Farigoule French Kitchen', cuisine: 'French' },
  { name: 'Chima Brazilian Steakhouse', cuisine: 'Brazilian' },
  { name: 'Kayaba Sushi & Lounge', cuisine: 'Japanese' },
  { name: 'Pinpoint Coffee', cuisine: 'Cafe' },
  { name: 'The Bread Shop', cuisine: 'Bakery' },
  { name: 'Vortex Doughnuts', cuisine: 'Donuts' },
  { name: 'The Lakehouse', cuisine: 'Contemporary' },
  { name: 'Stella\'s Bistro', cuisine: 'French' },
  { name: 'The Garden Cafe', cuisine: 'Organic' },
  { name: 'Harvest Moon Restaurant', cuisine: 'Farm to Table' },
]

// Restaurant image URLs (variety)
const imageUrls = [
  'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800&q=80',
  'https://images.unsplash.com/photo-1504674900968-8873f208e0f0?w=800&q=80',
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  'https://images.unsplash.com/photo-1517248135467-4ee464c27716?w=800&q=80',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561611?w=800&q=80',
  'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80',
  'https://images.unsplash.com/photo-1535067566233-d0f6a0b0e35d?w=800&q=80',
  'https://images.unsplash.com/photo-1517457373614-b7152f800fd1?w=800&q=80',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
]

function getPlaceholderImage(restaurantName) {
  const hash = restaurantName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const index = hash % imageUrls.length
  return imageUrls[index]
}

function generateRestaurants() {
  console.log('\n🍽️ Generating 100 Restaurants...\n')

  const allRestaurants = restaurants.map((rest, idx) => ({
    id: `restaurant-${idx}`,
    name: rest.name,
    cuisine: rest.cuisine,
    image: getPlaceholderImage(rest.name),
    imageThumb: getPlaceholderImage(rest.name),
    photographer: 'Unsplash Contributors',
    source: 'unsplash',
    createdAt: new Date().toISOString()
  }))

  console.log(`✅ Generated ${allRestaurants.length} restaurants`)

  // Save
  const imagePath = path.join(dataDir, 'restaurant-images.json')
  fs.writeFileSync(imagePath, JSON.stringify(allRestaurants, null, 2))

  console.log(`\n✨ Complete!`)
  console.log(`   📊 Total Restaurants: ${allRestaurants.length}`)
  console.log(`   📁 Saved to: ${imagePath}\n`)
}

generateRestaurants()
