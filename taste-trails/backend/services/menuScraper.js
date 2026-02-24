import scrapeMenuAgent from '../scraper/menuScraperAgent.js';

export async function scrapeMenu(startUrl) {
  return scrapeMenuAgent(startUrl);
}

export default scrapeMenu;
