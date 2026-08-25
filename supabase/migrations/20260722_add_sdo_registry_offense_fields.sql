ALTER TABLE IF EXISTS public.student_master_records
  ADD COLUMN IF NOT EXISTS offense_type text NULL,
  ADD COLUMN IF NOT EXISTS offense_incident_date date NULL;

ALTER TABLE IF EXISTS public.student_import_rows
  ADD COLUMN IF NOT EXISTS offense_type text NULL,
  ADD COLUMN IF NOT EXISTS offense_incident_date date NULL;
