-- SMaRT-PDM Android FCM device-token registry.
-- Server-owned table: mobile clients register through the authenticated API.

CREATE TABLE IF NOT EXISTS public.user_device_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  device_token text NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_device_tokens_user_token_key
    UNIQUE (user_id, device_token)
);

ALTER TABLE public.user_device_tokens
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'android';

ALTER TABLE public.user_device_tokens
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_device_tokens
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id
  ON public.user_device_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_platform
  ON public.user_device_tokens(platform);

ALTER TABLE public.user_device_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_device_tokens IS
  'Server-managed FCM registration tokens for authenticated SMaRT-PDM users.';
