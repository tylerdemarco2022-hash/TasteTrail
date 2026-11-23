function fold(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function pickFeatured(places = [], scores = []) {
  const list = Array.isArray(places) ? places.filter((place) => place?.name) : []
  if (!list.length) return null
  const byName = new Map()
  for (const score of scores || []) {
    const key = fold(score.restaurant || score.name)
    if (!key || score.score == null) continue
    const current = byName.get(key)
    if (!current || Number(score.score) > Number(current.score)) byName.set(key, score)
  }
  let best = null
  for (const place of list) {
    const score = byName.get(fold(place.name))
    if (!score) continue
    if (!best || Number(score.score) > best.foodScore) {
      best = { ...place, foodScore: Number(score.score) }
    }
  }
  if (best) return best
  return list.find((place) => place.menuStatus === 'ready' || place.menuStatus === 'saved') || list[0]
}
