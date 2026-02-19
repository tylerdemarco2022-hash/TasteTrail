const { Worker } = require("bullmq");
const { connection } = require("./queue");

const worker = new Worker("menuQueue", async (job) => {
  const { name, city, state, country, deepScore, serpKey, cacheKey } = job.data;

  let browser;
  const startTime = Date.now();
  let candidateCount = 0;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    });

    const result = await withTimeout(runCrawlLogic(job.data), 45000);

    candidateCount = result.links.length;

    const filteredLinks = filterCandidateLinks(result.links).map(normalizeUrl);

    // Domain whitelist enforcement
    const validLinks = filteredLinks.filter((link) => {
      const isSameDomain = isSameDomain(result.website, link);
      const isPdf = isPdfUrl(link);
      const isSemiOfficial = isSemiOfficialHost(link, name);
      return (
        isSameDomain ||
        (isPdf && isSameDomain) ||
        (isSemiOfficial && discoveredFromInternal(link))
      );
    });

    const { best, ranked } = pickBestByType(validLinks);

    let confidence = 0;
    if (best.dinner) confidence += 30;
    if (best.lunch) confidence += 20;
    if (best.drinks) confidence += 20;
    if (best.pdf) confidence += 30;
    confidence = Math.min(confidence, 100);

    if (!best.dinner && !best.lunch && !best.drinks && !best.pdf) {
      throw new Error("No valid menu URLs found.");
    }

    const endTime = Date.now();

    // Update worker save logic to use public.restaurants table
    await supabase.from("restaurants").update({
      dinner_url: best.dinner || null,
      lunch_url: best.lunch || null,
      drinks_url: best.drinks || null,
      pdf_url: best.pdf || null,
      menu_confidence: confidence,
      menu_status: "ready",
      menu_last_checked: new Date(),
      menu_error: null,
      crawl_ms: endTime - startTime,
      candidate_count: validLinks.length
    }).eq("id", job.data.id);

    logger.info(`Job ${job.id} completed successfully.`);
  } catch (err) {
    logger.error(`Job ${job.id} failed: ${err.message}`);
    await supabase.from("restaurant_menus").upsert({
      restaurant_name: name,
      city,
      state,
      status: "error",
      error_message: err.message,
      last_checked: new Date(),
    }, {
      onConflict: "restaurant_name,city,state",
    });
  } finally {
    if (browser) await browser.close();
  }
}, { connection });

module.exports = worker;