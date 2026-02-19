import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

// Create a resilient client that does not crash the server when env vars are missing
let supabase

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
} else {
  console.warn('Supabase env vars not set (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY); using no-op client')
  const mockResponse = { data: null, error: { message: 'Supabase disabled: missing env vars' } }
  const mockAuthResponse = { data: { user: null, session: null }, error: { message: 'Supabase disabled: missing env vars' } }
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    order: () => builder,
    single: () => builder,
    then: (resolve) => Promise.resolve(mockResponse).then(resolve),
    catch: (reject) => Promise.resolve(mockResponse).catch(reject),
    finally: (fn) => Promise.resolve(mockResponse).finally(fn)
  }
  supabase = { 
    from: () => builder,
    auth: {
      signUp: async () => mockAuthResponse,
      signInWithPassword: async () => mockAuthResponse,
      getUser: async () => mockAuthResponse,
      signOut: async () => mockAuthResponse
    }
  }
}

export { supabase }

export async function upsertRestaurant(restaurant) {
  // restaurant: { name, lat, lon, image, menu }
  const { data, error } = await supabase.from('restaurants').upsert(restaurant).select()
  if (error) console.error('Supabase upsert error', error)
  return data
}
