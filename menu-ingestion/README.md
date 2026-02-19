# Menu Ingestion Service

## Setup
1. Copy `.env.example` to `.env` and set:
   - `DATABASE_URL`
   - `GOOGLE_PLACES_API_KEY`
   - `OPENAI_API_KEY`
2. Run the SQL in [db/schema.sql](db/schema.sql).
3. Install dependencies:
   - `npm install`
4. Start server:
   - `npm run dev`

## Endpoints
- `POST /restaurants/search`
  - body: `{ "query": "sushi", "location": { "lat": 35.22, "lng": -80.84, "radiusMeters": 5000 } }`

- `POST /restaurants/ingest`
  - body: `{ "place_id": "..." }` or `{ "restaurant_id": "..." }`

- `GET /restaurants/:id/menu`

## Notes
- Never scrapes blocked hosts: Yelp, DoorDash, Uber Eats, Grubhub.
- Respects robots.txt when scraping.
- Uses AI fallback only if scraping yields empty menu sections.
