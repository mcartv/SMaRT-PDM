ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS unsent_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsent_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_unsent_at
  ON public.messages (unsent_at)
  WHERE unsent_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.clear_unsent_message_edit_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.message_edit_history WHERE message_id = NEW.message_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_unsent_message_edit_history ON public.messages;
CREATE TRIGGER trg_clear_unsent_message_edit_history
AFTER UPDATE OF unsent_at ON public.messages
FOR EACH ROW
WHEN (OLD.unsent_at IS NULL AND NEW.unsent_at IS NOT NULL)
EXECUTE FUNCTION public.clear_unsent_message_edit_history();
