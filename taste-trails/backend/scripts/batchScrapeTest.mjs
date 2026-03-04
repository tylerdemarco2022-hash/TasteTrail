import { scrapeMenu } from "../scraper/menuScraperAgent.js";
import { supabase } from "../supabase.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import path from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse CLI arguments
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const singleUrl = urlArg ? urlArg.split('=')[1] : null;


// SINGLE URL TEST MODE
if (singleUrl) {
  console.log("🧪 Single URL Diagnostic Test");
  console.log("=".repeat(50));
  console.log(`URL: ${singleUrl}\n`);
  
  try {
    const startTime = performance.now();
    const result = await scrapeMenu(singleUrl);
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Extract items from the response structure
    const items = result.menu_sections && result.menu_sections.length > 0
      ? result.menu_sections.reduce((acc, section) => [...acc, ...(section.items || [])], [])
      : [];
    
    console.log(`📊 Results:`);
    console.log(`   Total items found: ${items.length}`);
    console.log(`   Success: ${items.length >= 6 ? '✓ YES' : '✗ NO (need 6+)'}`);
    console.log(`   Time: ${duration.toFixed(0)}ms`);
    console.log("");
    
    if (items.length > 0) {
      console.log(`🍽️  First 10 items:`);
      items.slice(0, 10).forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.name} ${item.price ? '(' + item.price + ')' : ''}`);
      });
      console.log("");
    }
    
    console.log(`🔍 Debug Metrics:`);
    if (result.debug_metrics) {
      const m = result.debug_metrics;
      console.log(`   Discovery time: ${m.discovery_time_ms}ms`);
      console.log(`   Scrape time: ${m.scrape_time_ms}ms`);
      console.log(`   Total time: ${m.total_time_ms}ms`);
      console.log(`   Pages visited: ${m.pages_visited}`);
      console.log(`   JSON payloads: ${m.json_payloads_captured}`);
      console.log(`   DOM nodes examined: ${m.dom_nodes_examined}`);
      console.log(`   Early exit triggered: ${m.early_exit_triggered ? 'YES' : 'NO'}`);
      if (m.early_exit_reason) {
        console.log(`   Early exit reason: ${m.early_exit_reason}`);
      }
      console.log(`   Sources used: ${m.sources_used.length > 0 ? m.sources_used.join(', ') : 'NONE'}`);
      console.log(`   HTTP Status: ${m.http_status || 'N/A'}`);
      console.log(`   Final URL: ${m.final_url || 'N/A'}`);
      console.log(`   HTML Size: ${m.html_size_bytes ? (m.html_size_bytes / 1000).toFixed(1) + 'KB' : 'N/A'}`);
    } else {
      console.log(`   (No debug metrics - production mode)`);
    }
    
    console.log("");
    console.log(`📍 Response Details:`);
    console.log(`   Source URL: ${result.source_url}`);
    console.log(`   Visited URLs: ${(result.visited_urls || []).length}`);
    if (result.visited_urls && result.visited_urls.length > 0) {
      result.visited_urls.forEach((url, idx) => {
        console.log(`     ${idx + 1}. ${url}`);
      });
    }
    
    console.log("");
    console.log(`⭐ Confidence: ${result.confidence || 'N/A'}`);
    
    // Check for bot block detection
    if (items.length === 0 && result.debug_html_snapshot) {
      const isBotBlock = detectBotBlock(result.debug_html_snapshot);
      console.log("");
      if (isBotBlock) {
        console.log(`⚠️  BOT BLOCK DETECTED`);
      } else {
        console.log(`ℹ️  HTML saved for inspection (0 items found)`);
      }
      
      // Save HTML snapshot
      const savedPath = saveHtmlSnapshot("fiveguys_single_test", result.debug_html_snapshot);
      if (savedPath) {
        console.log(`📄 HTML snapshot: ${savedPath}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
  
  process.exit(0);
}

// BATCH TEST MODE
const results = {
  total: 0,
  successful: 0,
  failed: 0,
  timings: [],
  itemCounts: [],
  sourceDistribution: { json: 0, dom: 0, pdf: 0, total: 0 },
  earlyExitCount: 0,
  failureReasons: {}  // Changed to count failures by type
};

// Helper to classify errors
function classifyError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  if (msg.includes("timeout")) return "timeout";
  if (msg.includes("dns") || msg.includes("err_name_not_resolved")) return "dns_error";
  if (msg.includes("http") || msg.includes("protocol") || msg.includes("refused")) return "http_error";
  return "other";
}

