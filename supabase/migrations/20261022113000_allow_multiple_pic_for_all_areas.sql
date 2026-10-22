-- MANUAL EXECUTION ONLY. Apply after 20261022110000_multiple_community_service_personnel.sql.
-- Works whether or not the superseded office-only restriction was already applied.
-- Retains existing ro_area_coordinators rows, unique area/person pairs and processing history.
BEGIN;
LOCK TABLE public.ro_area_coordinators,public.institutional_service_area_links IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF to_regclass('public.uq_ro_area_active_personnel') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261022110000_multiple_community_service_personnel.sql first.';
  END IF;
END $$;
DROP TRIGGER IF EXISTS enforce_area_pic_limit ON public.ro_area_coordinators;
DROP TRIGGER IF EXISTS protect_office_pic_link ON public.institutional_service_area_links;
DROP FUNCTION IF EXISTS public.enforce_area_pic_limit();
DROP FUNCTION IF EXISTS public.protect_office_pic_link();
COMMIT;

-- Multiple PICs are permitted for every area; duplicate active area/person pairs remain forbidden.
SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public'
  AND tablename='ro_area_coordinators' AND indexname='uq_ro_area_active_personnel';
