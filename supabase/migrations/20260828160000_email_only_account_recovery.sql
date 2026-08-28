-- Account recovery codes are delivered by email only.
-- Close older non-email sessions and enforce the supported channel at the
-- database boundary when the legacy recovery table is present.

DO $$
BEGIN
  IF to_regclass('public.account_recovery_sessions') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.account_recovery_sessions
  SET consumed_at = COALESCE(consumed_at, NOW())
  WHERE channel <> 'email';

  ALTER TABLE public.account_recovery_sessions
    DROP CONSTRAINT IF EXISTS account_recovery_sessions_channel_check;

  ALTER TABLE public.account_recovery_sessions
    ADD CONSTRAINT account_recovery_sessions_channel_check
    CHECK (channel = 'email');
END
$$;
