import axios from 'axios'
import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config()

const API_KEY = process.env.YELP_API_KEY
if (!API_KEY) {
  console.error('Missing YELP_API_KEY in environment')
  process.exit(1)
}

const SEARCH_URL = 'https://api.yelp.com/v3/businesses/search'

async function fetchCharlotte(limit = 50) {
  const params = {
    location: 'Charlotte, NC',
    categories: 'restaurants',
    limit
  }
  const res = await axios.get(SEARCH_URL, { headers: { Authorization: `Bearer ${API_KEY}` }, params })
  return res.data
}

async function main() {
  try {
    const data = await fetchCharlotte(50)
    const businesses = (data.businesses || []).map(b => ({
      id: b.id,
      name: b.name,
      image_url: b.image_url || null,
      rating: b.rating,
      review_count: b.review_count,
      location: (b.location && b.location.address1) || null,
      phone: b.phone || null,
      url: b.url || null
    }))

    fs.mkdirSync('./data', { recursive: true })
    fs.writeFileSync('./data/yelp_charlotte.json', JSON.stringify(businesses, null, 2))
    console.log('✅ Saved', businesses.length, 'Charlotte restaurants with images to ./data/yelp_charlotte.json')
  } catch (e) {
    console.error('Failed to fetch Yelp data', e.message)
  }
}

if (require.main === module) main()
