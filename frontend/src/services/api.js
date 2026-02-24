const BASE_URL = 'http://localhost:3001'

export async function discoverAndScrape(name, token) {
  const res = await fetch(`${BASE_URL}/menus/discover-and-scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name })
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}
