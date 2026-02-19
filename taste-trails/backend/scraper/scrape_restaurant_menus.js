import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Restaurant URLs - update these with actual menu page URLs
const RESTAURANTS = [
  { name: "Salmeri's Italian Kitchen", url: 'https://www.salmeris.com/menu', location: 'Fort Mill, SC' },
  { name: 'FM (Fortes Mill) Eatery', url: 'https://fmeatery.com/menu', location: 'Fort Mill, SC' },
  { name: 'Firebirds Wood Fired Grill', url: 'https://firebirdsrestaurants.com/menu', location: 'Ballantyne' },
  { name: 'Blue Bar & Smokehouse', url: 'https://bluebarbbq.com/menu', location: 'Fort Mill, SC' },
  { name: 'Konnichiwa', url: 'https://konnichiwarestaurant.com/menu', location: 'Fort Mill, SC' },
  { name: 'Dilworth Grille at Baxter', url: 'https://dilworthgrille.com/menu', location: 'Baxter Village' },
  { name: "Bossy Beulah's Ft. Mill", url: 'https://bossybeulahs.com/menu', location: 'Fort Mill, SC' },
  { name: 'Juniper Grill - Ballantyne', url: 'https://junipergrill.com/ballantyne/menu', location: 'Ballantyne' },
  { name: 'Carolina Butcher & Beer Garden', url: 'https://carolinabutcher.com/menu', location: 'Fort Mill, SC' },
  { name: 'Super Chix', url: 'https://superchix.com/menu', location: 'Fort Mill, SC' },
  { name: 'Ilios Crafted Greek - Fort Mill, SC', url: 'https://ilioscraftedgreek.com/menu', location: 'Fort Mill, SC' },
  { name: "Hobo's", url: 'https://hobosrestaurant.com/menu', location: 'Fort Mill, SC' },
  { name: 'The Flipside Cafe', url: 'https://theflipsidecafe.com/menu', location: 'Fort Mill, SC' },
  { name: 'Twin Peaks', url: 'https://twinpeaksrestaurant.com/menu', location: 'Ballantyne' },
  { name: 'Tap and Vine - Quail Hollow', url: 'https://tapandvinecharlotte.com/menu', location: 'Quail Hollow' },
  { name: 'Towne Tavern at Fort Mill', url: 'https://townetavern.com/menu', location: 'Fort Mill, SC' },
  { name: "Boss Hog's Bar-B-Que", url: 'https://bosshogbbq.com/menu', location: 'Fort Mill, SC' },
  { name: 'LongHorn Steakhouse', url: 'https://www.longhornsteakhouse.com/menu', location: 'Ballantyne' },
  { name: 'Santa Fe Mexican Grill', url: 'https://santafemexicangrill.com/menu', location: 'Fort Mill, SC' },
  { name: 'Rixster Grill', url: 'https://rixstergrill.com/menu', location: 'Fort Mill, SC' },
  { name: 'Fox Pizza & Subs', url: 'https://foxpizza.com/menu', location: 'Fort Mill, SC' },
  { name: 'Southern Roots Restaurant', url: 'https://southernrootsrestaurant.com/menu', location: 'Fort Mill, SC' },
  { name: 'IHOP', url: 'https://www.ihop.com/en/menu', location: 'Fort Mill, SC' },
  { name: "Hawthorne's New York Pizza", url: 'https://hawthornesnyp.com/menu', location: 'Charlotte' }
]

