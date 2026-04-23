## AI Usage Guidelines

- Never paste full files unless necessary
- Always reference documentation files first
- Always isolate failing function before asking AI
- Logs must be trimmed to relevant error block only
- Architecture changes must update ARCHITECTURE.md

# TasteTrails

TasteTrails is a platform for discovering, rating, and managing restaurant menus with advanced scraping and data validation.

## Tech Stack
- Node.js (Express)
- Supabase (Postgres)
- Vite (Frontend)
- Sharp, Multer (Image processing)
- Sentry (Monitoring)

## Running Locally
1. Clone the repo
2. Install dependencies: `npm install`
3. Set environment variables (see below)
4. Start backend: `node server/index.js`
5. Start frontend: `npm run dev`

## Required Environment Variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_TOKEN`
- `GOOGLE_CLIENT_ID` (optional, for OAuth)
- `GOOGLE_CLIENT_SECRET` (optional, for OAuth)
- `GOOGLE_REDIRECT_URI` (optional, for OAuth)

## Core Features
- Restaurant discovery & search
- Menu scraping & persistence
- Ratings & confidence scoring
- Admin management tools
- Image upload & processing
- OAuth (Google, optional)

## Folder Structure
```
taste-trails/
├── backend/    # Core business logic, scrapers, utilities
├── server/     # Backend API & routes
├── frontend/   # Frontend (Vite)
├── scripts/    # Migration, checks, and utilities
└── ...
```
