import { menuData } from '../menuData'
import chilis from '../menus/Chilis_Menu.json'
import { assembleCatalog } from './menuItemFinder.js'
import { RESTAURANT_META } from './restaurantMeta.js'

let cached = null

export function getClientMenuCatalog() {
  if (cached) return cached
  cached = assembleCatalog({
    menusByName: { ...menuData, "Chili's": chilis },
    meta: RESTAURANT_META,
    seeds: []
  })
  return cached
}

export function catalogSectionsForRestaurant(restaurantName) {
  const wanted = String(restaurantName || '').trim().toLowerCase()
  if (!wanted) return []
  const items = getClientMenuCatalog().filter((item) => String(item.restaurant || '').trim().toLowerCase() === wanted)
  const groups = new Map()
  for (const item of items) {
    const name = item.category || 'Menu'
    if (!groups.has(name)) groups.set(name, { name, category: name, items: [] })
    groups.get(name).items.push({
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price
    })
  }
  return [...groups.values()]
}
