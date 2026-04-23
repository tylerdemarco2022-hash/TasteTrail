# TasteTrails Architecture

## Backend Request Flow
- Client sends HTTP request (REST API)
- Express route handler validates/authenticates
- DB-first lookup: check Supabase/Postgres for cached data
- If not found or stale, trigger scraping pipeline
- Return data to client (cached or fresh)

## DB-First Lookup Logic
- Always check DB for menu/restaurant before scraping
- Use indexed fields for fast lookup
- If data is fresh (TTL), return immediately
- If data is missing/stale, proceed to scrape

## Scraping Pipeline Stages
- Input normalization (URL, name)
- Source resolver (determine menu source)
- Scraper agent (fetch & parse menu)
- Data validation & cleaning
- Confidence scoring
- Persistence to DB
- Indexing for search

## Confidence Scoring System
- Assigns score to each scrape (0-1000)
- Factors: completeness, parse errors, freshness, structure
- Block persistence if score < threshold (e.g. 422)
- Used for monitoring and alerting

## Menu Persistence Logic
- Upsert menu data by restaurant ID
- Store raw and cleaned menu JSON
- Track updated_at, source, confidence
- Remove/replace old menu versions

## Ratings Flow
- User submits rating via API
- Validate user & restaurant
- Store rating in DB (with timestamp)
- Update aggregate stats (avg, count)
- Expose via API for frontend

```
+--------+      +----------+      +-----------+
| Client | ---> | Backend  | ---> | Database  |
+--------+      +----------+      +-----------+
      |   <---  (cache/db) <---   |
      +---------------------------+
```
