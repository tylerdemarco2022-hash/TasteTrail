import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Google Custom Search API credentials (add to .env)
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID

/**
 * Search Google for restaurant's official menu page
 */
async function findRestaurantMenuURL(restaurantName, location = '') {
  const searchQuery = `${restaurantName} ${location} menu site:.com OR site:.net`
  
  if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
    console.warn('Google API credentials missing, using fallback URLs')
    return getFallbackMenuURL(restaurantName)
  }
  
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(searchQuery)}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.items && data.items.length > 0) {
      // Find first result that contains "menu"
      const menuResult = data.items.find(item => 
        item.link.toLowerCase().includes('menu') || 
        item.title.toLowerCase().includes('menu')
      )
      
      return menuResult ? menuResult.link : data.items[0].link
    }
  } catch (error) {
    console.error('Google search failed:', error.message)
  }
  
  return getFallbackMenuURL(restaurantName)
}

/**
 * Fallback URL patterns for common restaurants
 */
function getFallbackMenuURL(restaurantName) {
  const name = restaurantName.toLowerCase()
  
  const patterns = {
    'ihop': 'https://www.ihop.com/en/menu',
    'longhorn': 'https://www.longhornsteakhouse.com/menu',
    'twin peaks': 'https://www.twinpeaksrestaurant.com/menu',
    'firebirds': 'https://firebirdsrestaurants.com/locations/north-carolina/charlotte/ballantyne/',
    'super chix': 'https://www.superchix.com/menu'
  }
  
  for (const [key, url] of Object.entries(patterns)) {
    if (name.includes(key)) return url
  }
  
  return null
}

/**
 * Fetch and parse menu content from URL
 */
async function fetchMenuContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const html = await response.text()
    
    // Check if it's a PDF
    if (response.headers.get('content-type')?.includes('pdf')) {
      return { status: 'NEEDS_OCR', url }
    }
    
    return { status: 'SUCCESS', html, url }
    
  } catch (error) {
    return { status: 'ERROR', error: error.message, url }
  }
}

/**
 * Parse HTML to extract menu items
 */
function parseMenuHTML(html) {
  const items = []
  
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  
  // Common patterns for menu items
  const patterns = [
    // Pattern: Item Name ... $12.99
    /([A-Z][A-Za-z\s&']+)\s*\.{2,}\s*\$?([\d.]+)/g,
    // Pattern: <name> <price> on separate lines
    /([A-Z][A-Za-z\s&']{3,})\s+\$?([\d.]+)/g,
    // Pattern: JSON data
    /"name"\s*:\s*"([^"]+)".*?"price"\s*:\s*([\d.]+)/g,
    // Pattern: data attributes
    /data-name="([^"]+)".*?data-price="([\d.]+)"/g
  ]
  
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)]
    if (matches.length > 5) { // At least 5 items to be valid
      matches.forEach(match => {
        const [, name, price] = match
        if (name && price && name.length < 100) {
          items.push({
            name: name.trim(),
            price: parseFloat(price),
            category: 'Menu'
          })
        }
      })
      
      if (items.length > 0) break
    }
  }
  
  // Try to extract categories
  const categoryPattern = /<h[2-4][^>]*>([^<]+)<\/h[2-4]>/gi
  const categories = [...text.matchAll(categoryPattern)].map(m => m[1].trim())
  
  // Group items by category if found
  if (categories.length > 0 && items.length > 0) {
    const categorized = groupItemsByCategory(text, items, categories)
    return categorized
  }
  
  return items.length > 0 ? [{ category: 'Menu', items }] : []
}

function groupItemsByCategory(text, items, categories) {
  // Simple heuristic: assign items to nearest preceding category
  const result = []
  let currentCategory = 'Menu'
  
  categories.forEach(cat => {
    result.push({ category: cat, items: [] })
  })
  
  items.forEach(item => {
    const categoryIndex = result.findIndex(c => 
      text.indexOf(c.category) < text.indexOf(item.name)
    )
    
    if (categoryIndex >= 0) {
      result[categoryIndex].items.push(item)
    } else {
      result[0].items.push(item)
    }
  })
  
  return result.filter(c => c.items.length > 0)
}

/**
 * Main function: Fetch menu for any restaurant
 */
export async function autoFetchMenu(restaurantName, location = '') {
  console.log(`\n🔍 Auto-fetching menu for: ${restaurantName}`)
  
  // Step 1: Find menu URL
  const menuURL = await findRestaurantMenuURL(restaurantName, location)
  
  if (!menuURL) {
    console.log('❌ Could not find menu URL')
    return { status: 'NOT_FOUND', restaurant: restaurantName }
  }
  
  console.log(`📍 Found URL: ${menuURL}`)
  
  // Step 2: Fetch content
  const content = await fetchMenuContent(menuURL)
  
  if (content.status === 'NEEDS_OCR') {
    console.log('🚩 PDF menu detected - NEEDS_OCR')
    return { status: 'NEEDS_OCR', url: menuURL, restaurant: restaurantName }
  }
  
  if (content.status === 'ERROR') {
    console.log(`❌ Fetch error: ${content.error}`)
    return { status: 'ERROR', error: content.error, restaurant: restaurantName }
  }
  
  // Step 3: Parse menu
  const menuData = parseMenuHTML(content.html)
  
  if (menuData.length === 0) {
    console.log('⚠️ No menu items found')
    return { status: 'PARSE_FAILED', url: menuURL, restaurant: restaurantName }
  }
  
  console.log(`✅ Found ${menuData.reduce((sum, cat) => sum + cat.items.length, 0)} menu items`)
  
  // Step 4: Save to file
  const sanitizedName = restaurantName.replace(/[^a-z0-9]/gi, '_')
  const outputDir = path.resolve(__dirname, `../data/menus/${sanitizedName}`)
  fs.mkdirSync(outputDir, { recursive: true })
  
  const outputPath = path.join(outputDir, 'menu.json')
  fs.writeFileSync(outputPath, JSON.stringify(menuData, null, 2))
  
  console.log(`💾 Saved to: ${outputPath}`)
  
  return {
    status: 'SUCCESS',
    restaurant: restaurantName,
    url: menuURL,
    itemCount: menuData.reduce((sum, cat) => sum + cat.items.length, 0),
    menuData,
    savedTo: outputPath
  }
}

/**
 * Alternative: Use fetch_webpage if available
 */
export async function autoFetchMenuWithWebpage(restaurantName, location = '') {
  // This would use the fetch_webpage tool if we had access to it
  // For now, falls back to the above method
  return autoFetchMenu(restaurantName, location)
}
