// Google Places API integration (search + details)
// Uses HTTP requests with retries and exponential backoff.

import axios from 'axios'
import { logger } from '../utils/logger.js'

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function withRetry(fn, { retries = 3, baseMs = 400 } = {}) {
  let lastErr
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const delay = Math.min(4000, baseMs * 2 ** i)
      logger.warn('googlePlaces.retry', { attempt: i + 1, delay })
      await sleep(delay)
    }
  }
  throw lastErr
}

export async function searchRestaurants(query, location) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is missing')

  // If a lat/lng is provided, prefer Nearby Search for proximity
  if (location?.lat && location?.lng) {
    const params = {
      key: apiKey,
      location: `${location.lat},${location.lng}`,
      radius: location.radiusMeters || 5000,
      type: 'restaurant'
    }
    if (query) params.keyword = query

    return withRetry(async () => {
      const url = `${PLACES_BASE}/nearbysearch/json`
      const res = await axios.get(url, { params })
      const body = res.data
      logger.info(`Google returned ${body.results?.length || 0} results`)
      if (body?.status !== 'OK' && body?.status !== 'ZERO_RESULTS') {
        throw new Error(`Places nearby search failed: ${body?.status}`)
      }
      return body?.results || []
    })
  }

  const params = {
    key: apiKey,
    query: query,
    type: 'restaurant'
  }

  return withRetry(async () => {
    const url = `${PLACES_BASE}/textsearch/json`
    const res = await axios.get(url, { params })
    const body = res.data
    logger.info(`Google returned ${body.results?.length || 0} results`)
    if (body?.status !== 'OK' && body?.status !== 'ZERO_RESULTS') {
      throw new Error(`Places text search failed: ${body?.status}`)
    }
    return body?.results || []
  })
}

export async function getPlaceDetails(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is missing')

  return withRetry(async () => {
    const url = `${PLACES_BASE}/details/json`
    const res = await axios.get(url, {
      params: {
        key: apiKey,
        place_id: placeId,
        fields: 'name,formatted_address,place_id,website,url'
      }
    })
    const body = res.data
    logger.info(`Google returned ${body.results?.length || 0} results`)
    if (body?.status !== 'OK') {
      throw new Error(`Places details failed: ${body?.status}`)
    }
    return body?.result
  })
}
