console.log("🔥 UNIFIED MENU URL FINDER FILE LOADED");
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const MENU_URLS_PATH = path.resolve("menu-urls-found.json");

const manualPlatforms = [
  "toasttab.com",
  "clover.com",
  "chownow.com",
  "order.online",
  "squarespace.com",
  "wordpress.com"
];

const commonPaths = [
  "/menu",
  "/menus",
  "/dinner",
  "/food",
  "/eat",
  "/order",
  "/food-menu",
  "/dinner-menu",
  "/lunch-menu"
];

export async function findRestaurantMenuURL(name) {
  console.log("🔥 UNIFIED FINDER CALLED WITH:", name);
  console.log("URL FINDER START:", name);
  // STEP 1: Manual Overrides from menu-urls-found.json
  let menuUrls = {};
  try {
    menuUrls = JSON.parse(fs.readFileSync(MENU_URLS_PATH, "utf8"));
  } catch (e) {}
  const lowerName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (menuUrls[name] && menuUrls[name][0] && menuUrls[name][0].url) {
    console.log("URL FINAL:", menuUrls[name][0].url);
    return menuUrls[name][0].url;
  }
  if (menuUrls[lowerName] && menuUrls[lowerName][0] && menuUrls[lowerName][0].url) {
    console.log("URL FINAL:", menuUrls[lowerName][0].url);
    return menuUrls[lowerName][0].url;
  }

  // STEP 2: Known Platform Patterns
  let candidates = [];
  for (const platform of manualPlatforms) {
    candidates.push(`https://www.${lowerName}.${platform}`);
    candidates.push(`https://${lowerName}.${platform}`);
  }

  // STEP 3: Domain Guessing
  candidates.push(`https://www.${lowerName}.com`);
  candidates.push(`https://${lowerName}.com`);

  // STEP 4: Append common paths
  let domainCandidates = [...candidates];
  for (const domain of domainCandidates) {
    for (const path of commonPaths) {
      candidates.push(domain + path);
    }
  }

  // STEP 5: HEAD request validation
  for (const url of candidates) {
    console.log("URL CANDIDATE:", url);
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.status === 200) {
        console.log("URL VALID:", url);
        console.log("URL FINAL:", url);
        return url;
      }
    } catch (e) {}
  }
  console.log("URL FINAL:", null);
  return null;
}
