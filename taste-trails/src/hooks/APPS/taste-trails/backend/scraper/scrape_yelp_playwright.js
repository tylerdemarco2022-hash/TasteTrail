import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { chromium } from 'playwright'

dotenv.config()

// Reads ./data/yelp_charlotte.json (created by backend/fetch_yelp.js)
// Visits each business.url and extracts photo URLs from the Photos -> Menu section where possible.
// Saves results to ./data/menu_photos.json and optionally downloads images to ./data/menu_images/<bizid>/

const DATA_FILE = path.resolve('./data/yelp_charlotte.json')
const OUT_FILE = path.resolve('./data/menu_photos.json')
const IMAGES_DIR = path.resolve('./data/menu_images')

async function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) }

async function extractMenuPhotosFromBusiness(page, businessUrl) {
  try {
    await page.goto(businessUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Wait briefly for photos panel
    await page.waitForTimeout(1000)

    // Yelp markup may lazy-load photos. We'll try to open the photos tab by clicking "Photos" if present.
    try {
      const photosTab = await page.$('a[href$="#hrid-photos"]')
      if (photosTab) {
        await photosTab.click()
        await page.waitForTimeout(800)
      }
    } catch (e) {}

    // Try to select photo elements that look like menu photos.
    // Heuristic: image elements whose alt contains "menu" or whose surrounding caption contains "Menu".
    const imgs = await page.$$eval('img', (nodes) => nodes.map(n => ({ src: n.src || null, alt: n.alt || '' })))
    const menuImgs = imgs.filter(i => i.src && (i.alt.toLowerCase().includes('menu') || i.src.toLowerCase().includes('menu') || i.alt.toLowerCase().includes('menu photo')))

    // If none found by alt text, try to inspect captions nearby
    if (menuImgs.length === 0) {
      // look for images in photo gallery section
      const galleryImgs = imgs.filter(i => i.src && i.src.includes('media'))
      // heuristically return first few
      return galleryImgs.slice(0, 5).map(i => i.src)
    }

    return menuImgs.map(i => i.src)
  } catch (e) {
    console.warn('extract error', e.message)
    return []
  }
}

async function downloadImage(url, dest) {
  try {
    const res = await fetch(url)
    if (!res.ok) return false
    const arrayBuffer = await res.arrayBuffer()
    fs.writeFileSync(dest, Buffer.from(arrayBuffer))
    return true
  } catch (e) { return false }
}

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('Run `npm run yelp-fetch` first to populate', DATA_FILE)
    process.exit(1)
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8')
  const json = JSON.parse(raw)
  const businesses = json.businesses || []

  await ensureDir(path.dirname(OUT_FILE))
  await ensureDir(IMAGES_DIR)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const results = {}
  for (const b of businesses) {
    const url = b.url || `https://www.yelp.com/biz/${b.alias || b.id}`
    console.log('Scraping', b.name, url)
    const photos = await extractMenuPhotosFromBusiness(page, url)
    results[b.id] = { id: b.id, name: b.name, url, photos }

    // download images
    if (photos && photos.length) {
      const bizDir = path.join(IMAGES_DIR, String(b.id))
      await ensureDir(bizDir)
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]
        const ext = p.split('?')[0].split('.').pop().split('/').pop() || 'jpg'
        const dest = path.join(bizDir, `${i}.${ext}`)
        try {
          const ok = await downloadImage(p, dest)
          if (!ok) console.warn('Download failed', p)
        } catch (e) { console.warn('Download error', e.message) }
      }
    }

    // be polite
    await page.waitForTimeout(800)
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2))
  console.log('Saved menu photo list to', OUT_FILE)

  await browser.close()
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
