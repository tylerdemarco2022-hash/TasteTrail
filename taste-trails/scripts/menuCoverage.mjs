import { createLiveMenuService } from '../src/services/liveMenu.js'
import { knownRestaurantRecords } from '../src/services/restaurantSources.js'

const service = createLiveMenuService({ sources: knownRestaurantRecords() })
const report = await service.coverage()
console.log(`restaurants ${report.restaurants} live ${report.live} saved ${report.saved} unavailable ${report.unavailable}`)
for (const row of report.rows) {
  console.log(`- ${row.name}: ${row.source} items=${row.count} priced=${row.priced}${row.sourceUrl ? ` url=${row.sourceUrl}` : ''}`)
  if (row.message && row.source !== 'live') console.log(`  ${row.message}`)
  for (const note of row.suspicious) console.log(`  dietary check: ${note}`)
}
if (report.live < 1) process.exitCode = 1