// Detect if HTML indicates bot blocking
function detectBotBlock(html = "") {
  const htmlLower = html.toLowerCase();
  const botBlockIndicators = [
    "access denied",
    "enable javascript",
    "cloudflare",
    "robot check",
    "captcha",
    "blocked",
    "challenge",
    "verify you are human",
    "unusual traffic",
    "temporarily blocked"
  ];
  
  for (const indicator of botBlockIndicators) {
    if (htmlLower.includes(indicator)) {
      return true;
    }
  }
  return false;
}

// Save HTML snapshot for debugging
function saveHtmlSnapshot(restaurantName, html) {
  try {
    const debugDir = path.join(path.dirname(__dirname), "debug_html");
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const filename = `${restaurantName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.html`;
    const filepath = path.join(debugDir, filename);
    fs.writeFileSync(filepath, html, 'utf8');
    return filepath;
  } catch (err) {
    console.error(`Failed to save HTML snapshot: ${err.message}`);
    return null;
  }
}

// Fetch restaurants from Supabase
console.log("🔗 Connecting to Supabase...");
const { data: restaurants, error: dbError } = await supabase
  .from('restaurants')
  .select('id, name')
  .limit(50);

if (dbError || !restaurants || restaurants.length === 0) {
  console.error("❌ Failed to fetch restaurants:", dbError?.message || "No restaurants found");
  process.exit(1);
}

// Test URLs - mix of database restaurants and known good URLs
const testRestaurants = [
  // Well-known chains with reliable menus
  { name: "Chipotle Mexican Grill", url: "https://www.chipotle.com/menu" },
  { name: "Panera Bread", url: "https://www.panerabread.com/en-us/browse/menu.html" },
  { name: "Five Guys", url: "https://www.fiveguys.com/menu" },
  { name: "Shake Shack", url: "https://www.shakeshack.com/menu" },
  { name: "Sweetgreen", url: "https://www.sweetgreen.com/menu" },
  { name: "Cava", url: "https://www.cava.com/menu" },
  { name: "Dig", url: "https://www.dignyc.com/menu" },
  
  // Append database restaurants with constructed URLs
  ...restaurants.slice(0, 42).map(r => ({
    name: r.name,
    url: `https://www.${r.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/menu`
  }))
];

console.log(`✓ Loaded ${testRestaurants.length} restaurant URLs (mix of known chains + database restaurants)`);
console.log("");
console.log("🧪 Batch Scraper Performance Test");
console.log("=".repeat(50));
console.log("");

