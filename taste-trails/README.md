# TasteTrails

A food-focused social app with restaurant menus, user ratings, and authentication.

## 🚀 Quick Start

### Frontend
```bash
cd taste-trails
npm install
npm run dev
# Opens at http://localhost:5173
```

### Backend
```bash
npm run server
# API at http://localhost:8787
```

## ✨ Features

- ✅ User authentication (signup/login via Supabase)
- ✅ 1-10 rating system for dishes
- ✅ Restaurant menu caching (17+ Fort Mill restaurants)
- ✅ Admin role with protected routes
- ✅ Community ratings with aggregates
- ✅ Menu scraping with AI parsing
- ✅ Row-level security policies

## 🔧 Backend Setup

### 1. Configure Supabase

Update `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
```

Get these from: Supabase Dashboard → Settings → API

### 2. Create Database Tables

Run these SQL scripts in Supabase SQL Editor (in order):

1. `backend/sql/create_users_table.sql`
2. `backend/sql/create_restaurants_table.sql`
3. `backend/sql/create_ratings_table.sql`
4. `backend/sql/create_admin_logs_table.sql`

### 3. Create Admin Account

Sign up through the app, then run in Supabase SQL Editor:

```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'your@email.com';
```

### 4. Test the API

```bash
# Health check
curl http://localhost:8787/api/health

# Sign up
curl -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
```

## 📚 API Documentation

### Authentication
- `POST /auth/signup` - Create account
- `POST /auth/login` - Login (returns JWT token)
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout

### Ratings (1-10 scale)
- `GET /api/ratings/restaurant/:id` - Get ratings with aggregates
- `POST /api/ratings` - Add/update rating (auth required)
- `PUT /api/ratings/:id` - Update own rating
- `DELETE /api/ratings/:id` - Delete own rating

### Restaurants (Cached Menus)
- `GET /api/restaurants` - List all restaurants
- `GET /api/restaurants/:id` - Get restaurant + menu
- `GET /api/restaurants/search/:query` - Search
- `POST /api/restaurants` - Cache menu (admin only)
- `PUT /api/restaurants/:id` - Update menu (admin only)

### Admin
- `GET /admin/users` - List all users
- `PUT /admin/users/:id/role` - Change user role
- `DELETE /admin/ratings/:id` - Delete any rating
- `GET /admin/logs` - View admin actions

Full API docs: See `BACKEND_SETUP.md`

## 🎯 Database Tables

- **users** - User profiles with roles (user/admin)
- **restaurants** - Cached menus (17+ Fort Mill locations)
- **ratings** - User ratings (1-10 per dish)
- **admin_logs** - Admin action tracking

All tables have Row-Level Security enabled.

## 📁 Project Structure

```
taste-trails/
├── backend/
│   ├── sql/              # Database schemas
│   ├── auth.js           # Auth middleware
│   ├── supabase.js       # Supabase client
│   ├── fetch_menus.js    # 17 restaurant menus
│   └── ...               # Scrapers, parsers, etc.
├── server/
│   └── index.js          # Express API server
├── src/
│   ├── components/       # React components
│   └── App.jsx           # Main app
└── package.json
```

## 🔒 Security

- JWT authentication via Supabase Auth
- Row-Level Security on all tables
- Admin-only routes protected
- Users can only modify their own ratings
- All admin actions logged

## 🛠️ Development

### Scripts
- `npm run dev` - Start frontend (Vite)
- `npm run server` - Start backend API
- `npm run fetch-menus` - Fetch menus from Yelp
- `npm run scrape` - Scrape menus with Playwright

### Tech Stack
- **Frontend**: React, Vite, TailwindCSS
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (JWT)
- **APIs**: Yelp, Google Places, OpenAI

## Live menus

Dish search reads real menu items from restaurant websites and menu PDFs. Results are cached per restaurant (`MENU_CACHE_TTL_HOURS`, default 12) so typing does not start a new scrape. Prices are shown only when the page or PDF lists them. If a menu cannot be retrieved, the app says so and can show a previously saved menu for that restaurant.

`npm run menu-coverage` checks every restaurant the app already knows.

| Variable | Required for | Notes |
| --- | --- | --- |
| `GOOGLE_PLACES_API_KEY` | Richer nearby restaurants (website, hours, rating, photo) | Places API (New). Leave unset to use OpenStreetMap, which needs no key. This key does not contain menu items. Nearby Search Enterprise is about $35 per 1,000 requests after 1,000 free requests each month. A photo image is a separate request, about $7 per 1,000 after 1,000 free. A few dozen lookups a day stays at $0 or a few dollars. |
| `MENU_CACHE_TTL_HOURS` | No | How long a fetched menu is reused. |
| `MENU_CACHE_DIR` | No | Cache directory. Defaults to `data/menu-cache` and is not committed. |

`YELP_API_KEY` does not return dish lists. It is not used for live menus.

## 📝 Notes

This repository now includes a backend scaffold to fetch restaurant data from Yelp, perform OCR on menu photos, parse menus via OpenAI, and persist results to Supabase.

Quick start (frontend):

```bash
cd taste-trails
npm install
npm run dev
```

Backend scaffold (examples):

1. Copy `.env.example` to `.env` and fill in `YELP_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.

2. Fetch Charlotte restaurants from Yelp:

```bash
npm run yelp-fetch
```

3. Process restaurants (OCR -> AI -> Supabase):

```bash
npm run process
```

Notes:
- The `process` script is a scaffold: it attempts to fetch business photos from Yelp, run `tesseract.js` OCR on them, send OCR text to OpenAI to extract structured menus, and upsert into Supabase. It requires API keys.
- You should create a Supabase table `restaurants` with a `menu` JSON column. Example:

```sql
create table restaurants (
	id bigint generated by default as identity primary key,
	name text,
	yelp_id text,
	menu jsonb
);
```

If you'd like, I can now scaffold a Playwright scraper to gather menu photos automatically, or seed 20 Charlotte restaurants and demonstrate the OCR+AI pipeline locally without external scraping. Which would you prefer?

Playwright scraper
------------------
Run the Playwright scraper after you have `./data/yelp_charlotte.json`:

```bash
npm run scrape
```

This will visit each Yelp business URL, try to extract menu/photo URLs from the Photos section, download images to `./data/menu_images/<business_id>/`, and write a manifest to `./data/menu_photos.json`.

Notes on scraping:
- The scraper is a helper for convenience. Scraping third-party sites must respect terms of service and robots.txt; use responsibly.
- Playwright and browsers will be added as devDependencies; the first run may prompt to install browser binaries.
