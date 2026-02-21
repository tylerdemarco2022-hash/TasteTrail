import puppeteer from "puppeteer";

console.log("NODE VERSION:", process.version);
console.log("PUPPETEER_IMPORT_TYPE:", typeof puppeteer);
console.log("PUPPETEER_KEYS:", Object.keys(puppeteer || {}));

const browser = await puppeteer.launch({ headless: true });
console.log("BROWSER_LAUNCHED");

await browser.close();
console.log("BROWSER_CLOSED");
