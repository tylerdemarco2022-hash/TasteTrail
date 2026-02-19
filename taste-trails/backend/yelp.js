import dotenv from 'dotenv'
dotenv.config()

const YELP_KEY = process.env.YELP_API_KEY
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY

const isPlaceholder = (key, placeholder) => !key || key === placeholder

async function callYelp(path, params = '') {
  if (isPlaceholder(YELP_KEY, 'your-yelp-api-key-here')) {
    console.warn('YELP_API_KEY missing or placeholder; skipping Yelp call')
    return { businesses: [] }
  }
  const url = `https://api.yelp.com/v3${path}${params ? `?${params}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${YELP_KEY}` } })
  if (!res.ok) {
    const text = await res.text()
    console.warn(`Yelp call failed (${res.status}): ${text}`)
    return { businesses: [] }
  }
  return res.json()
}

export async function generateMenuWithAI(restaurantName, address, primaryType, priceLevel, rating, types = []) {
  if (isPlaceholder(OPENAI_KEY, 'your-openai-api-key-here')) {
    console.warn('OPENAI_API_KEY missing or placeholder; returning empty menu')
    return []
  }
  
  try {
    const cuisineHint = types && types.length ? `Cuisine/context: ${types.join(', ')}.` : (primaryType ? `Cuisine/context: ${primaryType}.` : '')
    const priceHint = priceLevel ? `Price level: ${priceLevel} (1=$, 4=$$$$).` : ''
    const ratingHint = rating ? `Target quality: about ${rating} stars.` : ''

    const prompt = `Generate a realistic, specific menu for a restaurant called "${restaurantName}" located at ${address}. ${cuisineHint} ${priceHint} ${ratingHint}

  Instructions:
  - Create 10-15 menu items that match the cuisine/style; avoid generic American bar food unless it fits the type.
  - Include regional or venue-appropriate items (e.g., sushi rolls for Japanese, dosa for South Indian, birria for Mexican, kebab for Middle Eastern, shawarma for Mediterranean, pad thai for Thai, banh mi/pho for Vietnamese, pizza/pasta for Italian).
  - Vary categories (appetizers, mains, sides, desserts, drinks) when appropriate.
  - Keep prices as tier numbers 1-4 (1=$, 4=$$$$).
  - Use realistic ratings (4.2-5.0) with small variance; do not make all 5.0.
  - Descriptions should be appetizing and concise (10-18 words).
  - Return ONLY valid JSON array, no extra text.

  JSON schema: [{"name":"Dish","price":2,"rating":4.5,"description":"Tasty"}]`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    })

    if (!res.ok) {
      console.warn('OpenAI API error:', res.status)
      return []
    }

    const data = await res.json()
    const content = data.choices[0]?.message?.content || '[]'
    
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = content.match(/\[.*\]/s)
    const jsonStr = jsonMatch ? jsonMatch[0] : content
    
    const menu = JSON.parse(jsonStr)
    return menu
  } catch (e) {
    console.error('Failed to generate menu with AI:', e.message)
    return []
  }
}

export async function getYelpMenu(businessId) {
  const data = await callYelp(`/businesses/${businessId}`)
  return {
    id: data.id,
    name: data.name,
    menu: data.menu_url || null,
    photos: data.photos || [],
    rating: data.rating,
    review_count: data.review_count,
    url: data.url
  }
}

export async function searchGooglePlaces(lat, lon, radius = 25000) {
  if (!GOOGLE_KEY) throw new Error('GOOGLE_PLACES_API_KEY not set in env')
  
  // Use the new Places API (New)
  const url = 'https://places.googleapis.com/v1/places:searchNearby'
  const body = {
    includedTypes: ['restaurant'],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: {
          latitude: lat,
          longitude: lon
        },
        radius: radius
      }
    }
  }
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.photos,places.formattedAddress,places.priceLevel,places.primaryType,places.types'
    },
    body: JSON.stringify(body)
  })
  
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Places error: ${res.status} ${text}`)
  }
  
  const data = await res.json()
  const places = data.places || []
  
  return places.map(place => ({
    id: place.id,
    name: place.displayName?.text || 'Unknown',
    lat: place.location?.latitude || 0,
    lon: place.location?.longitude || 0,
    rating: place.rating || 0,
    review_count: place.userRatingCount || 0,
    image: place.photos?.[0]?.name ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=400&key=${GOOGLE_KEY}` : null,
    address: place.formattedAddress,
    price_level: place.priceLevel || 0,
    primaryType: place.primaryType,
    types: place.types || []
  }))
}

export async function getGooglePlaceDetails(placeId) {
  if (!GOOGLE_KEY) throw new Error('GOOGLE_PLACES_API_KEY not set in env')
  
  // Use the new Places API (New)
  const url = `https://places.googleapis.com/v1/${placeId}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,photos,websiteUri,googleMapsUri,formattedAddress,primaryType,types,priceLevel'
    }
  })
  
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Places error: ${res.status} ${text}`)
  }
  
  const place = await res.json()
  
  return {
    id: placeId,
    name: place.displayName?.text || 'Unknown',
    photos: (place.photos || []).slice(0, 5).map(p => `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${GOOGLE_KEY}`),
    rating: place.rating,
    review_count: place.userRatingCount,
    url: place.googleMapsUri,
    menu: place.websiteUri,
    address: place.formattedAddress,
    primaryType: place.primaryType,
    types: place.types || [],
    price_level: place.priceLevel
  }
}

export async function searchYelp(term, location = 'Charlotte', limit = 12) {
  const params = new URLSearchParams()
  params.append('term', term || 'restaurants')
  params.append('limit', String(limit))
  
  // Check if location is coordinates (format: "lat,lon")
  if (location && location.includes(',')) {
    const [lat, lon] = location.split(',').map(s => parseFloat(s.trim()))
    if (!isNaN(lat) && !isNaN(lon)) {
      params.append('latitude', String(lat))
      params.append('longitude', String(lon))
      params.append('radius', '40000') // ~25 miles in meters
    }
  } else {
    params.append('location', location)
  }
  
  const data = await callYelp('/businesses/search', params.toString())
  return (data.businesses || []).map((b) => ({
    id: b.id,
    name: b.name,
    image: b.image_url,
    rating: b.rating,
    review_count: b.review_count,
    categories: b.categories,
    lat: b.coordinates && b.coordinates.latitude,
    lon: b.coordinates && b.coordinates.longitude,
    phone: b.phone,
    address: b.location && b.location.display_address
  }))
}
