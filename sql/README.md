Run this migration in the Supabase SQL editor

1. Open your Supabase project at https://app.supabase.com and select the project.
2. In the left sidebar open "SQL" → "Query editor".
3. Create a new query and paste the contents of `sql/001_init_schema.sql`.
4. Run the query. It will:
   - enable the `pgcrypto` extension (for `gen_random_uuid()`),
   - create `restaurants`, `categories`, and `dishes` tables,
   - add the requested indexes.

Notes
- If you prefer `uuid_generate_v4()` instead of `gen_random_uuid()`, enable the `uuid-ossp` extension and replace the default expressions accordingly.
- Consider creating the functional `lower(dish_name)` index if you frequently perform case-insensitive searches with `ILIKE` for better performance (commented at the bottom of the SQL file).
- After running the migration, verify tables exist from the Supabase table browser and test the `/api/search-dishes?q=...` endpoint.
