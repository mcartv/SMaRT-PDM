-- Preserve a personal, read-only cutoff whenever a user leaves or is removed
-- from a group. Existing archive rows are moved to the actual membership end.
CREATE OR REPLACE FUNCTION public.smart_pdm_archive_group_membership_end()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.message_thread_archives
   WHERE user_id = OLD.user_id
     AND thread_type = 'group'
     AND room_id = OLD.room_id;

  INSERT INTO public.message_thread_archives (
    user_id, thread_type, counterparty_id, room_id, archived_at
  ) VALUES (
    OLD.user_id, 'group', NULL, OLD.room_id, now()
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_pdm_archive_group_membership_end
  ON public.chat_room_members;

CREATE TRIGGER trg_smart_pdm_archive_group_membership_end
BEFORE DELETE ON public.chat_room_members
FOR EACH ROW
EXECUTE FUNCTION public.smart_pdm_archive_group_membership_end();
