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

  const sharingNote = parseMenuText("CHEF'S SPECIAL\nMEANT TO BE SHARED BY 2\nGFGF\nSHRIMP AND LANGOUSTINE PASTA 40\nShrimp, langoustine, spaghetti")
  assert.deepEqual(sharingNote.map((item) => item.name), ['SHRIMP AND LANGOUSTINE PASTA'])
  assert.equal(sharingNote[0].price, 40)
  assert.equal(sharingNote[0].category, "CHEF'S SPECIAL")

  const sideNote = parseMenuText(`
TUSCAN TUNA PANINI
dijonnaise 480 cal 15.75
YOUR CHOICE OF BREAD AND A SIDE
ciabatta 300 cal
gluten free bread +2.50
herbed fries 280 cal +2
`)
  assert.deepEqual(sideNote.map((item) => item.name), ['TUSCAN TUNA PANINI'])
  assert.equal(sideNote[0].price, 15.75)
})

test('title-case menus, squarespace blocks, and embedded ordering items keep published prices', () => {
  const text = `
APPETIZERS
Sea Scallops* (GF) 22
Pumpkin Seed Crusted Sea Scallops
10oz PRIME FILET* 91
Strawberry Salad 11/18
Spring Greens
*Raw Oysters half dozen, market price
Cucumber Serrano Mignonette
Tomahawk Ribeye 260
`
  const items = parseMenuText(text)
  const scallops = items.find((item) => item.name === 'Sea Scallops* (GF)')
  assert.equal(scallops.price, 22)
  assert.equal(scallops.category, 'APPETIZERS')
  assert.match(scallops.description, /Pumpkin Seed/)
  assert.equal(items.find((item) => item.name === '10oz PRIME FILET').price, 91)
  const salad = items.find((item) => item.name === 'Strawberry Salad')
  assert.equal(salad.price, null)
  assert.match(salad.description, /11\/18/)
  const oysters = items.find((item) => item.name === 'Raw Oysters')
  assert.equal(oysters.price, null)
  assert.match(oysters.description, /market price/i)
  assert.equal(items.find((item) => item.name === 'Tomahawk Ribeye').price, 260)

  const squarespace = `
<div class="menu-section-title">Raw Bar</div>
<div class="menu-item">
  <div class="menu-item-title">Ahi Tuna Crudo*</div>
  <div class="menu-item-description">Capers, roasted peppers</div>
  <div class="menu-item-price-bottom"><span class="currency-sign">$</span>22</div>
</div>`
  const tuna = parseMenuHtml(squarespace).find((item) => item.name === 'Ahi Tuna Crudo*')
  assert.equal(tuna.price, 22)
  assert.equal(tuna.category, 'Raw Bar')
  assert.match(tuna.description, /Capers/)

  const ordering = parseMenuHtml(String.raw`{"name":"Triple Dipper®","oloProductId":1,"masterProductId":"P1","categoryName":"Featured Items","isAvailable":true,"displayCost":"","calorieCount":"1450-3040 cal."}`)
  assert.equal(ordering[0].name, 'Triple Dipper®')
  assert.equal(ordering[0].price, null)
  assert.equal(ordering[0].category, 'Featured Items')
  assert.match(ordering[0].description, /1450/)

  const catalog = parseMenuHtml(`<script type="application/ld+json">{"@type":"Restaurant","hasOfferCatalog":{"@type":"OfferCatalog","name":"Dinner","itemListElement":[{"@type":"Offer","price":300,"itemOffered":{"@type":"MenuItem","name":"Chateaubriand","description":"28oz"}}]}}</script>`)
  assert.equal(catalog[0].name, 'Chateaubriand')
  assert.equal(catalog[0].price, 300)
  assert.equal(catalog[0].category, 'Dinner')
})
