import { describe, it, expect } from 'vitest'
import {
  normalizeRestaurantName,
  isBlockedRestaurant,
  filterBlockedRestaurants,
  getFakeItemRating,
  restaurantMatchesDietaryPreferences
} from './filters'

describe('normalizeRestaurantName', () => {
  it('lowercases and strips non-alphanumeric chars', () => {
    expect(normalizeRestaurantName("Chick-fil-A")).toBe('chickfila')
  })

  it('handles empty string', () => {
    expect(normalizeRestaurantName('')).toBe('')
  })

  it('handles undefined', () => {
    expect(normalizeRestaurantName()).toBe('')
  })
})

describe('isBlockedRestaurant', () => {
  it('blocks Chick-fil-A', () => {
    expect(isBlockedRestaurant('Chick-fil-A')).toBe(true)
  })

  it('blocks Starbucks', () => {
    expect(isBlockedRestaurant('Starbucks Coffee')).toBe(true)
  })

  it('blocks Cook Out', () => {
    expect(isBlockedRestaurant('Cook Out')).toBe(true)
  })

  it('blocks Cracker Barrel', () => {
    expect(isBlockedRestaurant('Cracker Barrel')).toBe(true)
  })

  it('does not block normal restaurants', () => {
    expect(isBlockedRestaurant('Culinary Dropout')).toBe(false)
  })

  it('does not block empty name', () => {
    expect(isBlockedRestaurant('')).toBe(false)
  })
})

describe('filterBlockedRestaurants', () => {
  it('removes blocked restaurants from list', () => {
    const list = [
      { name: 'Chick-fil-A' },
      { name: 'Good Restaurant' },
      { name: 'Starbucks' }
    ]
    const filtered = filterBlockedRestaurants(list)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('Good Restaurant')
  })

  it('handles empty list', () => {
    expect(filterBlockedRestaurants([])).toEqual([])
  })

  it('handles undefined', () => {
    expect(filterBlockedRestaurants()).toEqual([])
  })
})

describe('getFakeItemRating', () => {
  it('returns a rating between 6.8 and 9.5', () => {
    const { rating } = getFakeItemRating('Classic Burger')
    expect(Number(rating)).toBeGreaterThanOrEqual(6.8)
    expect(Number(rating)).toBeLessThanOrEqual(9.5)
  })

  it('returns a count between 3 and 39', () => {
    const { count } = getFakeItemRating('Classic Burger')
    expect(count).toBeGreaterThanOrEqual(3)
    expect(count).toBeLessThanOrEqual(39)
  })

  it('is deterministic - same input gives same output', () => {
    const a = getFakeItemRating('Margherita Pizza')
    const b = getFakeItemRating('Margherita Pizza')
    expect(a.rating).toBe(b.rating)
    expect(a.count).toBe(b.count)
  })

  it('different items give different ratings', () => {
    const a = getFakeItemRating('Classic Burger')
    const b = getFakeItemRating('Caesar Salad')
    // They could theoretically match, but very unlikely with different names
    const isDifferent = a.rating !== b.rating || a.count !== b.count
    expect(isDifferent).toBe(true)
  })

  it('handles empty/undefined input', () => {
    const result = getFakeItemRating('')
    expect(result.rating).toBeDefined()
    expect(result.count).toBeDefined()
  })
})

describe('restaurantMatchesDietaryPreferences', () => {
  it('returns true when no preferences set', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Any Place' }, [])).toBe(true)
  })

  it('returns true when preferences is "none"', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Any Place' }, ['none'])).toBe(true)
  })

  it('returns true for gluten_free (all restaurants)', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Steakhouse' }, ['gluten_free'])).toBe(true)
  })

  it('matches vegetarian for Italian restaurants', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Italian Bistro' }, ['vegetarian'])).toBe(true)
  })

  it('excludes steakhouse from vegetarian', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Texas Steakhouse' }, ['vegetarian'])).toBe(false)
  })

  it('matches vegan for salad places', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Fresh Salad Bar' }, ['vegan'])).toBe(true)
  })

  it('matches keto for steakhouses', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Premium Steakhouse' }, ['keto'])).toBe(true)
  })

  it('matches keto for grills', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Fire Grill House' }, ['keto'])).toBe(true)
  })

  it('excludes pizza from dairy_free', () => {
    expect(restaurantMatchesDietaryPreferences({ name: "Joe's Pizza" }, ['dairy_free'])).toBe(false)
  })

  it('matches halal for Mediterranean', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Mediterranean Kitchen' }, ['halal'])).toBe(true)
  })

  it('excludes random restaurant from halal', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Generic Diner' }, ['halal'])).toBe(false)
  })

  it('handles null preferences', () => {
    expect(restaurantMatchesDietaryPreferences({ name: 'Any' }, null)).toBe(true)
  })
})
