# Known Issues Log

---
**Date:** 2026-03-01

## Issue: 422 Confidence Blocking Cached Menus
- **Problem:** Scrapes with confidence < 422 are blocked from DB
- **Root Cause:** Low-quality or partial menu data
- **Fix:** Improve validation, tune scoring
- **Status:** Monitoring

## Issue: Unicode JSON Parse Errors
- **Problem:** Scraper fails on some unicode menu data
- **Root Cause:** Invalid encoding or malformed JSON
- **Fix:** Add encoding checks, try/catch parse
- **Status:** Monitoring

## Issue: 0 Item Scrape Failures
- **Problem:** Scraper sometimes returns 0 menu items
- **Root Cause:** Source structure change, block, or bad input
- **Fix:** Add fallback logic, improve error handling
- **Status:** Monitoring
