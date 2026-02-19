const puppeteer = require("puppeteer");
const axios = require("axios");
const cheerio = require("cheerio");

const MENU_KEYWORDS = [
  "menu",
  "menus",
  "dinner",
  "lunch",
  "brunch",
  "drink",
  "cocktail",
  "wine",
  ".pdf"
];

const REJECT_KEYWORDS = [
  "catering",
  "careers",
  "blog",
  "gift",
  "franchise",
  "private-event"
];

function isValidMenuUrl(url) {
  const lower = url.toLowerCase();

  if (REJECT_KEYWORDS.some(word => lower.includes(word))) {
    return false;
  }

  return MENU_KEYWORDS.some(word => lower.includes(word));
}

async function findMenuUrls(websiteUrl) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(websiteUrl, { waitUntil: "networkidle2" });

  const links = await page.$$eval("a", anchors =>
    anchors.map(a => a.href)
  );

  await browser.close();

  const filtered = links.filter(link => isValidMenuUrl(link));

  return [...new Set(filtered)];
}

(async () => {
  const url = "https://131-main.com/charlotte"; // example
  const results = await findMenuUrls(url);
  console.log("Found Menu URLs:");
  console.log(results);
})();