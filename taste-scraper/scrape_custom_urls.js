const scrapeRestaurant = require('./scraper')
const saveToFile = require('./save')

const restaurants = [
  {
    name: 'Kimpton Tryon Park Hotel Menu',
    url: 'https://www.kimptontryonparkhotel.com/dining/'
  },
  {
    name: 'Midnight Diner Menu',
    url: 'https://midnightdinercharlotte.com/menu/'
  },
  {
    name: 'Ruby Sunshine Menu',
    url: 'https://www.rubybrunch.com/locations/charlotte-nc/'
  },
  {
    name: "Amelie's French Bakery Menu",
    url: 'https://ameliesfrenchbakery.com/menu/'
  },
  {
    name: 'Olde Mecklenburg Brewery Menu',
    url: 'https://www.oldemeckbrew.com/menu/'
  },
  {
    name: 'Cheesecake Factory Menu',
    url: 'https://www.thecheesecakefactory.com/menu'
  },
  {
    name: 'Topgolf Menu',
    url: 'https://topgolf.com/us/food-drink/'
  },
  {
    name: 'Cinemark Bistro Charlotte Menu',
    url: 'https://www.cinemark.com/theatres/nc-charlotte/cinemark-bistro-charlotte'
  },
  {
    name: 'US National Whitewater Center Menu',
    url: 'https://whitewater.org/dine/'
  },
  {
    name: 'Desi District Menu',
    url: 'https://www.desidistrict.com/menu'
  },
  {
    name: 'Great Wolf Lodge Concord Menu',
    url: 'https://www.greatwolf.com/concord/waterpark-attractions/dining'
  }
]

const placeholderMenus = [
  {
    name: 'Asian Market Menu',
    note: 'Menu not available; venue hosts multiple vendors.'
  },
  {
    name: "Love's Travel Stop Menu",
    note: 'Menu not available; varies by location and in-store restaurants.'
  },
  {
    name: 'Triveni Supermarket Menu',
    note: 'Menu not available; in-store kitchen varies by branch.'
  },
  {
    name: 'Birkdale Village Menu',
    note: 'Menu not available; shopping center with many restaurants.'
  }
]

async function run() {
  for (const restaurant of restaurants) {
    try {
      console.log(`\nScraping: ${restaurant.name}`)
      const menu = await scrapeRestaurant(restaurant)
      saveToFile(restaurant.name, menu)
    } catch (error) {
      console.error(`Failed to scrape ${restaurant.name}:`, error.message)
    }
  }

  for (const placeholder of placeholderMenus) {
    const menu = [
      {
        category: 'Info',
        name: 'Menu not available',
        description: placeholder.note
      }
    ]
    saveToFile(placeholder.name, menu)
  }
}

run().catch((error) => {
  console.error('Scrape run failed:', error.message)
  process.exit(1)
})
