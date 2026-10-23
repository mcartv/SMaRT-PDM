-- Run manually in Supabase SQL Editor before using logo uploads.
BEGIN;
CREATE TABLE IF NOT EXISTS public.portal_logos (
  scope_key text PRIMARY KEY CHECK (scope_key = 'public' OR scope_key ~ '^account/[0-9a-fA-F-]{36}$'),
  image_url text,
  storage_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((image_url IS NULL) = (storage_path IS NULL))
);
ALTER TABLE public.portal_logos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_logos FROM anon, authenticated;
-- Custom backend JWTs authorize access through Express, never the browser Data API.
GRANT ALL ON public.portal_logos TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('portal-branding','portal-branding',true,3145728,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
COMMIT;
