import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPublishedMenu, isQuickService } from './restaurantEligibility.js'

test('fast food, buffets, and menu-less places are excluded; a sit-down restaurant with a menu stays', () => {
  assert.equal(isQuickService({ name: "McDonald's", amenity: 'fast_food' }), true)
  assert.equal(isQuickService({ name: 'Subway', brand: 'Subway', amenity: 'restaurant' }), true)
  assert.equal(isQuickService({ name: 'Lakeside Buffet', cuisine: 'buffet', amenity: 'restaurant' }), true)
  assert.equal(isQuickService({ name: 'Counter Grill', primaryType: 'meal_takeaway', types: ['meal_takeaway'] }), true)
  assert.equal(isQuickService({ name: 'Uptown Grill', amenity: 'restaurant', cuisine: 'american', types: ['restaurant', 'meal_takeaway'] }), false)
  assert.equal(hasPublishedMenu({ name: 'No Site Cafe' }, { savedCount: 0, liveCount: 0 }), false)
  assert.equal(hasPublishedMenu({ name: 'Uptown Grill' }, { savedCount: 4, liveCount: 0 }), true)
})
