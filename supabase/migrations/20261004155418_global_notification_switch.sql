-- Default on: adding the control preserves existing notification behavior.
ALTER TABLE public.general_settings
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.general_settings.notifications_enabled IS
  'Global switch for new in-app and push notifications on web and mobile.';

-- RO auto-timeout writes its notification inside the database transaction.
-- Preserve the deployed function body and gate only its notification branch.
DO $migration$
DECLARE
  definition text;
BEGIN
  IF to_regprocedure('public.auto_timeout_ro_log(uuid)') IS NOT NULL THEN
    SELECT pg_get_functiondef('public.auto_timeout_ro_log(uuid)'::regprocedure)
      INTO definition;
    IF position('notifications_enabled' IN definition) = 0 THEN
      IF position('IF v_user_id IS NOT NULL THEN' IN definition) = 0 THEN
        RAISE EXCEPTION 'Unexpected auto_timeout_ro_log notification branch';
      END IF;
      definition := replace(definition, 'IF v_user_id IS NOT NULL THEN',
        'IF v_user_id IS NOT NULL AND COALESCE((SELECT notifications_enabled FROM public.general_settings WHERE general_settings_id = 1), true) THEN');
      EXECUTE definition;
    END IF;
  END IF;
END;
$migration$;
