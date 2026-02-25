import { describe, it, expect } from 'vitest'
import { inferDietTags } from './dietTags'

describe('inferDietTags', () => {
  describe('vegetarian detection', () => {
    it('tags tofu items as vegetarian', () => {
      const tags = inferDietTags({ name: 'Tofu Stir Fry', description: 'Crispy tofu with vegetables' })
      expect(tags).toContain('vegetarian')
    })

    it('tags falafel as vegetarian', () => {
      const tags = inferDietTags({ name: 'Falafel Wrap', description: '' })
      expect(tags).toContain('vegetarian')
    })

    it('does NOT tag chicken as vegetarian', () => {
      const tags = inferDietTags({ name: 'Chicken Parmesan', description: 'Breaded chicken' })
      expect(tags).not.toContain('vegetarian')
    })

    it('does NOT tag steak as vegetarian', () => {
      const tags = inferDietTags({ name: 'Ribeye Steak', description: '12oz beef ribeye' })
      expect(tags).not.toContain('vegetarian')
    })

    it('does NOT tag items with both veggie and meat keywords', () => {
      const tags = inferDietTags({ name: 'Chicken Mushroom Bowl', description: '' })
      expect(tags).not.toContain('vegetarian')
    })
  })

  describe('healthy detection', () => {
    it('tags salad as healthy', () => {
      const tags = inferDietTags({ name: 'Garden Salad', description: 'Fresh greens' })
      expect(tags).toContain('healthy')
    })

    it('tags grilled items as healthy', () => {
      const tags = inferDietTags({ name: 'Grilled Salmon', description: '' })
      expect(tags).toContain('healthy')
    })

    it('does NOT tag fried items as healthy', () => {
      const tags = inferDietTags({ name: 'Fried Chicken Salad', description: 'Deep fried chicken on greens' })
      expect(tags).not.toContain('healthy')
    })

    it('does NOT tag milkshakes as healthy', () => {
      const tags = inferDietTags({ name: 'Chocolate Milkshake', description: '' })
      expect(tags).not.toContain('healthy')
    })

    it('does NOT tag alfredo as healthy', () => {
      const tags = inferDietTags({ name: 'Spinach Alfredo', description: 'Creamy alfredo sauce with spinach' })
      expect(tags).not.toContain('healthy')
    })
  })

  describe('spicy detection', () => {
    it('tags spicy items', () => {
      const tags = inferDietTags({ name: 'Spicy Chicken Wings', description: '' })
      expect(tags).toContain('spicy')
    })

    it('tags jalapeno items', () => {
      const tags = inferDietTags({ name: 'Jalapeno Burger', description: '' })
      expect(tags).toContain('spicy')
    })

    it('tags buffalo items', () => {
      const tags = inferDietTags({ name: 'Buffalo Wings', description: '' })
      expect(tags).toContain('spicy')
    })

    it('tags cajun items', () => {
      const tags = inferDietTags({ name: 'Cajun Shrimp', description: '' })
      expect(tags).toContain('spicy')
    })

    it('does NOT tag plain burger as spicy', () => {
      const tags = inferDietTags({ name: 'Classic Burger', description: 'Beef patty with lettuce' })
      expect(tags).not.toContain('spicy')
    })
  })

  describe('edge cases', () => {
    it('handles empty name and description', () => {
      const tags = inferDietTags({ name: '', description: '' })
      expect(tags).toEqual([])
    })

    it('handles missing fields', () => {
      const tags = inferDietTags({})
      expect(tags).toEqual([])
    })

    it('can return multiple tags', () => {
      const tags = inferDietTags({ name: 'Spicy Tofu Salad', description: 'Fresh greens with spicy tofu' })
      expect(tags).toContain('vegetarian')
      expect(tags).toContain('healthy')
      expect(tags).toContain('spicy')
    })
  })
})
