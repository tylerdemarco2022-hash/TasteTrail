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

    const { data } = await axios.get(restaurantWebsite);
    const $ = cheerio.load(data);

    const links = [];

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().toLowerCase();

      if (!href) return;

      const combined = (href + " " + text).toLowerCase();

      if (MENU_KEYWORDS.some(keyword => combined.includes(keyword))) {
        let fullUrl = href;

        // Handle relative links
        if (href.startsWith("/")) {
          fullUrl = new URL(href, restaurantWebsite).href;
        }

        links.push(fullUrl);
      }
    });

    // Remove duplicates
    const uniqueLinks = [...new Set(links)];

    return uniqueLinks;
  } catch (error) {
    console.error("Menu URL discovery failed:", error.message);
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
