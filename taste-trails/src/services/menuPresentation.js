export function formatPublishedPrice(price) {
  if (price == null || price === '') return null
  if (typeof price === 'string') {
    const trimmed = price.trim()
    if (!trimmed || /^\$?0(?:\.0+)?$/.test(trimmed)) return null
    const amount = Number(trimmed.replace(/[^0-9.]/g, ''))
    if (!/^\$?\d/.test(trimmed) || !Number.isFinite(amount) || amount <= 0 || amount > 5000) return null
    return `$${amount.toFixed(2)}`
  }
  const amount = Number(price)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) return null
  return `$${amount.toFixed(2)}`
}

export function priceLevelFromPrices(prices) {
  const amounts = (Array.isArray(prices) ? prices : [])
    .map((price) => {
      if (typeof price === 'number') return price
      if (typeof price !== 'string') return null
      const amount = Number(price.replace(/[^0-9.]/g, ''))
      return Number.isFinite(amount) ? amount : null
    })
    .filter((amount) => amount > 0 && amount <= 500)
    .sort((a, b) => a - b)
  if (amounts.length < 3) return null
  const mid = amounts[Math.floor(amounts.length / 2)]
  if (mid < 12) return 1
  if (mid < 22) return 2
  if (mid < 40) return 3
  return 4
}

export function menuLabelFromUrl(url) {
  const text = String(url || '').toLowerCase()
  if (!text) return null
  if (text.includes('dessert')) return 'Desserts'
  if (text.includes('brunch')) return 'Brunch'
  if (text.includes('lunch')) return 'Lunch'
  if (text.includes('dinner')) return 'Dinner'
  if (text.includes('cocktail') || text.includes('bar-bite') || text.includes('barbite')) return 'Bar'
  return null
}

export function groupPublishedSections(items) {
  const groups = new Map()
  for (const item of items || []) {
    if (!item?.name) continue
    const menu = item.menu || menuLabelFromUrl(item.sourceUrl)
    const category = String(item.category || '').trim()
    const name = menu
      ? (category && category.toLowerCase() !== 'menu' && !category.toLowerCase().startsWith(menu.toLowerCase()) ? `${menu} · ${category}` : menu)
      : (category || 'Menu')
    if (!groups.has(name)) groups.set(name, { name, items: [] })
    groups.get(name).items.push(item)
  }
  return [...groups.values()]
}
