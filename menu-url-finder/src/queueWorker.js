const Queue = require("bull");
const { findOfficialWebsiteSerpApi } = require("./officialWebsiteFinder");
const { crawlSiteForLinks, fetchPageText } = require("./siteCrawler");
const { filterCandidateLinks, scoreByPageText } = require("./menuDetector");
const { pickBestByType } = require("./score");
const Redis = require("redis");

// Initialize Redis client
const redisClient = Redis.createClient();
redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.connect();

// Initialize Bull queue
const menuQueue = new Queue("menuQueue", {
  redis: {
    host: "127.0.0.1",
    port: 6379,
  },
});

menuQueue.process(async (job) => {
  const { name, city, state, country, deepScore, serpKey, cacheKey } = job.data;

  // Step 1: Find official website
  const websiteResult = await findOfficialWebsiteSerpApi({ name, city, state, country }, serpKey);
  if (!websiteResult.website) {
    const fallback = await findOfficialWebsiteSerpApi(
      { name: `${name} menu`, city, state, country },
      serpKey
    );

    if (!fallback.website) {
      const result = {
        input: { name, city, state, country },
        website: null,
        menus: {},
        ranked_candidates: [],
        confidence_score: 0,
        source_type: "none",
        reason: "No official website found via SerpAPI (including fallback)",
        debug: { primary: websiteResult, fallback },
      };
      await redisClient.setEx(cacheKey, 604800, JSON.stringify(result)); // Cache for 7 days
      return result;
    }

    websiteResult.website = fallback.website;
  }

  // Step 2: Crawl site for links
  const links = await crawlSiteForLinks(websiteResult.website, {
    maxPages: 12,
    timeoutMs: 25000,
  });

  // Step 3: Filter menu-ish candidates
  const candidates = filterCandidateLinks(links);

  // Step 3b (optional): Deep score by checking page text for menu structure
  let enriched = candidates.map((u) => ({ url: u, urlScore: 0, textScore: 0, total: 0 }));
  if (deepScore) {
    enriched = [];
    for (const u of candidates.slice(0, 25)) { // cap to keep it fast/cheap
      const text = await fetchPageText(u);
      const tScore = scoreByPageText(text);
      enriched.push({ url: u, textScore: tScore });
    }
  }

  const { best, ranked } = pickBestByType(candidates);

  const result = {
    input: { name, city, state, country },
    website: websiteResult.website,
    menus: best,                     // best guesses by type
    ranked_candidates: ranked,       // sorted list (highest first)
    confidence_score: 90,            // Example confidence score
    source_type: websiteResult.source,
    deep_score_sample: deepScore ? enriched : undefined,
    debug: websiteResult,
  };

  await redisClient.setEx(cacheKey, 604800, JSON.stringify(result)); // Cache for 7 days
  return result;
});

console.log("Queue worker is running...");