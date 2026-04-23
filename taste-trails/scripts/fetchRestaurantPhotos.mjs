#!/usr/bin/env node
/**
 * Fetch real business photos for all local restaurants using Google Places API.
 *
 * Usage:
 *   1. Add GOOGLE_PLACES_API_KEY to your .env file
 *   2. Run: node scripts/fetchRestaurantPhotos.mjs
 *
 * This script:
 *   - Reads all restaurant dirs from backend/restaurants/
 *   - Uses Google Places Text Search to find each restaurant in Charlotte, NC
 *   - Downloads the first photo URL for each
 *   - Saves results to backend/data/restaurant-images.json
 *   - Also saves a photo_url into each restaurant's info.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(ROOT, '.env') })

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
if (!API_KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY not set in .env')
  console.error('Get one at: https://console.cloud.google.com/apis/credentials')
  console.error('Enable "Places API (New)" in the Google Cloud Console.')
  process.exit(1)
}

const RESTAURANTS_DIR = path.join(ROOT, 'backend', 'restaurants')
const OUTPUT_FILE = path.join(ROOT, 'backend', 'data', 'restaurant-images.json')

function toDisplayName(dirName = '') {
  return String(dirName)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchPlace(restaurantName) {
  const query = `${restaurantName} Charlotte NC restaurant`
  const url = `https://places.googleapis.com/v1/places:searchText`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.photos,places.formattedAddress'
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 1
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Places API error ${response.status}: ${text}`)
  }

  const data = await response.json()
  return data.places?.[0] || null
}

function getPhotoUrl(photoName, maxWidth = 800) {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`
}

async function main() {
  if (!fs.existsSync(RESTAURANTS_DIR)) {
    console.error('Restaurants directory not found:', RESTAURANTS_DIR)
    process.exit(1)
  }

  const dirs = fs.readdirSync(RESTAURANTS_DIR).filter((entry) => {
    const full = path.join(RESTAURANTS_DIR, entry)
    return fs.statSync(full).isDirectory()
  })

  console.log(`Found ${dirs.length} restaurants. Fetching photos...\n`)

  const results = []
  let success = 0
  let failed = 0

  for (const dir of dirs) {
    const name = toDisplayName(dir)
    process.stdout.write(`  ${name}... `)

    try {
      const place = await searchPlace(name)
      if (!place) {
        console.log('NOT FOUND')
        failed++
        results.push({
          id: dir,
          name,
          image: null,
          imageThumb: null,
          placeId: null,
          source: 'google-places',
          error: 'Place not found'
        })
        continue
      }

      const photos = place.photos || []
      if (photos.length === 0) {
        console.log('NO PHOTOS')
        failed++
        results.push({
          id: dir,
          name: place.displayName?.text || name,
          image: null,
          imageThumb: null,
          placeId: place.id,
          address: place.formattedAddress,
          source: 'google-places',
          error: 'No photos available'
        })
        continue
      }

      const photoName = photos[0].name
      const imageUrl = getPhotoUrl(photoName, 800)
      const thumbUrl = getPhotoUrl(photoName, 400)

      results.push({
        id: dir,
        name: place.displayName?.text || name,
        image: imageUrl,
        imageThumb: thumbUrl,
        placeId: place.id,
        address: place.formattedAddress,
        photoCount: photos.length,
        source: 'google-places',
        fetchedAt: new Date().toISOString()
      })

      // Also save to the restaurant's own directory
      const infoPath = path.join(RESTAURANTS_DIR, dir, 'info.json')
      let info = {}
      try {
        if (fs.existsSync(infoPath)) {
          info = JSON.parse(fs.readFileSync(infoPath, 'utf8'))
        }
      } catch (_) {}

      info.photo_url = imageUrl
      info.photo_thumb = thumbUrl
      info.google_place_id = place.id
      info.address = place.formattedAddress
      info.photo_fetched_at = new Date().toISOString()

      fs.writeFileSync(infoPath, JSON.stringify(info, null, 2))

      success++
      console.log(`OK (${photos.length} photos)`)

      // Rate limit: ~5 requests per second
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      failed++
      results.push({
        id: dir,
        name,
        image: null,
        imageThumb: null,
        source: 'google-places',
        error: err.message
      })
    }
  }

  // Write results
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2))

  console.log(`\nDone! ${success} succeeded, ${failed} failed.`)
  console.log(`Results saved to: ${OUTPUT_FILE}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
