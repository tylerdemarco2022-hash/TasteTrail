import express from 'express'
import { searchGooglePlaces, searchYelp } from '../../yelp.js'

const router = express.Router()

// Helper: mock dataset when no API keys available
const MOCK_RESTAURANTS = [
	{ id: 'mock-1', name: 'Mock Coffee House', lat: 34.195, lon: -82.1615, rating: 4.2, image: null, address: '123 Mock St', price_level: 2, types: ['cafe'] },
	{ id: 'mock-2', name: 'Sample Pizza', lat: 34.197, lon: -82.160, rating: 4.5, image: null, address: '456 Sample Ave', price_level: 1, types: ['restaurant', 'pizza'] },
	{ id: 'mock-3', name: 'Demo Diner', lat: 34.193, lon: -82.162, rating: 4.0, image: null, address: '789 Demo Blvd', price_level: 1, types: ['diner'] }
]

router.get('/nearby-restaurants', async (req, res) => {
	const lat = parseFloat(req.query.lat)
	const lon = parseFloat(req.query.lon)
	let radius = parseFloat(req.query.radius || '25')
	if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' })

	// Interpret radius: if given small assume miles -> meters
	if (radius <= 1000) radius = Math.round(radius * 1609.34) // miles to meters
	else radius = Math.round(radius)

	try {
		// Try Google Places first if available
		try {
			const places = await searchGooglePlaces(lat, lon, radius)
			if (places && places.length > 0) return res.json({ restaurants: places })
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

		// Fallback: return mock data
		return res.json({ restaurants: MOCK_RESTAURANTS })
	} catch (err) {
		console.error('[/api/nearby-restaurants] Error:', err)
		res.status(500).json({ error: err.message || 'Unknown error' })
	}
})

export default router
