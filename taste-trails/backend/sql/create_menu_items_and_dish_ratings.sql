-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    price numeric,
    photo_url text,
    menu_id uuid REFERENCES menus(id) ON DELETE SET NULL,
    rating_weighted float,
    rating_bayesian float,
    rating_count int DEFAULT 0,
    volatility_stddev float,
    emoji_tags text[],
    confidence_score float,
    last_computed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create dish_ratings table
CREATE TABLE IF NOT EXISTS dish_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
    rating numeric NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (menu_item_id, user_id)
);
