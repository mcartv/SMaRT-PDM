-- MANUAL EXECUTION ONLY. Existing PIC assignments and processed records are preserved.
BEGIN;
LOCK TABLE public.ro_area_coordinators IN SHARE ROW EXCLUSIVE MODE;
DROP INDEX IF EXISTS public.uq_ro_area_active_coordinator;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ro_area_active_personnel
  ON public.ro_area_coordinators(ro_area_id,user_id) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS idx_ro_placements_area_queue ON public.ro_placements(ro_area_id,placement_status,updated_at DESC);

-- Append processing snapshots in the SAME transaction as the decision.
CREATE TABLE IF NOT EXISTS public.ro_processing_history (
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK(entity_type IN ('placement','attendance')),
  entity_id uuid NOT NULL,
  ro_id uuid NOT NULL,
  actor_user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  action text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  previous_record jsonb,
  processed_record jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ro_processing_history_entity ON public.ro_processing_history(entity_type,entity_id,processed_at DESC);
ALTER TABLE public.ro_processing_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ro_processing_history FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.record_ro_processing_action() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor_id uuid; operation text; person_name text; old_record jsonb;
BEGIN
  IF TG_OP='UPDATE' THEN old_record=to_jsonb(OLD); END IF;
  IF TG_TABLE_NAME='ro_placements' THEN
    IF NEW.placement_status NOT IN ('Approved','Rejected') OR NEW.decided_by_user_id IS NULL THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND NEW.placement_status IS NOT DISTINCT FROM OLD.placement_status
      AND NEW.decided_at IS NOT DISTINCT FROM OLD.decided_at THEN RETURN NEW; END IF;
    actor_id=NEW.decided_by_user_id; operation=NEW.placement_status;
  ELSE
    IF NEW.department_validated_by IS NULL OR NEW.department_validation_status NOT IN ('Approved','Returned') THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND NEW.department_validation_status IS NOT DISTINCT FROM OLD.department_validation_status
      AND NEW.department_validated_at IS NOT DISTINCT FROM OLD.department_validated_at THEN RETURN NEW; END IF;
    actor_id=NEW.department_validated_by; operation=NEW.department_validation_status;
  END IF;
  SELECT COALESCE(NULLIF(btrim(concat_ws(' ',ap.first_name,ap.last_name)),''),u.username,'Account')
    INTO person_name FROM public.users u LEFT JOIN public.admin_profiles ap ON ap.user_id=u.user_id WHERE u.user_id=actor_id;
  INSERT INTO public.ro_processing_history(entity_type,entity_id,ro_id,actor_user_id,actor_name,action,previous_record,processed_record)
    VALUES(CASE WHEN TG_TABLE_NAME='ro_placements' THEN 'placement' ELSE 'attendance' END,
      CASE WHEN TG_TABLE_NAME='ro_placements' THEN (to_jsonb(NEW)->>'placement_id')::uuid ELSE (to_jsonb(NEW)->>'log_id')::uuid END,
      NEW.ro_id,actor_id,COALESCE(person_name,'Account'),operation,old_record,to_jsonb(NEW));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_ro_processing_action() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS record_ro_placement_processing ON public.ro_placements;
CREATE TRIGGER record_ro_placement_processing AFTER INSERT OR UPDATE ON public.ro_placements
  FOR EACH ROW EXECUTE FUNCTION public.record_ro_processing_action();
DROP TRIGGER IF EXISTS record_ro_attendance_processing ON public.ro_time_logs;
CREATE TRIGGER record_ro_attendance_processing AFTER INSERT OR UPDATE ON public.ro_time_logs
  FOR EACH ROW EXECUTE FUNCTION public.record_ro_processing_action();
COMMIT;