async function scrapeRestaurantMenu(browser, restaurant) {
  const page = await browser.newPage()
  
  try {
    console.log(`\n🍽️  Scraping ${restaurant.name}...`)
    console.log(`   URL: ${restaurant.url}`)
    
    await page.goto(restaurant.url, { waitUntil: 'networkidle', timeout: 30000 })
    
    // Wait for common menu container selectors
    await page.waitForTimeout(2000)
    
    // Try multiple common menu selectors
    const menuSelectors = [
      '[class*="menu"]',
      '[id*="menu"]',
      '[class*="food"]',
      'main',
      '.content',
      '#content',
      'article'
    ]
    
    let menuText = ''
    let menuItems = []
    
    // Try to extract structured menu data
    const menuData = await page.evaluate(() => {
      const items = []
      
      // Common patterns for menu items
      const itemSelectors = [
        '.menu-item',
        '[class*="menu-item"]',
        '[class*="food-item"]',
        '[data-menu-item]'
      ]
      
      for (const selector of itemSelectors) {
        const elements = document.querySelectorAll(selector)
        if (elements.length > 0) {
          elements.forEach(el => {
            const nameEl = el.querySelector('[class*="name"], [class*="title"], h3, h4, strong')
            const priceEl = el.querySelector('[class*="price"], [class*="cost"]')
            const descEl = el.querySelector('[class*="desc"], [class*="description"], p')
            const categoryEl = el.closest('[class*="category"]')?.querySelector('[class*="category-name"], h2, h3')
            
            if (nameEl) {
              items.push({
                name: nameEl.innerText.trim(),
                price: priceEl ? priceEl.innerText.trim() : '',
                description: descEl ? descEl.innerText.trim() : '',
                category: categoryEl ? categoryEl.innerText.trim() : 'Uncategorized'
              })
            }
          })
          break
        }
      }
      
      // Fallback: get all text content
      if (items.length === 0) {
        const menuContainer = document.querySelector('[class*="menu"], main, .content') || document.body
        return {
          items: [],
          rawText: menuContainer.innerText
        }
      }
      
      return { items, rawText: '' }
    })
    
    if (menuData.items.length > 0) {
      console.log(`   ✅ Found ${menuData.items.length} menu items`)
      menuItems = menuData.items
    } else {
      console.log(`   ⚠️  No structured menu found, captured raw text`)
      menuText = menuData.rawText
      
      // Flag for OCR if needed
      const hasPDF = await page.evaluate(() => {
        return !!document.querySelector('embed[type="application/pdf"], object[type="application/pdf"], iframe[src*=".pdf"]')
      })
      
      if (hasPDF) {
        console.log(`   🚩 PDF menu detected - NEEDS_OCR`)
        return { ...restaurant, status: 'NEEDS_OCR', url: restaurant.url }
      }
    }
    
    await page.close()
    
    return {
      ...restaurant,
      status: 'SUCCESS',
      menuItems,
      rawText: menuText,
      scrapedAt: new Date().toISOString()
    }
    
  } catch (error) {
    console.error(`   ❌ Error scraping ${restaurant.name}: ${error.message}`)
    await page.close()
    
    return {
      ...restaurant,
      status: 'ERROR',
      error: error.message,
      scrapedAt: new Date().toISOString()
    }
  }
}

function parsePrice(priceStr) {
  if (!priceStr) return null
  // Extract first number from price string like "$12.99" or "12.99" or "$12"
  const match = priceStr.match(/\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null
}

function formatMenuData(scrapedData) {
  if (scrapedData.status !== 'SUCCESS') return null
  
  if (scrapedData.menuItems && scrapedData.menuItems.length > 0) {
    // Group by category
    const categories = {}
    
    scrapedData.menuItems.forEach(item => {
      const cat = item.category || 'Menu'
      if (!categories[cat]) {
        categories[cat] = []
      }
      
      categories[cat].push({
        name: item.name,
        price: parsePrice(item.price),
        description: item.description || undefined,
        rating: 4.5 // Default rating
      })
    })
    
    return Object.keys(categories).map(category => ({
      category,
      items: categories[category]
    }))
  }
  
  // If we only have raw text, return it for manual processing
  return {
    rawText: scrapedData.rawText,
    needsManualParsing: true
  }
}

async function main() {
  console.log('🚀 Starting restaurant menu scraper...\n')
  
  const browser = await chromium.launch({ headless: true })
  const results = []
  
  for (const restaurant of RESTAURANTS) {
    const scrapedData = await scrapeRestaurantMenu(browser, restaurant)
    results.push(scrapedData)
    
    // Save individual result
    if (scrapedData.status === 'SUCCESS') {
      const formattedMenu = formatMenuData(scrapedData)
      
      if (formattedMenu && !formattedMenu.needsManualParsing) {
        const outputDir = path.resolve(__dirname, `../../data/menus/${restaurant.name.replace(/[^a-z0-9]/gi, '_')}`)
        fs.mkdirSync(outputDir, { recursive: true })
        
        fs.writeFileSync(
          path.join(outputDir, 'menu.json'),
          JSON.stringify(formattedMenu, null, 2)
        )
        
        console.log(`   💾 Saved to ${outputDir}/menu.json`)
      } else {
        // Save raw text for manual processing
        const outputDir = path.resolve(__dirname, `../../data/menus/${restaurant.name.replace(/[^a-z0-9]/gi, '_')}`)
        fs.mkdirSync(outputDir, { recursive: true })
        
        fs.writeFileSync(
          path.join(outputDir, 'raw_menu.txt'),
          formattedMenu.rawText
        )
        
        console.log(`   💾 Saved raw text to ${outputDir}/raw_menu.txt (needs manual parsing)`)
      }
    }
    
    // Be respectful - wait between requests
    await new Promise(r => setTimeout(r, 2000))
  }
  
  await browser.close()
  
  // Save summary
  const summaryPath = path.resolve(__dirname, '../../data/menus/scrape_summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2))
  
  console.log('\n\n📊 Scraping Summary:')
  console.log(`   ✅ Success: ${results.filter(r => r.status === 'SUCCESS').length}`)
  console.log(`   ❌ Error: ${results.filter(r => r.status === 'ERROR').length}`)
  console.log(`   🚩 Needs OCR: ${results.filter(r => r.status === 'NEEDS_OCR').length}`)
  console.log(`\n💾 Full summary saved to: ${summaryPath}`)
}

main().catch(console.error)
