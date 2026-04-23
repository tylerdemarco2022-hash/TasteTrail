import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../backend/data')

// Additional Charlotte-area restaurants to add
const additionalRestaurants = [
  { name: 'The Catbird Seat', cuisine: 'Contemporary American' },
  { name: 'Amélie\'s French Bakery & Cafe', cuisine: 'French' },
  { name: 'Kepley\'s Hamburgers', cuisine: 'American' },
  { name: 'The Pewter Rose Bistro', cuisine: 'French' },
  { name: 'Midwood Smokehouse', cuisine: 'BBQ' },
  { name: 'Uyên Hy', cuisine: 'Vietnamese' },
  { name: 'Elmo\'s Diner', cuisine: 'American' },
  { name: 'Bonterra Dining & Lounge', cuisine: 'Contemporary' },
  { name: 'Vivace Italian Restaurant', cuisine: 'Italian' },
  { name: 'The Sycamore Brewing', cuisine: 'Brewing' },
  { name: 'Bad Daddy\'s Burger Bar', cuisine: 'Burgers' },
  { name: 'Pork & Beans', cuisine: 'American' },
  { name: 'Mojo Asian Cuisine & Sushi Bar', cuisine: 'Asian' },
  { name: 'The Blue', cuisine: 'Seafood' },
  { name: 'Aqua Restaurant', cuisine: 'Seafood' },
  { name: 'Whiskey Kitchen', cuisine: 'American' },
  { name: 'Diamond', cuisine: 'Fine Dining' },
  { name: 'Sotto', cuisine: 'Italian' },
  { name: 'Cowfish Sushi & Burger Joint', cuisine: 'Sushi/Burgers' },
  { name: 'Sabor Latin Bistro', cuisine: 'Latin' },
  { name: 'Bleu Restaurant & Bar', cuisine: 'French' },
  { name: 'Shoga Asian Cuisine', cuisine: 'Asian' },
  { name: 'The Ritz Café', cuisine: 'American' },
  { name: 'Cote', cuisine: 'Steakhouse' },
  { name: 'Habima Mediterranean Grill', cuisine: 'Mediterranean' },
  { name: 'Oka Asian Cuisine', cuisine: 'Japanese' },
  { name: 'Fig Tree Restaurant', cuisine: 'Mediterranean' },
  { name: 'Halloumi House', cuisine: 'Mediterranean' },
  { name: 'Rooster\'s Wood Fired Kitchen', cuisine: 'Wood Fired' },
  { name: 'Picasso Cafe', cuisine: 'Mediterranean' },
  { name: 'The Dining Room', cuisine: 'Fine Dining' },
  { name: 'Tarry Lake Kitchen', cuisine: 'Southern' },
  { name: 'Customshop Restaurant', cuisine: 'American' },
  { name: 'Mama\'s Thai Restaurant', cuisine: 'Thai' },
  { name: 'Wakame Sushi', cuisine: 'Japanese' },
  { name: 'Rare Italian Kitchen', cuisine: 'Italian' },
  { name: 'Stone Brewing Tap Room', cuisine: 'Brewing' },
  { name: 'Priya Indian Cuisine', cuisine: 'Indian' },
  { name: 'Taco Bell Express', cuisine: 'Mexican' },
  { name: 'Aroy Thai Restaurant', cuisine: 'Thai' },
  { name: 'Kim Chi Asian Fusion', cuisine: 'Fusion' },
  { name: 'The Southern Kitchen', cuisine: 'Southern' },
  { name: 'Ember & Hearth', cuisine: 'Contemporary' },
  { name: 'Urban Grail', cuisine: 'Pub' },
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
  { name: 'Queens University Dining', cuisine: 'Cafe' },
  { name: 'The Lakehouse', cuisine: 'Contemporary' },
  { name: 'Stella\'s Bistro', cuisine: 'French' },
  { name: 'The Garden Cafe', cuisine: 'Organic' },
]

// Restaurant image URLs (variety)
const imageUrls = [
  'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800&q=80', // Modern restaurant
  'https://images.unsplash.com/photo-1504674900968-8873f208e0f0?w=800&q=80', // Plated food
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', // Restaurant table
  'https://images.unsplash.com/photo-1517248135467-4ee464c27716?w=800&q=80', // Pasta
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Sushi
  'https://images.unsplash.com/photo-1555939594-58d7cb561611?w=800&q=80', // Fine dining
  'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80', // Fine dining 2
  'https://images.unsplash.com/photo-1535067566233-d0f6a0b0e35d?w=800&q=80', // Street food
  'https://images.unsplash.com/photo-1517457373614-b7152f800fd1?w=800&q=80', // Lunch
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Dessert
]

function getPlaceholderImage(restaurantName) {
  const hash = restaurantName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const index = hash % imageUrls.length
  return imageUrls[index]
}

function generateRestaurants() {
  console.log('\n🍽️ Generating 100 Restaurants...\n')

  // Load existing restaurants
  const imagePath = path.join(dataDir, 'restaurant-images.json')
  let existingRestaurants = []

  if (fs.existsSync(imagePath)) {
    existingRestaurants = JSON.parse(fs.readFileSync(imagePath, 'utf8'))
    console.log(`📊 Found ${existingRestaurants.length} existing restaurants`)
  }

  // Generate additional restaurants
  const newRestaurants = additionalRestaurants.map((rest, idx) => ({
    id: `restaurant-${36 + idx}`, // Start from 36 since there are already 36
    name: rest.name,
    cuisine: rest.cuisine,
    image: getPlaceholderImage(rest.name),
    imageThumb: getPlaceholderImage(rest.name),
    photographer: 'Unsplash Contributors',
    source: 'unsplash',
    createdAt: new Date().toISOString()
  }))

  console.log(`✅ Generated ${newRestaurants.length} new restaurants`)

  // Combine and save
  const allRestaurants = [...existingRestaurants, ...newRestaurants]
  fs.writeFileSync(imagePath, JSON.stringify(allRestaurants, null, 2))

  console.log(`\n✨ Complete!`)
  console.log(`   📊 Total Restaurants: ${allRestaurants.length}`)
  console.log(`   📁 Saved to: ${imagePath}\n`)

  return allRestaurants
}

generateRestaurants().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
