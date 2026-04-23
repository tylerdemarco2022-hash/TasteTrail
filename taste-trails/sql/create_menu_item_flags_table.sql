-- Menu item flags for admin review

CREATE TABLE IF NOT EXISTS public.menu_item_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NULL REFERENCES public.menu_items(id) ON DELETE SET NULL,
  restaurant_id UUID NULL REFERENCES public.restaurants(id) ON DELETE SET NULL,
  restaurant_name TEXT,
  item_name TEXT NOT NULL,
  reason TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  reported_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_email TEXT,
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_item_flags_status ON public.menu_item_flags(status);
CREATE INDEX IF NOT EXISTS idx_menu_item_flags_restaurant ON public.menu_item_flags(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_flags_reported_by ON public.menu_item_flags(reported_by);

ALTER TABLE public.menu_item_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert flags" ON public.menu_item_flags
  FOR INSERT WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Admins can view flags" ON public.menu_item_flags
  FOR SELECT USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update flags" ON public.menu_item_flags
  FOR UPDATE USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'admin');
