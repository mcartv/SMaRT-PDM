-- Persist per-user message thread archive state.
-- Archiving a conversation hides it only for the user who archived it; it does
-- not archive the underlying private messages or chat room globally.

CREATE TABLE IF NOT EXISTS public.message_thread_archives (
  archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  thread_type text NOT NULL
    CHECK (thread_type IN ('private', 'group')),
  counterparty_id uuid NULL
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  room_id uuid NULL
    REFERENCES public.chat_rooms(room_id) ON DELETE CASCADE,
  archived_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_message_thread_archives_target
    CHECK (
      (thread_type = 'private' AND counterparty_id IS NOT NULL AND room_id IS NULL)
      OR
      (thread_type = 'group' AND room_id IS NOT NULL AND counterparty_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_thread_archives_private
  ON public.message_thread_archives (user_id, counterparty_id)
  WHERE thread_type = 'private';

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_thread_archives_group
  ON public.message_thread_archives (user_id, room_id)
  WHERE thread_type = 'group';

CREATE INDEX IF NOT EXISTS idx_message_thread_archives_user_id
  ON public.message_thread_archives (user_id);

CREATE INDEX IF NOT EXISTS idx_message_thread_archives_counterparty_id
  ON public.message_thread_archives (counterparty_id);

CREATE INDEX IF NOT EXISTS idx_message_thread_archives_room_id
  ON public.message_thread_archives (room_id);

ALTER TABLE public.message_thread_archives ENABLE ROW LEVEL SECURITY;

-- SMART-PDM accesses messaging data through the authenticated Express backend
-- using the Supabase service role. Keep direct browser access closed.
REVOKE ALL ON TABLE public.message_thread_archives FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.message_thread_archives TO service_role;
