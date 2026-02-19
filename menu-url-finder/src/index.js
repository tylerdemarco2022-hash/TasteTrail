require("dotenv").config();

console.log("SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("SERVICE_KEY =", process.env.SUPABASE_SERVICE_ROLE_KEY ? "LOADED" : "MISSING");

(async () => {

  const express = require("express");
  const { findOfficialWebsiteSerpApi } = require("./officialWebsiteFinder");
  const { crawlSiteForLinks, fetchPageText } = require("./siteCrawler");
  const { filterCandidateLinks, scoreByPageText } = require("./menuDetector");
  const { pickBestByType } = require("./score");
  const rateLimit = require("express-rate-limit");
  const Redis = require("redis");
  const { createClient } = require("@supabase/supabase-js");
  const { queue } = require("./queue");
  const logger = require("./logger");
  const queueEvents = require("./queueMonitor");
  const { normalizeUrl } = require("./urlUtils");
  const { Worker } = require("bullmq");
  const { connection } = require("./queue");
  const cors = require("cors");

  // Initialize Redis client
  const redisClient = Redis.createClient();
  redisClient.on("error", (err) => console.error("Redis Client Error", err));
  await redisClient.connect();

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(cors({
    origin: ["http://localhost:5174", "http://localhost:5173", "http://localhost:5179"],
    credentials: true
  }));

  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // Limit each IP to 20 requests per minute
  });

  app.use(limiter);

  // Middleware to check cache
  async function checkCache(req, res, next) {
    const { name, city, state, country } = req.body;
    const cacheKey = `${name}-${city}-${state}-${country}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
      next();
    } catch (err) {
      console.error("Error checking cache", err);
      next();
    }
  }

  app.use(checkCache);

  app.post("/find-menu-urls", async (req, res) => {
    try {
      const { name, city, state, country, deepScore = false, forceRefresh = false } = req.body || {};
      if (!name) return res.status(400).json({ error: "Missing required field: name" });

      const serpKey = process.env.SERPAPI_KEY;
      if (!serpKey) return res.status(500).json({ error: "SERPAPI_KEY not set" });

      const cacheKey = `${name}-${city}-${state}-${country}`;

      const restaurant = await supabase
        .from("restaurants")
        .select("id, name, city, state, menu_status, menu_last_checked")
        .eq("id", restaurantId)
        .single();

      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const daysOld = restaurant.menu_last_checked
        ? (Date.now() - new Date(restaurant.menu_last_checked).getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      if (!forceRefresh && restaurant.menu_status === "ready" && daysOld < 7) {
        return res.json({
          message: "Menu data is up-to-date",
          source: "cache",
          data: restaurant
        });
      }

      await queue.add(
        "crawlRestaurant",
        { id: restaurant.id, name: restaurant.name, city: restaurant.city, state: restaurant.state },
        {
          jobId: `${restaurant.id}`,
          removeOnComplete: 100,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000
          }
        }
      );

      return res.json({
        message: "Request received. Processing in background.",
        jobId: job.id,
      });
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Unknown error" });
    }
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", port: process.env.PORT });
  });

  app.get("/", (req, res) => {
    res.json({ message: "Backend is alive" });
  });

  const worker = new Worker("menuQueue", async (job) => {
    const { name, city, state, country, deepScore, serpKey, cacheKey } = job.data;

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

    const links = await crawlSiteForLinks(websiteResult.website, {
      maxPages: 12,
      timeoutMs: 25000,
    });

    const candidates = filterCandidateLinks(links);

    let enriched = candidates.map((u) => ({ url: u, urlScore: 0, textScore: 0, total: 0 }));
    if (deepScore) {
      enriched = [];
      for (const u of candidates.slice(0, 25)) {
        const text = await fetchPageText(u);
        const tScore = scoreByPageText(text);
        enriched.push({ url: u, textScore: tScore });
      }
    }

    const { best, ranked } = pickBestByType(candidates);

    const result = {
      input: { name, city, state, country },
      website: websiteResult.website,
      menus: best,
      ranked_candidates: ranked,
      confidence_score: 90,
      source_type: websiteResult.source,
      deep_score_sample: deepScore ? enriched : undefined,
      debug: websiteResult,
    };

    await redisClient.setEx(cacheKey, 604800, JSON.stringify(result)); // Cache for 7 days
    return result;
  }, { connection });

  const port = process.env.PORT || 8080;
  app.listen(port, () => console.log(`Menu URL Finder running on :${port}`));

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

})();