// Run tests sequentially with progress tracking
for (let i = 0; i < testRestaurants.length; i++) {
  const { name, url } = testRestaurants[i];
  const progressPercent = Math.round(((i + 1) / testRestaurants.length) * 100);
  
  try {
    const startTime = performance.now();
    const result = await scrapeMenu(url);
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Extract items from menu_sections structure
    const items = result.menu_sections && result.menu_sections.length > 0
      ? result.menu_sections.reduce((acc, section) => [...acc, ...(section.items || [])], [])
      : [];
    const totalItems = items.length;
    const success = totalItems >= 6;

    results.total++;
    results.timings.push(duration);
    results.itemCounts.push(totalItems);

    // Track early exit
    if (result.debug_metrics?.early_exit_triggered) {
      results.earlyExitCount++;
    }

    // Track source distribution
    if (result.debug_metrics?.sources_used && result.debug_metrics.sources_used.length > 0) {
      for (const source of result.debug_metrics.sources_used) {
        const normalized = source.toLowerCase();
        if (normalized === 'json') results.sourceDistribution.json++;
        else if (normalized === 'dom') results.sourceDistribution.dom++;
        else if (normalized === 'pdf') results.sourceDistribution.pdf++;
      }
      results.sourceDistribution.total += result.debug_metrics.sources_used.length;
    }

    if (success) {
      results.successful++;
      console.log(`✓ [${progressPercent}%] ${name.substring(0, 20).padEnd(20)} | ${totalItems} items | ${duration.toFixed(0)}ms`);
    } else {
      results.failed++;
      
      // Check for bot block if HTML snapshot is available
      let isBotBlock = false;
      if (result.debug_html_snapshot && detectBotBlock(result.debug_html_snapshot)) {
        isBotBlock = true;
        results.failureReasons["bot_block"] = (results.failureReasons["bot_block"] || 0) + 1;
      } else {
        results.failureReasons["low_item_count"] = (results.failureReasons["low_item_count"] || 0) + 1;
      }
      
      // Save HTML snapshot if zero items and HTML exists
      if (totalItems === 0 && result.debug_html_snapshot) {
        const savedPath = saveHtmlSnapshot(name, result.debug_html_snapshot);
        const reason = isBotBlock ? "bot_block" : "low_item_count";
        console.log(`✗ [${progressPercent}%] ${name.substring(0, 20).padEnd(20)} | ${totalItems} items | ${duration.toFixed(0)}ms | ${reason}`);
        if (savedPath) {
          console.log(`   └─ HTML snapshot: ${savedPath}`);
        }
      } else {
        const reason = isBotBlock ? "bot_block" : "low_item_count";
        console.log(`✗ [${progressPercent}%] ${name.substring(0, 20).padEnd(20)} | ${totalItems} items | ${duration.toFixed(0)}ms | ${reason}`);
      }
    }
  } catch (error) {
    results.total++;
    results.failed++;
    const failureType = classifyError(error);
    results.failureReasons[failureType] = (results.failureReasons[failureType] || 0) + 1;
    console.log(`✗ [${progressPercent}%] ${name.substring(0, 20).padEnd(20)} | ERROR: ${failureType}`);
  }
}

console.log("");
console.log("===== SCRAPER PERFORMANCE REPORT =====");

// Calculate timing percentiles
let avgTime = 0, medianTime = 0, p95Time = 0;
if (results.timings.length > 0) {
  const sorted = [...results.timings].sort((a, b) => a - b);
  avgTime = sorted.reduce((a, b) => a + b) / sorted.length;
  medianTime = sorted[Math.floor(sorted.length / 2)];
  p95Time = sorted[Math.floor(sorted.length * 0.95)];
}

// Calculate average items
const avgItems = results.itemCounts.length > 0 
  ? results.itemCounts.reduce((a, b) => a + b) / results.itemCounts.length 
  : 0;

// Calculate early exit percentage
const earlyExitPercent = results.total > 0 
  ? ((results.earlyExitCount / results.total) * 100).toFixed(1)
  : 0;

// Calculate success rate
const successRate = results.total > 0 
  ? ((results.successful / results.total) * 100).toFixed(1)
  : 0;

// Build source breakdown string
let sourceBreakdown = "JSON: -, DOM: -, PDF: -";
if (results.sourceDistribution.total > 0) {
  const total = results.sourceDistribution.total;
  sourceBreakdown = 
    `JSON: ${((results.sourceDistribution.json / total) * 100).toFixed(0)}%, ` +
    `DOM: ${((results.sourceDistribution.dom / total) * 100).toFixed(0)}%, ` +
    `PDF: ${((results.sourceDistribution.pdf / total) * 100).toFixed(0)}%`;
}

console.log(`Total Tested: ${results.total}`);
console.log(`Success Rate: ${successRate}%`);
console.log(`Avg Time (ms): ${avgTime.toFixed(0)}`);
console.log(`Median Time (ms): ${medianTime.toFixed(0)}`);
console.log(`P95 Time (ms): ${p95Time.toFixed(0)}`);
console.log(`Avg Items: ${avgItems.toFixed(1)}`);
console.log(`Early Exit %: ${earlyExitPercent}%`);
console.log(`Source Breakdown: ${sourceBreakdown}`);
console.log("=====================================");
console.log("");

// Failure breakdown
if (Object.keys(results.failureReasons).length > 0) {
  console.log("Failure Breakdown:");
  for (const [reason, count] of Object.entries(results.failureReasons)) {
    console.log(`  ${reason}: ${count}`);
  }
  console.log("");
}

console.log("✅ Test Complete!");

