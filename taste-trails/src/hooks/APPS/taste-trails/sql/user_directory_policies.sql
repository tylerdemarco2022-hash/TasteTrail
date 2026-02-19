-- Supabase policies to allow authenticated users to list basic user info
BEGIN;

-- Ensure RLS is enabled on the users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Restrict grants to only needed columns, then explicitly allow select
REVOKE ALL ON public.users FROM authenticated;
GRANT SELECT (id, name, email) ON public.users TO authenticated;

-- Policy: authenticated users can select users
DROP POLICY IF EXISTS "Users visible to authenticated" ON public.users;
CREATE POLICY "Users visible to authenticated"
ON public.users FOR SELECT
TO authenticated
USING (true);

-- Optional: create a view for directory queries
CREATE OR REPLACE VIEW public.user_directory AS
SELECT id, name, email FROM public.users;
GRANT SELECT ON public.user_directory TO authenticated;

COMMIT;
