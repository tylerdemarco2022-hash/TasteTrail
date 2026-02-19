-- Supabase table: restaurant_menus
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS restaurant_menus (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id text NOT NULL,
    restaurant_name text NOT NULL,
    source_url text NOT NULL,
    source_type text NOT NULL, -- html | pdf | image | platform
    menu_json jsonb NOT NULL,
    item_count integer NOT NULL,
    validation_passed boolean NOT NULL,
    validation_notes text,
    extracted_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT restaurant_menus_unique_restaurant_id UNIQUE (restaurant_id),
    CONSTRAINT menu_json_not_empty CHECK (jsonb_array_length(menu_json->'categories') > 0)
);

-- Only store menus that pass validation
-- If validation_passed = false, do NOT store menu_json
-- Never mix menus across restaurant_id
-- Never store guessed or placeholder content
