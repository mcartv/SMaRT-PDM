-- Daily anonymous public-web visitor rollup for Admin > System Monitor.
-- Stores only the existing hashed anonymous browser identifier; no IP address,
-- raw browser identifier, bearer token, or personal information is added.

CREATE TABLE IF NOT EXISTS public.public_web_visitor_daily (
  visit_date date NOT NULL,
  visitor_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  visit_count bigint NOT NULL DEFAULT 1 CHECK (visit_count >= 1),
  PRIMARY KEY (visit_date, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_public_web_visitor_daily_date
  ON public.public_web_visitor_daily (visit_date DESC);


-- Best-effort seed from the existing lifetime visitor table so the card is not
-- empty immediately after deployment. Exact per-day history becomes accurate
-- from this migration forward because older daily visits were not previously stored.
INSERT INTO public.public_web_visitor_daily (
  visit_date,
  visitor_hash,
  first_seen_at,
  last_seen_at,
  visit_count
)
SELECT
  (last_seen_at AT TIME ZONE 'Asia/Manila')::date,
  visitor_hash,
  first_seen_at,
  last_seen_at,
  1
FROM public.public_web_visitors
WHERE last_seen_at IS NOT NULL
ON CONFLICT (visit_date, visitor_hash) DO NOTHING;

ALTER TABLE public.public_web_visitor_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_web_visitor_daily FROM anon, authenticated;
