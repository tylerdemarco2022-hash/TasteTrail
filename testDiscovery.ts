import 'dotenv/config'
import discoverRestaurants from './services/restaurantDiscovery'

async function run() {
  try {
    const results = await discoverRestaurants('Charlotte, NC')
    const total = results.length
    const withWeb = results.filter((r) => !!r.website).length
    const fallbacks = results.filter((r) => r.website && r.website.includes('http') && (r.website.indexOf('google') === -1)).length // crude
    console.log('--- Discovery Summary ---')
    console.log('Total restaurants discovered:', total)
    console.log('With websites:', withWeb)
    console.log('Fallbacks used (approx):', fallbacks)
    console.log('Note: failures (if any) are logged during discovery execution.')
  } catch (e) {
    console.error('Discovery failed:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
}

run()
