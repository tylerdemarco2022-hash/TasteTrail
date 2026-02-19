t my app for me
-- Core schema for restaurant menu ingestion
-- Compatible with Supabase/PostgreSQL

create extension if not exists "uuid-ossp";

-- Restaurants master
create table if not exists restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  place_id text unique not null,
  website_url text,
  menu_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_restaurants_name on restaurants(name);

-- Menus (versioned snapshots)
create table if not exists menus (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  source text not null check (source in ('scrape', 'ai')),
  raw_url text,
  raw_html text,
  raw_text text,
  created_at timestamptz not null default now()
);

-- Menu sections
create table if not exists menu_sections (
  id uuid primary key default uuid_generate_v4(),
  menu_id uuid not null references menus(id) on delete cascade,
  name text not null,
  position int not null default 0
);

-- Menu items
create table if not exists menu_items (
  id uuid primary key default uuid_generate_v4(),
  section_id uuid not null references menu_sections(id) on delete cascade,
  name text not null,
  description text,
  price numeric,
  currency text default 'USD',
  position int not null default 0
);

-- Permanent cache of menu JSON for fast reads
create table if not exists menu_cache (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  menu_json jsonb not null,
  created_at timestamptz not null default now()
);

-- Store request attempts and status to prevent repeated failures
create table if not exists ingestion_attempts (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  status text not null check (status in ('success', 'failed')),
  error_message text,
  attempt_count int not null default 1,
  last_attempt_at timestamptz not null default now()
);

-- Saved restaurants per user (simple persistent saves)
create table if not exists saved_restaurants (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

create index if not exists idx_restaurants_place_id on restaurants(place_id);
create index if not exists idx_menus_restaurant_id on menus(restaurant_id);
create index if not exists idx_sections_menu_id on menu_sections(menu_id);
create index if not exists idx_items_section_id on menu_items(section_id);
