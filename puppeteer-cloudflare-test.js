const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    defaultViewport: null
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  );

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const response = await page.goto('https://culinarydropout.com/menu/', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  await page.waitForTimeout(5000);

  console.log('FINAL_URL:', page.url());
  console.log('RESPONSE_STATUS:', response?.status());
  console.log('BODY_TEXT_LENGTH:', await page.evaluate(() => document.body.innerText.length));
  console.log('BODY_HTML_LENGTH:', (await page.content()).length);

  await browser.close();
})();
