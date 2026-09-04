-- Durable account-session revocation state consumed by every mobile backend
-- instance. It is security state, not a delivery/outbox queue.

CREATE TABLE IF NOT EXISTS public.account_session_revocations (
  user_id uuid PRIMARY KEY
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  token_version integer NOT NULL CHECK (token_version >= 1),
  reason text NOT NULL DEFAULT 'ACCOUNT_INACTIVE',
  revoked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_session_revocations_updated
  ON public.account_session_revocations (updated_at DESC);

ALTER TABLE public.account_session_revocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_session_revocations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.account_session_revocations TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'account_session_revocations'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.account_session_revocations;
  END IF;
END
$$;
