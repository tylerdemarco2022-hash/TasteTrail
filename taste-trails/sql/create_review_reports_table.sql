-- Review reports for admin moderation

CREATE TABLE IF NOT EXISTS public.review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_rating_id UUID NULL REFERENCES public.dish_ratings(id) ON DELETE SET NULL,
  menu_item_id UUID NULL REFERENCES public.menu_items(id) ON DELETE SET NULL,
  restaurant_id UUID NULL REFERENCES public.restaurants(id) ON DELETE SET NULL,
  restaurant_name TEXT,
  dish_name TEXT,
  rating_value NUMERIC,
  comment_snapshot TEXT,
  reason TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  reported_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_email TEXT,
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_reports_status ON public.review_reports(status);
CREATE INDEX IF NOT EXISTS idx_review_reports_reported_by ON public.review_reports(reported_by);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert review reports" ON public.review_reports
  FOR INSERT WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Admins can view review reports" ON public.review_reports
  FOR SELECT USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update review reports" ON public.review_reports
  FOR UPDATE USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'admin');
