-- Daily anonymous website visitor aggregates for the public landing-page counter.
-- Visitor identifiers remain one-way hashes and calendar boundaries use the
-- institution's Philippine timezone.

CREATE TABLE IF NOT EXISTS public.public_web_visitor_days (
  visitor_hash text NOT NULL,
  visit_date date NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  visit_count bigint NOT NULL DEFAULT 1 CHECK (visit_count >= 1),
  PRIMARY KEY (visitor_hash, visit_date)
);

CREATE INDEX IF NOT EXISTS idx_public_web_visitor_days_date
  ON public.public_web_visitor_days (visit_date DESC);

-- Seed the daily table from the anonymous records already retained by the
-- System Monitor. Future visits are recorded directly into both tables.
INSERT INTO public.public_web_visitor_days (
  visitor_hash,
  visit_date,
  first_seen_at,
  last_seen_at,
  visit_count
)
SELECT
  visitor_hash,
  (last_seen_at AT TIME ZONE 'Asia/Manila')::date,
  first_seen_at,
  last_seen_at,
  GREATEST(visit_count, 1)
FROM public.public_web_visitors
ON CONFLICT (visitor_hash, visit_date) DO NOTHING;

ALTER TABLE public.public_web_visitor_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_web_visitor_days FROM anon, authenticated;

COMMENT ON TABLE public.public_web_visitor_days IS
  'Daily anonymous browser visits used for public visitor counts; accessible only through the backend service role.';
