import test from 'node:test'
import assert from 'node:assert/strict'
import { choosePhoto, imageFromHtml, validatedImage } from './restaurantPhotos.js'

test('photos prefer Google, then the restaurant site, then Wikimedia, then nothing', async () => {
  const chosen = choosePhoto([
    { source: 'wikimedia', url: 'https://commons.wikimedia.org/a.jpg' },
    { source: 'website', url: 'https://aria.test/photo.jpg' },
    { source: 'google', url: '/api/place-photo?name=places/x/photos/y' }
  ])
  assert.equal(chosen.source, 'google')
  assert.equal(choosePhoto([{ source: 'wikimedia', url: 'https://commons.wikimedia.org/a.jpg' }]).source, 'wikimedia')
  assert.equal(choosePhoto([]), null)

  const html = '<meta property="og:image" content="/images/dining-room.jpg"><meta name="twitter:image" content="https://cdn.example/other.jpg">'
  assert.equal(imageFromHtml(html, 'https://aria.test/menu'), 'https://aria.test/images/dining-room.jpg')

  const ok = await validatedImage('https://aria.test/images/dining-room.jpg', async () => ({
    ok: true,
    headers: { get: () => 'image/jpeg' }
  }))
  const htmlFile = await validatedImage('https://aria.test/images/dining-room.jpg', async () => ({
    ok: true,
    headers: { get: () => 'text/html' }
  }))
  assert.equal(ok, true)
  assert.equal(htmlFile, false)
  assert.equal(choosePhoto([
    { source: 'website', url: htmlFile ? 'https://bad.test/page' : '' },
    { source: 'wikimedia', url: 'https://commons.wikimedia.org/a.jpg' }
  ]).source, 'wikimedia')
})
