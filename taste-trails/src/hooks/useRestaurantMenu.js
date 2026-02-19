import { useEffect, useState, useContext } from 'react'
import { LocationContext } from '../App'
import { API_BASE_URL } from '../config/api'

function generateSampleMenu(restaurantName = 'This Place') {
	const base = restaurantName.replace(/[^a-zA-Z0-9 ]/g, '') || 'Place'
	return [
		{ name: `${base} Signature Dish`, price: 9.99, description: 'House specialty' },
		{ name: 'House Special', price: 7.99, description: 'Chef recommendation' },
		{ name: 'Side Salad', price: 3.99, description: 'Fresh greens' }
	]
}

export function useRestaurantMenu(restaurantName, location = null) {
	const [menuItems, setMenuItems] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const { location: userLocation } = useContext(LocationContext)

	useEffect(() => {
		if (!restaurantName) return
		let cancelled = false

		async function loadMenu() {
			setLoading(true)
			setError(null)
			try {
				let locParam = ''
				if (userLocation && userLocation.latitude && userLocation.longitude) {
					locParam = `lat=${userLocation.latitude}&lon=${userLocation.longitude}`
				} else if (location) {
					locParam = `location=${encodeURIComponent(location)}`
				} else {
					locParam = `location=Charlotte, NC`
				}

				const url = `${API_BASE_URL}/api/restaurants/${encodeURIComponent(restaurantName)}/full-menu?${locParam}&parseWithAI=true&enrichDescriptions=true`
				const res = await fetch(url)
				if (!res.ok) {
					throw new Error(`Server returned ${res.status}`)
				}
				const data = await res.json()

				if (cancelled) return

				if (data && data.success && Array.isArray(data.categories)) {
					const items = data.categories.flatMap((cat) =>
						(cat.items || []).map((item) => ({
							name: item.name,
							price: item.price,
							description: item.description,
							category: cat.category
						}))
					)
					setMenuItems(items.length ? items : generateSampleMenu(restaurantName))
				} else if (data && data.needsOCR) {
					setError('Menu is a PDF/image and needs OCR')
					setMenuItems(generateSampleMenu(restaurantName))
				} else {
					// Fallback to a small sample menu
					setError(data && data.error ? data.error : null)
					setMenuItems(generateSampleMenu(restaurantName))
				}
			} catch (err) {
				if (!cancelled) {
					setError(err.message || 'Failed to load menu')
					setMenuItems(generateSampleMenu(restaurantName))
				}
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		loadMenu()

		return () => { cancelled = true }
		}, [restaurantName, location, userLocation])
	
		return { menuItems, loading, error }
	}
