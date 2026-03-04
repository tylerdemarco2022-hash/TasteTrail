import axios from "axios";
import cheerio from "cheerio";

const MENU_KEYWORDS = [
  "menu",
  "menus",
  "dinner",
  "food",
  "eat",
  "dining"
];

export async function findMenuUrls(restaurantWebsite) {
  try {
    console.log("Scanning website:", restaurantWebsite);
    const { data } = await axios.get(restaurantWebsite, { timeout: 10000 }); // 10s timeout
    const $ = cheerio.load(data);
    const links = [];
    $("a").each((i, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().toLowerCase();
      if (!href) return;
      const combined = (href + " " + text).toLowerCase();
      if (MENU_KEYWORDS.some(keyword => combined.includes(keyword))) {
        let fullUrl = href;
        if (href.startsWith("/")) {
          fullUrl = new URL(href, restaurantWebsite).href;
        }
        links.push(fullUrl);
      }
    });
    const uniqueLinks = [...new Set(links)];
    if (uniqueLinks.length === 0) {
      console.warn("No menu URLs found for", restaurantWebsite);
    }
    return uniqueLinks;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error("Menu URL fetch timed out for", restaurantWebsite);
    } else {
      console.error("Menu URL discovery failed:", error.message);
    }
    return [];
  }
}

export function prioritizeDinnerMenus(urls) {
  return urls.sort((a, b) => {
    const score = (url) => {
      let s = 0;
      if (url.includes("dinner")) s += 3;
      if (url.includes("menu")) s += 2;
      if (url.endsWith(".pdf")) s += 1;
      return s;
    };
    return score(b) - score(a);
  });
}
