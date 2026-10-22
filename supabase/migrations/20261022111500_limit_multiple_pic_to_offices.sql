-- MANUAL EXECUTION ONLY. Apply after 20261022110000_multiple_community_service_personnel.sql.
-- No personnel are automatically removed or reassigned.
BEGIN;
LOCK TABLE public.ro_area_coordinators,public.institutional_service_area_links IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.ro_area_coordinators rac WHERE rac.is_active
    AND NOT EXISTS(SELECT 1 FROM public.institutional_service_area_links l JOIN public.ref_offices o USING(office_id)
      WHERE l.department_id=rac.ro_area_id AND o.is_institutional)
    GROUP BY rac.ro_area_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'An independent area already has multiple PICs. Select one PIC or link it to its institutional office before applying this migration.';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.enforce_area_pic_limit() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
  IF NOT NEW.is_active THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.ro_departments WHERE department_id=NEW.ro_area_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.institutional_service_area_links l JOIN public.ref_offices o USING(office_id)
    WHERE l.department_id=NEW.ro_area_id AND o.is_institutional)
    AND EXISTS(SELECT 1 FROM public.ro_area_coordinators rac WHERE rac.ro_area_id=NEW.ro_area_id
      AND rac.is_active AND rac.coordinator_assignment_id<>NEW.coordinator_assignment_id) THEN
    RAISE EXCEPTION 'Independent service areas can have only one Personnel-In-Charge.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_area_pic_limit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS enforce_area_pic_limit ON public.ro_area_coordinators;
CREATE TRIGGER enforce_area_pic_limit BEFORE INSERT OR UPDATE ON public.ro_area_coordinators
  FOR EACH ROW EXECUTE FUNCTION public.enforce_area_pic_limit();
CREATE OR REPLACE FUNCTION public.protect_office_pic_link() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
  PERFORM 1 FROM public.ro_departments WHERE department_id=OLD.department_id FOR UPDATE;
  IF (TG_OP='DELETE' OR NEW.department_id IS DISTINCT FROM OLD.department_id OR
      NOT EXISTS(SELECT 1 FROM public.ref_offices o WHERE o.office_id=NEW.office_id AND o.is_institutional))
    AND (SELECT count(*) FROM public.ro_area_coordinators rac WHERE rac.ro_area_id=OLD.department_id AND rac.is_active)>1 THEN
    RAISE EXCEPTION 'Keep one Personnel-In-Charge before unlinking this office.' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_office_pic_link() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS protect_office_pic_link ON public.institutional_service_area_links;
CREATE TRIGGER protect_office_pic_link BEFORE DELETE OR UPDATE ON public.institutional_service_area_links
  FOR EACH ROW EXECUTE FUNCTION public.protect_office_pic_link();
COMMIT;
