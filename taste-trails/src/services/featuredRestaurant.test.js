import test from 'node:test'
import assert from 'node:assert/strict'
import { pickFeatured } from './featuredRestaurant.js'

test('the featured restaurant is the highest nearby food score, then a saved menu', () => {
  const places = [
    { name: 'Quiet Cafe', menuStatus: 'unavailable', distanceMiles: 0.2 },
    { name: "Dean's Steakhouse", menuStatus: 'saved', distanceMiles: 0.4 },
    { name: 'North Italia', menuStatus: 'ready', distanceMiles: 0.8 }
  ]
  assert.equal(pickFeatured(places, []).name, "Dean's Steakhouse")
  const featured = pickFeatured(places, [
    { restaurant: 'North Italia', score: 8.2 },
    { restaurant: "Dean's Steakhouse", score: 9.1 }
  ])
  assert.equal(featured.name, "Dean's Steakhouse")
  assert.equal(featured.foodScore, 9.1)
  assert.equal(pickFeatured([], []), null)
})
