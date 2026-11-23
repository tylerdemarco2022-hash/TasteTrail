const IMAGE_TYPES = /^image\/(jpeg|jpg|png|webp|gif)/i

export function imageFromHtml(html, pageUrl) {
  const text = String(html || '')
  const match = text.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*>/i)
    || text.match(/<meta[^>]+content=["'][^"']+["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i)
  if (!match) return null
  const content = match[0].match(/content=["']([^"']+)["']/i)
  if (!content?.[1]) return null
  try {
    return new URL(content[1], pageUrl).href
  } catch {
    return null
  }
}

export function choosePhoto(candidates = []) {
  const rank = { google: 1, website: 2, wikimedia: 3 }
  return [...candidates]
    .filter((photo) => photo?.url && rank[photo.source])
    .sort((a, b) => rank[a.source] - rank[b.source])[0] || null
}

export function isImageContentType(value) {
  return IMAGE_TYPES.test(String(value || ''))
}

export async function validatedImage(url, fetchImpl = fetch) {
  if (!url) return false
  try {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'follow' })
    if (!response?.ok) return false
    return isImageContentType(response.headers?.get?.('content-type'))
  } catch {
    return false
  }
}

export async function wikimediaPhoto(place, fetchImpl = fetch) {
  const commons = String(place.wikimediaCommons || '').replace(/^File:/i, 'File:')
  const file = commons.startsWith('File:') ? commons : null
  let title = file
  if (!title && place.wikidata) {
    const entity = await fetchImpl(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(place.wikidata)}&props=claims&format=json`)
    if (!entity?.ok) return null
    const payload = await entity.json()
    const claims = payload?.entities?.[place.wikidata]?.claims?.P18
    const name = claims?.[0]?.mainsnak?.datavalue?.value
    if (!name) return null
    title = `File:${name}`
  }
  if (!title) return null
  const info = await fetchImpl(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&format=json`)
  if (!info?.ok) return null
  const body = await info.json()
  const page = Object.values(body?.query?.pages || {})[0]
  const image = page?.imageinfo?.[0]
  const url = image?.thumburl || image?.url
  if (!url) return null
  const artist = String(image?.extmetadata?.Artist?.value || 'Wikimedia Commons').replace(/<[^>]+>/g, '')
  return { url, source: 'wikimedia', attribution: artist }
}
