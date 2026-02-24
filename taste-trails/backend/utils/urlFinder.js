import express from "express";
import { findRestaurantMenuURL } from "../../utils/urlFinder.js";
import { scrapeMenu } from "../../scraper/menuScraperAgent.js";

const router = express.Router();

router.get("/restaurants/by-name/:name/full-menu", async (req, res) => {
  try {
    const name = req.params.name;

    console.log("MENU ROUTE HIT:", name);

    const menuUrl = await findRestaurantMenuURL(name);

    if (!menuUrl) {
      console.log("NO MENU URL FOUND");
      return res.status(404).json({ error: "Menu URL not found" });
    }

    console.log("FINAL URL:", menuUrl);

    const result = await scrapeMenu(menuUrl);

    return res.json(result);

  } catch (err) {
    console.error("MENU ROUTE ERROR:", err);
    return res.status(500).json({ error: "Failed to fetch menu" });
  }
});

export default router;