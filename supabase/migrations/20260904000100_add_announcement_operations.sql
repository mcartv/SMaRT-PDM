-- Idempotency ledger for Admin announcement mutations.
-- This is intentionally workflow-specific; it is not a generic event outbox.

CREATE TABLE IF NOT EXISTS public.announcement_operations (
  operation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_key text NOT NULL,
  action text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  announcement_id uuid NULL
    REFERENCES public.announcements(announcement_id) ON DELETE SET NULL,
  http_status integer NULL,
  response_body jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  CONSTRAINT announcement_operations_actor_key_check
    CHECK (char_length(trim(actor_key)) BETWEEN 3 AND 200),
  CONSTRAINT announcement_operations_action_check
    CHECK (char_length(trim(action)) BETWEEN 1 AND 100),
  CONSTRAINT announcement_operations_idempotency_key_check
    CHECK (char_length(trim(idempotency_key)) BETWEEN 8 AND 200),
  CONSTRAINT announcement_operations_request_hash_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT announcement_operations_http_status_check
    CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_announcement_operations_actor_action_key
  ON public.announcement_operations (actor_key, action, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_announcement_operations_expiry
  ON public.announcement_operations (expires_at)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_announcement_operations_announcement
  ON public.announcement_operations (announcement_id, created_at DESC)
  WHERE announcement_id IS NOT NULL;

ALTER TABLE public.announcement_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.announcement_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.announcement_operations TO service_role;

