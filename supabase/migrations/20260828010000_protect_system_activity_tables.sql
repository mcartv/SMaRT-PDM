-- System Monitor data is backend-internal diagnostic information. Keep these
-- public-schema tables unavailable through the Supabase Data API. The backend
-- PostgreSQL connection continues to access them with its server-side role.

ALTER TABLE public.system_activity_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_web_visitors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.system_activity_hourly FROM anon, authenticated;
REVOKE ALL ON TABLE public.system_active_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.public_web_visitors FROM anon, authenticated;

-- No anon/authenticated policies are intentionally created. System Monitor
-- reads and writes must pass through the protected backend endpoints.
