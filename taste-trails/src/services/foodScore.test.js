import test from 'node:test'
import assert from 'node:assert/strict'
import { bayesianScore, scoreGroups } from './foodScore.js'

test('food score stays empty without ratings and shrinks a single perfect score', () => {
  assert.deepEqual(bayesianScore([]), { average: null, count: 0, score: null })
  const lone = bayesianScore([10], { priorMean: 7, priorWeight: 5 })
  assert.equal(lone.average, 10)
  assert.equal(lone.count, 1)
  assert.ok(lone.score < 10)
  assert.ok(lone.score > 7)

  const established = bayesianScore(Array.from({ length: 40 }, () => 9.2), { priorMean: 7, priorWeight: 5 })
  assert.equal(established.average, 9.2)
  assert.ok(established.score > 8.9)
})

test('a dish with one rating does not outrank a well reviewed dish', () => {
  const rows = [
    { key: 'new', restaurant: 'New Place', dish: 'Steak', rating: 10, area: 'Charlotte' },
    ...Array.from({ length: 12 }, () => ({
      key: 'known',
      restaurant: 'Known Place',
      dish: 'Steak',
      rating: 8.5,
      area: 'Charlotte'
    })),
    ...Array.from({ length: 20 }, () => ({
      key: 'everyday',
      restaurant: 'Everyday',
      dish: 'Salad',
      rating: 6,
      area: 'Fort Mill'
    }))
  ]
  const dishes = scoreGroups(rows)
  const known = dishes.find((row) => row.key === 'known')
  const fresh = dishes.find((row) => row.key === 'new')
  assert.ok(known.score > fresh.score)
  assert.equal(fresh.average, 10)
  assert.equal(dishes.some((row) => row.score == null), false)

  const areas = scoreGroups([
    ...Array.from({ length: 10 }, () => ({ key: 'Charlotte', area: 'Charlotte', rating: 8.4 })),
    { key: 'Greenwood', area: 'Greenwood', rating: 10 },
    ...Array.from({ length: 10 }, () => ({ key: 'Other', area: 'Other', rating: 6 }))
  ])
  assert.ok(areas.find((row) => row.key === 'Charlotte').score > areas.find((row) => row.key === 'Greenwood').score)
})
