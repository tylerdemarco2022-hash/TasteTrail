const puppeteer = require("puppeteer");

function isSameDomain(baseUrl, url) {
  try {
    const b = new URL(baseUrl);
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

async function crawlSiteForLinks(websiteUrl, opts = {}) {
  const {
    maxPages = 12,
    timeoutMs = 25000,
    executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  } = opts;

  const browser = await puppeteer.launch({
    executablePath: executablePath || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(timeoutMs);

  try {
    await page.goto(websiteUrl, { waitUntil: "networkidle2" });
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a"), (a) => a.href)
    );
    await browser.close();
    return links;
  } catch {
    await browser.close();
    return [];
  }
}

async function fetchPageText(url, timeoutMs = 25000, executablePath) {
  const browser = await puppeteer.launch({
    executablePath: executablePath || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(timeoutMs);

  try {
    await page.goto(url, { waitUntil: "networkidle2" });
    const text = await page.evaluate(() => document.body?.innerText || "");
    await browser.close();
    return text;
  } catch {
    await browser.close();
    return "";
  }
}

module.exports = { crawlSiteForLinks, fetchPageText, isSameDomain };