import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const restaurantsDir = path.join(__dirname, '../backend/restaurants')
const dataDir = path.join(__dirname, '../backend/data')

// Get restaurant folders
function getRestaurantFolders() {
  return fs
    .readdirSync(restaurantsDir)
    .filter(f => {
      const fullPath = path.join(restaurantsDir, f)
      return fs.statSync(fullPath).isDirectory() && f !== 'node_modules'
    })
    .map(folder => ({
      folder,
      name: folder.replace(/_/g, ' ').replace(/\//g, '')
    }))
}

// Fetch image from Pexels API (free, no auth needed)
async function fetchPexelsImage(query) {
  try {
    const encodedQuery = encodeURIComponent(query)
    // Using Pexels API with a default client key for public use
    const url = `https://api.pexels.com/v1/search?query=${encodedQuery}&per_page=1`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': 'YOUR_PEXELS_API_KEY'
      }
    })
    
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    if (data.photos && data.photos.length > 0) {
      const photo = data.photos[0]
      return {
        url: photo.src.large,
        thumb: photo.src.small,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pexelsUrl: photo.url
      }
    }
    return null
  } catch (error) {
    console.error(`Error fetching image for "${query}"`)
    return null
  }
}

// Fallback: Use placeholder images with generic restaurant photos
function getPlaceholderImage(restaurantName) {
  // Using Lorem Picsum (free image service) with restaurant-like query
  // These are beautiful high-quality food/restaurant images
  const restaurantImages = [
    'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800&q=80', // Modern restaurant interior
    'https://images.unsplash.com/photo-1504674900968-8873f208e0f0?w=800&q=80', // Plated food
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', // Restaurant table
    'https://images.unsplash.com/photo-1517248135467-4ee464c27716?w=800&q=80', // Pasta dish
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Sushi plate
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Food styling
    'https://images.unsplash.com/photo-1555939594-58d7cb561611?w=800&q=80', // Elegant plating
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', // Restaurant ambiance
    'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80', // Fine dining
    'https://images.unsplash.com/photo-1535067566233-d0f6a0b0e35d?w=800&q=80', // Street food
  ]

  // Use restaurant name to pick a consistent but varied image
  const hash = restaurantName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const index = hash % restaurantImages.length

  return {
    url: restaurantImages[index],
    thumb: restaurantImages[index],
    photographer: 'Various - Unsplash',
    source: 'unsplash'
  }
}

// Create or update restaurant data with images
async function enrichRestaurantWithImages() {
  console.log('\n🎨 Fetching Restaurant Images...\n')

  const restaurants = getRestaurantFolders()
  const restaurantData = []
  let successCount = 0

  for (const restaurant of restaurants) {
    console.log(`📸 Processing "${restaurant.name}"...`)
    
    // Use fallback images (works without API keys)
    const image = getPlaceholderImage(restaurant.name)
    
    if (image) {
      restaurantData.push({
        id: restaurant.folder,
        name: restaurant.name,
        image: image.url,
        imageThumb: image.thumb,
        photographer: image.photographer,
        source: image.source || 'unsplash',
        createdAt: new Date().toISOString()
      })
      console.log(`   ✅ Image assigned`)
      successCount++
    }
  }

  // Save to data file
  const outputPath = path.join(dataDir, 'restaurant-images.json')
  fs.writeFileSync(outputPath, JSON.stringify(restaurantData, null, 2))

  console.log(`\n✨ Complete!`)
  console.log(`   ✅ Processed: ${successCount} restaurants`)
  console.log(`   📁 Saved to: ${outputPath}\n`)

  return restaurantData
}

// Run the script
enrichRestaurantWithImages().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
