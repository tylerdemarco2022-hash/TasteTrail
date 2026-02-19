-- Enable vector extension for embeddings
create extension if not exists vector;

-- Restaurants table
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  state text,
  phone text,
  website text,
  google_place_id text,
  cuisine text[],
  dietary_tags text[],
  embedding vector(1536),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_restaurants_google_place_id on restaurants(google_place_id);

-- Menus (logical grouping) - optional
create table if not exists menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  source text,
  retrieved_at timestamptz default now()
);

-- Menu items
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  menu_id uuid references menus(id) on delete set null,
  menu_section text,
  name text not null,
  description text,
  price numeric,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_menu_items_restaurant_id on menu_items(restaurant_id);

-- Menu change log
create table if not exists menu_change_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  change_type text not null,
  payload jsonb,
  created_at timestamptz default now()
);

-- Manual review queue
create table if not exists manual_review_queue (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id),
  reason text,
  created_at timestamptz default now()
);
