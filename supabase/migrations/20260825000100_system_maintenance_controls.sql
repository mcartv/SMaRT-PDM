BEGIN;

ALTER TABLE public.general_settings
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.general_settings
  ADD COLUMN IF NOT EXISTS maintenance_message text NOT NULL DEFAULT 'SMaRT-PDM is temporarily unavailable while system maintenance is in progress. Please try again later.';

COMMENT ON COLUMN public.general_settings.maintenance_mode IS
  'When true, the student mobile application is blocked by the global maintenance gate.';

COMMENT ON COLUMN public.general_settings.maintenance_message IS
  'Public message shown to student mobile users while maintenance mode is active.';

COMMIT;
