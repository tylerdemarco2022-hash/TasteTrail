const { crawlSiteForMenus } = require('../services/restaurantDiscovery')

const urls = [
  'https://duckworths.com/menu/',
  'https://www.futobuta.com/menu',
  'https://rurustacos.com/menu',
  'https://callesolcafe.com/menu/',
  'https://roosterskitchen.com/menu/',
  'https://www.bangbangburgersclt.com/menu',
  'https://www.eaglerestaurant.com/location/charlotte/menu/',
  'https://dilworthtastingroom.com/menu',
  'https://www.cabofishtaco.com/menu',
  'https://madgreekclt.com/menu/',
  'https://www.deejai.com/menu',
  'https://railaythai.com/menu/',
  'https://thaitastecharlotte.com/menu/',
  'https://bluetajcharlotte.com/menu/',
  'https://irondishkbbq.com/menu/',
  'https://sushihananc.com/menu/',
  'https://www.o-kusushi.com/charlotte/menu',
  'https://soulgastrolounge.com/menu',
  'https://mizucharotte.com/menu',
  'https://yuntanikkei.com/menu/',
  'https://everandalo.com/menu/',
  'https://thestanleyclt.com/menu/',
  'https://customshopfood.com/menu/',
  'https://barringtonsrestaurant.net/menu/',
  'https://goodfoodonthemontford.com/menu/',
  'https://www.thegoodyearhouse.com/menu',
  'https://www.leahandlouise.com/menu',
  'https://thewatermanclt.com/menu/',
  'https://eathawkers.com/locations/charlotte/menu/',
  'https://napaprovidence.com/menu/',
  'https://ombraitalian.com/menu/',
  'https://redrockscafe.com/menu/',
  'https://linkandpin.com/menu/',
  'https://cuzzoscuisine.com/menu/',
  'https://kidcashew.com/menu',
  'https://luisasbrickoven.com/menu/',
  'https://providenceroadsundries.com/menu/',
  'https://tacoselnevado.com/menu/',
  'https://boardwalkbillys.com/menu/',
  'https://www.lettys.com/menu',
  'https://www.thediamondrestaurant.com/menu',
  'https://pinkyswestsidegrill.com/menu/',
  'https://theopenkitchen.com/menu/',
  'https://www.theasbury.com/menu/',
  'https://cajunqueen.com/menu/',
  'https://www.finandfino.com/menu',
  'https://peppervine.com/menu/',
  'https://haberdish.com/menus/',
  'https://midwoodsmokehouse.com/menu/',
  'https://mamaricottas.com/menu/'
]

const fs = require('fs')
async function run() {
  const results = []
  for (const u of urls) {
    console.log('\n=== Crawling: ' + u + ' ===\n')
    try {
      const timeoutMs = 20000
      const res = await Promise.race([
        crawlSiteForMenus(u),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
      ])
      results.push({ url: u, result: res })
      console.log(JSON.stringify(res, null, 2))
    } catch (e) {
      console.error('Error crawling', u, e && e.message)
      results.push({ url: u, error: e && e.message })
    }
  }
  try {
    if (!fs.existsSync('cache')) fs.mkdirSync('cache')
    fs.writeFileSync('cache/crawl_results.json', JSON.stringify(results, null, 2))
    console.log('\nSaved crawl results to cache/crawl_results.json')
  } catch (e) {
    console.error('Failed to write results file', e && e.message)
  }
}

run().catch((e)=>{ console.error(e); process.exit(1) })
