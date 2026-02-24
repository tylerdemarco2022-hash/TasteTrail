import express from 'express'
import { searchGooglePlaces, searchYelp } from '../../yelp.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()

// Helper: mock dataset when no API keys available
const MOCK_RESTAURANTS = [
	{ id: 'mock-1', name: 'Mock Coffee House', lat: 34.195, lon: -82.1615, rating: 4.2, image: null, address: '123 Mock St', price_level: 2, types: ['cafe'] },
	{ id: 'mock-2', name: 'Sample Pizza', lat: 34.197, lon: -82.160, rating: 4.5, image: null, address: '456 Sample Ave', price_level: 1, types: ['restaurant', 'pizza'] },
	{ id: 'mock-3', name: 'Demo Diner', lat: 34.193, lon: -82.162, rating: 4.0, image: null, address: '789 Demo Blvd', price_level: 1, types: ['diner'] }
]

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LOCAL_RESTAURANTS_DIR = path.resolve(__dirname, '../../restaurants')
const ENABLE_EXTERNAL_PLACES = ['1', 'true', 'yes'].includes(
	String(process.env.ENABLE_EXTERNAL_PLACES || '').toLowerCase()
)

function toDisplayName(dirName = '') {
	return String(dirName)
		.replace(/_/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function hashString(input = '') {
	let h = 0
	for (let i = 0; i < input.length; i += 1) {
		h = ((h << 5) - h) + input.charCodeAt(i)
		h |= 0
	}
	return Math.abs(h)
}

function loadLocalRestaurantFallback(lat, lon, limit = 30) {
	try {
		if (!fs.existsSync(LOCAL_RESTAURANTS_DIR)) return []
		const dirs = fs.readdirSync(LOCAL_RESTAURANTS_DIR).filter((entry) => {
			const full = path.join(LOCAL_RESTAURANTS_DIR, entry)
			return fs.statSync(full).isDirectory()
		})

		const rows = []
		for (const dir of dirs) {
			const menuPath = path.join(LOCAL_RESTAURANTS_DIR, dir, 'menu.json')
			if (!fs.existsSync(menuPath)) continue
			let menu = []
			try {
				const raw = fs.readFileSync(menuPath, 'utf8')
				menu = JSON.parse(raw)
			} catch (_) {
				menu = []
			}
			const itemCount = Array.isArray(menu) ? menu.length : 0
			if (itemCount === 0) continue

			const hash = hashString(dir)
			const latOffset = ((hash % 300) - 150) / 1000 // +/- 0.15 deg
			const lonOffset = (((Math.floor(hash / 17)) % 300) - 150) / 1000

			rows.push({
				id: dir,
				name: toDisplayName(dir),
				lat: Number((lat + latOffset).toFixed(6)),
				lon: Number((lon + lonOffset).toFixed(6)),
				rating: 4.0 + ((hash % 9) * 0.1),
				review_count: 30 + (hash % 400),
				image: null,
				address: 'Charlotte, NC',
				price_level: 2,
				types: ['restaurant'],
				source: 'local-menu-cache'
			})
		}

		rows.sort((a, b) => a.name.localeCompare(b.name))
		return rows.slice(0, limit)
	} catch (err) {
		console.warn('Failed to load local restaurant fallback:', err.message)
		return []
	}
}

router.get('/nearby-restaurants', async (req, res) => {
	const lat = parseFloat(req.query.lat)
	const lon = parseFloat(req.query.lon)
	let radius = parseFloat(req.query.radius || '25')
	if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' })

	// Interpret radius: if given small assume miles -> meters
	if (radius <= 1000) radius = Math.round(radius * 1609.34) // miles to meters
	else radius = Math.round(radius)

	try {
		// Primary source: local restaurants that already have cached menu files.
		// This keeps nearby/menu usable even when Google/Yelp APIs are disabled.
		const localFallback = loadLocalRestaurantFallback(lat, lon, 30)
		if (localFallback.length > 0) {
			return res.json({ restaurants: localFallback })
		}

		if (!ENABLE_EXTERNAL_PLACES) {
			return res.json({ restaurants: MOCK_RESTAURANTS })
		}

		// Try Google Places first if available
		try {
			const places = await searchGooglePlaces(lat, lon, radius)
			if (places && places.external_places_disabled) {
				console.warn('Google Places disabled; external places search skipped')
			} else if (Array.isArray(places) && places.length > 0) {
				return res.json({ restaurants: places })
			}
		} catch (googleErr) {
			// swallow, try Yelp
			console.warn('Google Places failed:', googleErr.message)
		}

		try {
			const yelpResults = await searchYelp('', `${lat},${lon}`, 20)
			if (yelpResults && yelpResults.length > 0) return res.json({ restaurants: yelpResults })
		} catch (yelpErr) {
			console.warn('Yelp search failed:', yelpErr.message)
		}

		// Last fallback
		return res.json({ restaurants: MOCK_RESTAURANTS })
	} catch (err) {
		console.error('[/api/nearby-restaurants] Error:', err)
		res.status(500).json({ error: err.message || 'Unknown error' })
	}
})

export default router
