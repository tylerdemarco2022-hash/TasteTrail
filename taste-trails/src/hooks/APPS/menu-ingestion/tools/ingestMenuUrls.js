import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { scrapeMenu } from '../services/menuScraper.js'
import { parseMenuWithAI } from '../services/aiMenuParser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const targets = [
  {
    name: 'The Capital Grille',
    url: 'https://www.thecapitalgrille.com/menu/dinner'
  },
  {
    name: 'Fahrenheit',
    url: 'https://www.fahrenheit-charlotte.com/menus/#dinner'
  },
  {
    name: 'Stagioni',
    url: 'https://www.stagioniclt.com/dinner'
  },
  {
    name: '5Church Charlotte',
    url: 'https://www.5churchcharlotte.com/dinner'
  },
  {
    name: 'Haberdish',
    url: 'https://www.haberdish.com/menu'
  },
  {
    name: 'The Fig Tree Restaurant',
    url: 'https://www.thefigtreerestaurant.com/dinner-menu'
  },
  {
    name: "Bentley\'s Restaurant",
    url: 'https://bentleysrestaurant.com/dinner-menu'
  },
  {
    name: 'Sea Level NC',
    url: 'https://www.sealevelnc.com/menus/#dinner'
  },
  {
    name: 'Kindred',
    url: 'https://www.kindreddavidson.com/dinner'
  },
  {
    name: 'Good Food on Montford',
    url: 'https://goodfoodonthemontford.com/menu'
  },
  {
    name: "The Cellar at Duckworth\'s",
    url: 'https://www.thecellaratduckworths.com/menus'
  },
  {
    name: 'Mico Restaurant',
    url: 'https://www.micorestaurant.com/menus'
  },
  {
    name: 'Bardo',
    url: 'https://bardorestaurant.com/menu'
  },
  {
    name: "Angeline\'s",
    url: 'https://www.angelinesrestaurant.com/dinner'
  },
  {
    name: "Dressler\'s Restaurant",
    url: 'https://www.dresslersrestaurant.com/menu'
  },
  {
    name: "Rooster\'s Wood-Fired Kitchen",
    url: 'https://roosterskitchen.com/menu'
  },
  {
    name: 'Oak Steakhouse Charlotte',
    url: 'https://www.oaksteakhouserestaurant.com/charlotte/menus'
  },
  {
    name: 'Aria Tuscan Grill',
    url: 'https://www.ariacharlotte.com/dinner'
  },
  {
    name: 'La Belle Helene',
    url: 'https://labellehelene.com/menus'
  },
  {
    name: 'Fin & Fino',
    url: 'https://finandfino.com/menu'
  },
  {
    name: "Alexander Michael's",
    url: 'https://www.alexandermichaels.com/menu'
  },
  {
    name: "Bernardin's Restaurant",
    url: 'https://www.bernardinsrestaurant.com/dinner'
  },
  {
    name: 'Cajun Queen',
    url: 'https://cajunqueen.com/menu'
  },
  {
    name: 'Chima Steakhouse',
    url: 'https://chimasteakhouse.com/charlotte/menu/'
  },
  {
    name: 'Cowbell Burger & Whiskey Bar',
    url: 'https://cowbellburgerbar.com/menu'
  },
  {
    name: 'Dolce Osteria',
    url: 'https://dolceosteria.com/menu'
  },
  {
    name: "Eddie V's Prime Seafood",
    url: 'https://www.eddiev.com/menu/dinner/'
  },
  {
    name: 'Luce Ristorante & Bar',
    url: 'https://www.lucecharlotte.com/dinner'
  },
  {
    name: "Mama Ricotta's",
    url: 'https://www.mamaricottas.com/dinner-menu'
  },
  {
    name: 'McNinch House Restaurant',
    url: 'https://www.mcninchhouse.com/dinner-menu'
  },
  {
    name: 'Midwood Smokehouse',
    url: 'https://midwoodsmokehouse.com/menu'
  },
  {
    name: 'Napa on Providence',
    url: 'https://www.napacharotte.com/dinner-menu'
  },
  {
    name: 'O-Ku Sushi Charlotte',
    url: 'https://o-kusushi.com/locations/charlotte/menu/'
  },
  {
    name: 'Peppervine',
    url: 'https://www.peppervine.com/dinner'
  },
  {
    name: "Ruth's Chris Steak House",
    url: 'https://www.ruthschris.com/menu/dinner/'
  },
  {
    name: 'Supperland',
    url: 'https://supper.land/menu'
  },
  {
    name: 'The Goodyear House',
    url: 'https://www.thegoodyearhouse.com/menus'
  },
  {
    name: "The King's Kitchen",
    url: 'https://www.thekingskitchen.org/menu'
  },
  {
    name: 'The Melting Pot',
    url: 'https://www.meltingpot.com/charlotte-nc/menu'
  },
  {
    name: 'Vana',
    url: 'https://www.vanacharlotte.com/menu'
  },
  {
    name: '300 East',
    url: 'https://300east.net/menu'
  },
  {
    name: 'Bulla Gastrobar',
    url: 'https://bullagastrobar.com/menu/charlotte/'
  },
  {
    name: 'Calle Sol Latin Cafe',
    url: 'https://www.callesolcafe.com/menu'
  },
  {
    name: 'Dilworth Tasting Room',
    url: 'https://dilworthtastingroom.com/menu'
  },
  {
    name: 'Foxcroft Wine Co.',
    url: 'https://foxcroftwineco.com/menu'
  },
  {
    name: 'Futo Buta',
    url: 'https://www.futobuta.com/menu'
  },
  {
    name: 'Indaco Charlotte',
    url: 'https://indacocharlotte.com/menu'
  },
  {
    name: "Letty's",
    url: 'https://www.lettys.com/menu'
  },
  {
    name: 'Link & Pin',
    url: 'https://linkandpin.com/menu'
  },
  {
    name: "Little Mama's Italian Kitchen",
    url: 'https://www.littlemamasitalian.com/menu'
  },
  {
    name: "Lupie's Cafe",
    url: 'https://www.lupiescafe.com/menu'
  },
  {
    name: 'Menya Daruma',
    url: 'https://www.menyadaruma.com/menu'
  },
  {
    name: "Morton's The Steakhouse",
    url: 'https://www.mortons.com/location/charlotte/menu/'
  },
  {
    name: 'North Italia',
    url: 'https://www.northitalia.com/locations/charlotte/menu'
  },
  {
    name: "Paco's Tacos & Tequila",
    url: 'https://www.pacostacosandtequila.com/menu'
  },
  {
    name: 'Pink Bellies',
    url: 'https://www.pinkbellies.com/menu'
  },
  {
    name: 'Soul Gastrolounge',
    url: 'https://www.soulgastrolounge.com/menu'
  },
  {
    name: 'The Asbury',
    url: 'https://www.theasburyclt.com/menu'
  },
  {
    name: 'The Cowfish Sushi Burger Bar',
    url: 'https://www.thecowfish.com/locations/charlotte/menu'
  },
  {
    name: 'Aqua e Vino',
    url: 'https://www.aquaevinocharlotte.com/menu'
  },
  {
    name: 'Azteca Mexican Restaurant',
    url: 'https://www.aztecamexicanrestaurants.com/menu'
  },
  {
    name: 'Baoding',
    url: 'https://www.baodingcharlotte.com/menu'
  },
  {
    name: 'Basil Thai Cuisine',
    url: 'https://www.basilthaicuisine.com/menu'
  },
  {
    name: "Beef 'N Bottle Steakhouse",
    url: 'https://www.beefandbottle.com/menu'
  },
  {
    name: "Boardwalk Billy's",
    url: 'https://www.boardwalkbillys.com/menu'
  },
  {
    name: 'Deejai Thai Restaurant',
    url: 'https://www.deejai.com/menu'
  },
  {
    name: "Doan's Vietnamese Cuisine",
    url: 'https://www.doanscharlotte.com/menu'
  },
  {
    name: 'Hawkers Asian Street Food',
    url: 'https://eathawkers.com/locations/charlotte/menu/'
  },
  {
    name: 'Kabab-Je Rotisserie & Grille',
    url: 'https://kababjeclt.com/menu'
  },
  {
    name: 'Lang Van',
    url: 'https://www.langvancharlotte.com/menu'
  },
  {
    name: 'Leah & Louise',
    url: 'https://www.leahandlouise.com/menu'
  },
  {
    name: 'Mizu',
    url: 'https://www.mizucharotte.com/menu'
  },
  {
    name: 'Napoli Pizzeria & Gelateria',
    url: 'https://www.napolicharlotte.com/menu'
  },
  {
    name: "Portofino's Italian Restaurant",
    url: 'https://www.portofinositalianrestaurant.com/menu'
  },
  {
    name: 'Sabor Latin Street Grill',
    url: 'https://www.saborcharlotte.com/menu'
  },
  {
    name: 'Seoul Food Meat Company',
    url: 'https://www.seoulfoodmeatco.com/menu'
  },
  {
    name: 'Thai Taste',
    url: 'https://www.thaitastecharlotte.com/menu'
  },
  {
    name: 'The Summit Room',
    url: 'https://www.thesummitroomcharlotte.com/menu'
  },
  {
    name: 'Yamazaru Sushi & Sake',
    url: 'https://www.yamazaru.com/menu'
  },
  {
    name: '131 MAIN Restaurant',
    url: 'https://131-main.com/locations/charlotte/menu'
  },
  {
    name: 'Aroma Indian Cuisine',
    url: 'https://www.aromacharlotte.com/menu'
  },
  {
    name: "Barrington's",
    url: 'https://www.barringtonsrestaurant.com/menu'
  },
  {
    name: 'Bistro La Bon',
    url: 'https://www.bistrolabon.com/menu'
  },
  {
    name: 'Cabo Fish Taco',
    url: 'https://cabofishtaco.com/menu'
  },
  {
    name: 'Cava',
    url: 'https://cava.com/menu'
  },
  {
    name: 'Cicchetti',
    url: 'https://cicchetticharlotte.com/menu'
  },
  {
    name: 'Customshop',
    url: 'https://www.customshopfood.com/menu'
  },
  {
    name: 'Dogwood Southern Table & Bar',
    url: 'https://www.dogwoodcharlotte.com/menu'
  },
  {
    name: 'Fiamma',
    url: 'https://www.fiammacharlotte.com/menu'
  },
  {
    name: 'Firebirds Wood Fired Grill',
    url: 'https://firebirdsrestaurants.com/locations/charlotte/menu'
  },
  {
    name: 'Flower Child',
    url: 'https://www.iamaflowerchild.com/menu'
  },
  {
    name: 'Gyu-Kaku Japanese BBQ',
    url: 'https://www.gyu-kaku.com/charlotte/menu'
  },
  {
    name: 'Jasmine Grill',
    url: 'https://www.jasminegrillcharlotte.com/menu'
  },
  {
    name: 'Kiki Bistro',
    url: 'https://www.kikibistrocharlotte.com/menu'
  },
  {
    name: 'Kid Cashew',
    url: 'https://www.kidcashew.com/menu'
  },
  {
    name: 'Kung Foo Noodle',
    url: 'https://www.kungfoonoodleclt.com/menu'
  },
  {
    name: 'La Shish Kabob',
    url: 'https://www.lashishkabob.com/menu'
  },
  {
    name: "Mac's Speed Shop",
    url: 'https://www.macspeedshop.com/menu'
  },
  {
    name: 'Mal Pan',
    url: 'https://www.malpanchocolate.com/menu'
  },
  {
    name: 'Mariposa',
    url: 'https://www.mariposaclt.com/menu'
  },
  {
    name: "Mert's Heart & Soul",
    url: 'https://mertscharlotte.com/menu'
  },
  {
    name: 'Mi Pueblo Mexican Grill',
    url: 'https://www.mipueblomexicangrillnc.com/menu'
  },
  {
    name: 'Musashi Japanese Restaurant',
    url: 'https://www.musashicharlotte.com/menu'
  },
  {
    name: 'New Zealand Cafe',
    url: 'https://www.nzcharlotte.com/menu'
  },
  {
    name: 'Open Kitchen',
    url: 'https://www.openkitchencharlotte.com/menu'
  },
  {
    name: 'Panzu Brewery & Kitchen',
    url: 'https://www.panzubrewery.com/menu'
  },
  {
    name: 'Papi Queso',
    url: 'https://www.papiqueso.com/menu'
  },
  {
    name: 'Red Rocks Cafe',
    url: 'https://www.redrockscafe.com/menu'
  },
  {
    name: 'RockSalt',
    url: 'https://www.rocksaltclt.com/menu'
  },
  {
    name: 'Saffron Indian Cuisine',
    url: 'https://www.saffroncharlotte.com/menu'
  },
  {
    name: 'Sakura Japanese Steakhouse',
    url: 'https://www.sakurasteakhouseclt.com/menu'
  },
  {
    name: 'Sixty Vines',
    url: 'https://www.sixtyvines.com/location/charlotte/menu'
  },
  {
    name: 'SouthBound',
    url: 'https://www.southboundclt.com/menu'
  },
  {
    name: 'STIR Charlotte',
    url: 'https://www.stircharlotte.com/menu'
  },
  {
    name: 'Tacos El Nevado',
    url: 'https://www.tacoselnevado.com/menu'
  },
  {
    name: 'The Improper Pig',
    url: 'https://www.theimproperpig.com/menu'
  },
  {
    name: 'The Waterman Fish Bar',
    url: 'https://www.thewatermanclt.com/menu'
  },
  {
    name: "The Workman's Friend",
    url: 'https://www.theworkmansfriend.com/menu'
  },
  {
    name: 'Three Amigos Mexican Grill',
    url: 'https://www.threeamigosclt.com/menu'
  },
  {
    name: 'Tupelo Honey',
    url: 'https://tupelohoneycafe.com/location/charlotte/menu'
  },
  {
    name: 'Via Roma',
    url: 'https://www.viaromacharlotte.com/menu'
  },
  {
    name: 'Viva Chicken',
    url: 'https://www.vivachicken.com/menu'
  },
  {
    name: 'Waldhorn Restaurant',
    url: 'https://www.waldhorn.us/menu'
  },
  {
    name: 'Yunta Nikkei',
    url: 'https://www.yuntanikkei.com/menu'
  },
  {
    name: 'Zafran Kabab Palace',
    url: 'https://www.zafrankababpalace.com/menu'
  },
  {
    name: 'Zeppelin',
    url: 'https://www.zeppelinclt.com/menu'
  },
  {
    name: 'Zoom Burger',
    url: 'https://www.zoomburgerclt.com/menu'
  },
  {
    name: 'Leroy Fox',
    url: 'https://www.leroyfox.com/menu'
  },
  {
    name: 'Culinary Dropout',
    url: 'https://www.culinarydropout.com/locations/charlotte/menu'
  }
]

