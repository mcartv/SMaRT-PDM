-- SMaRT-PDM system activity diagnostics.
-- Stores aggregated authenticated request volume, anonymous public-web browser
-- activity, and hashed staff-session presence. No raw bearer tokens or visitor
-- IP addresses are persisted by this feature.

CREATE TABLE IF NOT EXISTS public.system_activity_hourly (
  bucket_hour timestamptz PRIMARY KEY,
  authenticated_requests bigint NOT NULL DEFAULT 0 CHECK (authenticated_requests >= 0),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_active_sessions (
  session_key text PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_active_sessions_last_seen
  ON public.system_active_sessions (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.public_web_visitors (
  visitor_hash text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  visit_count bigint NOT NULL DEFAULT 1 CHECK (visit_count >= 1),
  last_path text NULL
);

CREATE INDEX IF NOT EXISTS idx_public_web_visitors_last_seen
  ON public.public_web_visitors (last_seen_at DESC);
