function round1(value) {
  return Math.round(value * 10) / 10
}

export function bayesianScore(values, { priorMean = null, priorWeight = 5 } = {}) {
  const ratings = (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 10)
  if (!ratings.length) return { average: null, count: 0, score: null }
  const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length
  const weight = Number(priorWeight)
  const prior = Number(priorMean)
  if (!Number.isFinite(prior) || !Number.isFinite(weight) || weight <= 0) {
    return { average: round1(average), count: ratings.length, score: round1(average) }
  }
  const count = ratings.length
  const score = (count / (count + weight)) * average + (weight / (count + weight)) * prior
  return { average: round1(average), count, score: round1(score) }
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function scoreGroups(rows, { priorWeight = 5 } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const priorMean = mean(list.map((row) => Number(row.rating)).filter((value) => value >= 1 && value <= 10))
  const groups = new Map()
  for (const row of list) {
    const rating = Number(row.rating)
    if (!(rating >= 1 && rating <= 10) || !row.key) continue
    if (!groups.has(row.key)) groups.set(row.key, { ...row, values: [] })
    groups.get(row.key).values.push(rating)
  }
  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      restaurant: group.restaurant || null,
      dish: group.dish || null,
      area: group.area || null,
      ...bayesianScore(group.values, { priorMean, priorWeight })
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.count - a.count)
}
