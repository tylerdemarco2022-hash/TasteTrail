import express from 'express'
import { handleNearbyRestaurants } from '../../../src/services/liveMenu.js'

const router = express.Router()

router.get('/nearby-restaurants', async (req, res) => {
	try {
		const result = await handleNearbyRestaurants(req.query || {})
		return res.status(result.status).json(result.body)
	} catch (err) {
		console.error('[/api/nearby-restaurants] Error:', err)
		return res.status(500).json({ error: 'Could not find nearby restaurants.' })
	}
})

export default router