const outputRoot = path.resolve(__dirname, '..', '..', 'taste-trails', 'backend', 'restaurants')

const toDirName = (name) => name
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')

const flattenMenu = (sections) => {
  const items = []
  sections.forEach((section) => {
    const category = section.name || 'Menu'
    const sectionItems = Array.isArray(section.items) ? section.items : []
    sectionItems.forEach((item) => {
      if (!item?.name) return
      items.push({
        name: item.name,
        description: item.description || '',
        category
      })
    })
  })
  return items
}

const dedupeTargets = (list) => {
  const seen = new Set()
  return list.filter((target) => {
    const key = target.url.trim().toLowerCase().replace(/\/+$/, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const saveMenu = (name, items) => {
  const dirName = toDirName(name)
  const dirPath = path.join(outputRoot, dirName)
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  const filePath = path.join(dirPath, 'menu.json')
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2))
}

const run = async () => {
  const results = []
  const uniqueTargets = dedupeTargets(targets)
  for (const target of uniqueTargets) {
    try {
      console.log(`\n--- ${target.name} ---`)
      const scrape = await scrapeMenu(target.url)
      let sections = scrape.sections || []

      if (!sections.length) {
        const ai = await parseMenuWithAI(scrape.rawText || scrape.rawHtml || '')
        sections = ai.sections || []
      }

      const items = flattenMenu(sections)
      if (!items.length) {
        console.log('No items extracted')
        results.push({ name: target.name, url: target.url, status: 'no-items' })
        continue
      }

      saveMenu(target.name, items)
      console.log(`Saved ${items.length} items`) 
      results.push({ name: target.name, url: target.url, status: 'ok', count: items.length })
    } catch (err) {
      console.log('Failed:', err?.message || String(err))
      results.push({ name: target.name, url: target.url, status: 'error' })
    }
  }

  const reportPath = path.join(outputRoot, '_ingest_report.json')
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(`\nReport saved to ${reportPath}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
