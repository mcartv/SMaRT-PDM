-- SMaRT-PDM: reversible cascaded archiving of benefactor-linked records.
-- Apply to TEST first. Requires existing public.smart_pdm_cascade_benefactor_archive trigger.
-- Does not delete applications, payments, scholars, or audit records.
BEGIN;

CREATE TABLE IF NOT EXISTS public.smart_pdm_benefactor_archive_restore (
  benefactor_id uuid NOT NULL REFERENCES public.benefactors(benefactor_id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN ('program','opening','application')),
  record_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (benefactor_id, record_type, record_id)
);

CREATE OR REPLACE FUNCTION public.smart_pdm_cascade_benefactor_archive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived THEN
    RETURN NEW;
  END IF;

  IF NEW.is_archived IS TRUE THEN
    -- Save only records that were active immediately before this archive.
    INSERT INTO public.smart_pdm_benefactor_archive_restore (benefactor_id,record_type,record_id)
    SELECT NEW.benefactor_id,'program',p.program_id
      FROM public.scholarship_program p
     WHERE p.benefactor_id=NEW.benefactor_id AND p.is_archived IS DISTINCT FROM TRUE
    ON CONFLICT DO NOTHING;

    INSERT INTO public.smart_pdm_benefactor_archive_restore (benefactor_id,record_type,record_id)
    SELECT NEW.benefactor_id,'opening',o.opening_id
      FROM public.program_openings o
      JOIN public.scholarship_program p ON p.program_id=o.program_id
     WHERE p.benefactor_id=NEW.benefactor_id AND o.is_archived IS DISTINCT FROM TRUE
    ON CONFLICT DO NOTHING;

    INSERT INTO public.smart_pdm_benefactor_archive_restore (benefactor_id,record_type,record_id)
    SELECT DISTINCT NEW.benefactor_id,'application',a.application_id
      FROM public.applications a
      LEFT JOIN public.program_openings o ON o.opening_id=a.opening_id
      JOIN public.scholarship_program p ON p.program_id=COALESCE(o.program_id,a.program_id)
     WHERE p.benefactor_id=NEW.benefactor_id AND a.is_archived IS DISTINCT FROM TRUE
    ON CONFLICT DO NOTHING;

    -- Mark applications first, then openings, then programs.
    UPDATE public.applications a SET is_archived=TRUE
     WHERE a.application_id IN (
       SELECT record_id FROM public.smart_pdm_benefactor_archive_restore
       WHERE benefactor_id=NEW.benefactor_id AND record_type='application'
     );
    UPDATE public.program_openings o SET is_archived=TRUE
     WHERE o.opening_id IN (
       SELECT record_id FROM public.smart_pdm_benefactor_archive_restore
       WHERE benefactor_id=NEW.benefactor_id AND record_type='opening'
     );
    UPDATE public.scholarship_program p SET is_archived=TRUE
     WHERE p.program_id IN (
       SELECT record_id FROM public.smart_pdm_benefactor_archive_restore
       WHERE benefactor_id=NEW.benefactor_id AND record_type='program'
     );

  ELSIF NEW.is_archived IS FALSE THEN
    -- Restore only records we archived, preserving pre-existing independent archives.
    UPDATE public.scholarship_program p SET is_archived=FALSE
     WHERE p.program_id IN (
       SELECT record_id FROM public.smart_pdm_benefactor_archive_restore
       WHERE benefactor_id=NEW.benefactor_id AND record_type='program'
     );
    UPDATE public.program_openings o SET is_archived=FALSE
     WHERE o.opening_id IN (
       SELECT record_id FROM public.smart_pdm_benefactor_archive_restore
       WHERE benefactor_id=NEW.benefactor_id AND record_type='opening'
     );
    UPDATE public.applications a SET is_archived=FALSE
     WHERE a.application_id IN (
       SELECT record_id FROM public.smart_pdm_benefactor_archive_restore
       WHERE benefactor_id=NEW.benefactor_id AND record_type='application'
     );
    DELETE FROM public.smart_pdm_benefactor_archive_restore
     WHERE benefactor_id=NEW.benefactor_id;
  END IF;
  RETURN NEW;
END;
$fn$;

COMMIT;
