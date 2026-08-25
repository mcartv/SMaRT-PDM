-- SMaRT-PDM web messaging UX support
-- Safe, additive migration for replies, per-user "delete for me", and idempotent sends.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL,
  ADD COLUMN IF NOT EXISTS client_message_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_reply_to_message_id_fkey'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_reply_to_message_id_fkey
      FOREIGN KEY (reply_to_message_id)
      REFERENCES public.messages(message_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_message_id
  ON public.messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_sender_client_message_id
  ON public.messages (sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.message_hidden_states (
  message_id uuid NOT NULL
    REFERENCES public.messages(message_id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_hidden_states_user_id
  ON public.message_hidden_states (user_id, hidden_at DESC);

ALTER TABLE public.message_hidden_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.message_hidden_states FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_hidden_states TO service_role;
