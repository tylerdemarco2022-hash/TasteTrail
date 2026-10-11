import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMenuHtml, parseMenuText } from './menuDocumentParser.js'

const html = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Menu",
  "hasMenuSection": [
    {
      "@type": "MenuSection",
      "name": "Pizza",
      "hasMenuItem": [
        {
          "@type": "MenuItem",
          "name": "Margherita",
          "description": "san marzano tomato, mozzarella, basil",
          "offers": { "@type": "Offer", "price": "16.00" }
        }
      ]
    }
  ]
}
</script>
<h3 class="menu-item-title">Burrata</h3>
<h3 class="menu-item-title">House navigation menu</h3>
`

test('html parser keeps structured dishes and prices and skips a page with no menu', () => {
  const items = parseMenuHtml(html)
  const margherita = items.find((item) => item.name === 'Margherita')
  assert.ok(margherita)
  assert.equal(margherita.price, 16)
  assert.equal(margherita.category, 'Pizza')
  assert.equal(margherita.description.includes('mozzarella'), true)
  assert.ok(items.some((item) => item.name === 'Burrata'))
  assert.equal(parseMenuHtml('<html><title>Menu</title><a href="/menu">Menu</a></html>').length, 0)
})

test('pdf text parser reads priced dishes and ignores wine columns', () => {
  const text = `
SANDWICHES
SERVED WITH FRIES OR HOUSE SALAD
TURKEY PASTRAMI 18
pretzel roll, swiss, coleslaw
SHAVED PRIME RIB DIP
*
26
fontina, horseradish creme, au jus
SHORT RIB ARANCINI . . . . . . . . . $11
Fried balls of risotto and tender beef short rib
GREEK YOGURT CAESAR SALAD. . . . . . SMALL $8 | FULL $13
PINOT NOIR
sokol blosser evolution - willamette valley, oregon 13      19.5      50
`
  const items = parseMenuText(text)
  assert.deepEqual(items.map((item) => item.name), ['TURKEY PASTRAMI', 'SHAVED PRIME RIB DIP', 'SHORT RIB ARANCINI', 'GREEK YOGURT CAESAR SALAD'])
  assert.equal(items[0].price, 18)
  assert.equal(items[2].price, 11)
  assert.equal(items[3].price, null)
  assert.match(items[3].description, /\$8/)
  assert.equal(items[0].category, 'SANDWICHES')
  assert.match(items[0].description, /pretzel roll/)
  assert.equal(items[1].price, 26)
  assert.equal(items.some((item) => /sokol|pinot/i.test(item.name)), false)
})
