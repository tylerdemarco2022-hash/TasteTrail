function normalizePrice(p) {
  if (!p && p !== 0) return ''
  const s = String(p).replace(/[^0-9.\-]/g, '').trim()
  if (!s) return ''
  // ensure two decimals
  const n = parseFloat(s)
  if (Number.isNaN(n)) return ''
  return n % 1 === 0 ? `${n.toFixed(2)}` : `${n.toFixed(2)}`
}

function normalizeMenu(menuData) {
  if (!menuData || !Array.isArray(menuData.categories)) return { categories: [] }
  const out = { categories: [] }
  for (const c of menuData.categories) {
    const catName = (c.category || '').trim()
    if (!catName) continue
    const items = []
    const seen = new Set()
    for (const it of c.items || []) {
      const name = (it.dish_name || '').trim()
      const desc = (it.description || '').trim()
      const price = normalizePrice(it.price || '')
      if (!name) continue
      const key = `${name.toLowerCase()}|${price}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push({ dish_name: name, description: desc || null, price: price || null })
    }
    if (items.length) out.categories.push({ category: catName, items })
  }
  return out
}

module.exports = { normalizeMenu }
