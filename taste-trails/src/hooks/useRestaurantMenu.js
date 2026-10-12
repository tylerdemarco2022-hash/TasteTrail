import { useEffect, useState, useContext } from 'react'
import { LocationContext } from '../App'
import { API_BASE_URL } from '../config/api'

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
					setMenuItems(items)
					if (!items.length) setError('No menu items found')
				} else if (data && data.needsOCR) {
					setError('Menu is a PDF or image and could not be read')
					setMenuItems([])
				} else {
					setError(data && data.error ? data.error : 'No menu items found')
					setMenuItems([])
				}
			} catch (err) {
				if (!cancelled) {
					setError(err.message || 'Failed to load menu')
					setMenuItems([])
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
