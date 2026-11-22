import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPublishedPrice, groupPublishedSections, priceLevelFromPrices } from './menuPresentation.js'

test('published prices stay as printed and missing prices stay empty', () => {
  assert.equal(formatPublishedPrice(16), '$16.00')
  assert.equal(formatPublishedPrice('$22.00'), '$22.00')
  assert.equal(formatPublishedPrice(6), '$6.00')
  assert.equal(formatPublishedPrice(null), null)
  assert.equal(formatPublishedPrice(0), null)
  assert.equal(formatPublishedPrice(''), null)
  assert.equal(priceLevelFromPrices([18, 22, 28, 40]), 3)
  assert.equal(priceLevelFromPrices([10]), null)
})

test('menu sections keep the restaurant order and separate lunch from dinner', () => {
  const sections = groupPublishedSections([
    { name: 'Tuna', category: 'Starters', sourceUrl: 'https://example.com/menu/dinner/' },
    { name: 'Steak', category: 'Entrees', sourceUrl: 'https://example.com/menu/dinner/' },
    { name: 'Soup', category: 'Starters', sourceUrl: 'https://example.com/menu/lunch/' },
    { name: 'Cake', category: null, sourceUrl: 'https://example.com/dessert.pdf' }
  ])
  assert.deepEqual(sections.map((section) => section.name), ['Dinner · Starters', 'Dinner · Entrees', 'Lunch · Starters', 'Desserts'])
  assert.deepEqual(sections[0].items.map((item) => item.name), ['Tuna'])
  assert.equal(sections[1].items[0].name, 'Steak')
})
