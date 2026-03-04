import express from 'express'
import { searchGooglePlaces, searchYelp } from '../../yelp.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { supabase } from '../../supabase.js'

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

function inferCuisineTags(dirName = '') {
	const n = dirName.toLowerCase()
	if (n.includes('steak')) return ['Steakhouse']
	if (n.includes('seafood') || n.includes('sea_grill') || n.includes('sea_level') || n.includes('fish') || n.includes('shrimp') || n.includes('oyster')) return ['Seafood House']
	if (n.includes('sushi') || n.includes('japanese') || n.includes('ramen')) return ['Sushi']
	if (n.includes('gastrobar') || n.includes('taphouse') || n.includes('taproom') || n.includes('crunkleton') || n.includes('foxhole') || n.includes('stir') || n.includes('grill') || n.includes('bar') || n.includes('smokehouse') || n.includes('dropout') || n.includes('pig') || n.includes('link_pin') || n.includes('goodyear') || n.includes('whitakers')) return ['Bar & Grill']
	if (n.includes('fine') || n.includes('constance') || n.includes('helene') || n.includes('celsius') || n.includes('fahrenheit') || n.includes('sixty') || n.includes('peppervine') || n.includes('vines') || n.includes('grapevine') || n.includes('italia') || n.includes('italian') || n.includes('salmeris') || n.includes('mama_ricotta') || n.includes('postino') || n.includes('angeline') || n.includes('figtree') || n.includes('ilios') || n.includes('greek') || n.includes('la_belle') || n.includes('bulla') || n.includes('restaurant_constance')) return ['Fine Dining']
	return ['Casual Dining']
}

function hashString(input = '') {
	let h = 0
	for (let i = 0; i < input.length; i += 1) {
		h = ((h << 5) - h) + input.charCodeAt(i)
		h |= 0
	}
	return Math.abs(h)
}

// Load cached restaurant images from restaurant-images.json
function loadRestaurantImages() {
	try {
		const imagesPath = path.resolve(__dirname, '../../data/restaurant-images.json')
		if (!fs.existsSync(imagesPath)) return {}
		const images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'))
		const map = {}
		for (const img of images) {
			if (img.id && img.image) {
				map[img.id] = img
			}
		}
		return map
	} catch (_) {
		return {}
	}
}

function loadLocalRestaurantFallback(lat, lon, limit = 30) {
	try {
		if (!fs.existsSync(LOCAL_RESTAURANTS_DIR)) return []
		const dirs = fs.readdirSync(LOCAL_RESTAURANTS_DIR).filter((entry) => {
			const full = path.join(LOCAL_RESTAURANTS_DIR, entry)
			return fs.statSync(full).isDirectory()
		})

		const imageMap = loadRestaurantImages()

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

			// Try to load photo from info.json (set by fetchRestaurantPhotos script)
			let photoUrl = null
			let address = 'Charlotte, NC'
			try {
				const infoPath = path.join(LOCAL_RESTAURANTS_DIR, dir, 'info.json')
				if (fs.existsSync(infoPath)) {
					const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'))
					photoUrl = info.photo_url || null
					address = info.address || address
				}
			} catch (_) {}

			// Fall back to restaurant-images.json
			if (!photoUrl && imageMap[dir]) {
				photoUrl = imageMap[dir].image
				address = imageMap[dir].address || address
			}

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
				image: photoUrl,
				address,
				price_level: 2,
				types: ['restaurant'],
				cuisine_tags: inferCuisineTags(dir),
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

		// Last fallback: Try database for restaurants with service_model/cuisine_tags
		try {
			const { data, error } = await supabase
				.from('restaurants')
				.select('id, name, lat, lon, rating, review_count, image, address, price_level, types, service_model, cuisine_tags')
				.limit(30);
			if (error) {
				console.warn('DB fallback error:', error.message);
				return res.json({ restaurants: MOCK_RESTAURANTS });
			}
			// Parse cuisine_tags if stored as comma string
			const dbRestaurants = (data || []).map(r => ({
				...r,
				cuisine_tags: Array.isArray(r.cuisine_tags)
				  ? r.cuisine_tags
				  : (typeof r.cuisine_tags === 'string' && r.cuisine_tags.includes(',')
					  ? r.cuisine_tags.split(',').map(t => t.trim()).filter(Boolean)
					  : (r.cuisine_tags ? [r.cuisine_tags] : [])),
				service_model: Array.isArray(r.service_model)
				  ? r.service_model
				  : (typeof r.service_model === 'string' && r.service_model.trim()
					  ? [r.service_model.trim()]
					  : []),
			}));
			if (dbRestaurants.length > 0) {
				return res.json({ restaurants: dbRestaurants });
			}
		} catch (dbErr) {
			console.warn('DB fallback exception:', dbErr.message);
		}
		return res.json({ restaurants: MOCK_RESTAURANTS });
	} catch (err) {
		console.error('[/api/nearby-restaurants] Error:', err)
		res.status(500).json({ error: err.message || 'Unknown error' })
	}
})

export default router
