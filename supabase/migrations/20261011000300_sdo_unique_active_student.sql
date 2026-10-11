-- Preserve existing records. If legacy duplicates exist, resolve them before
-- applying this index; the migration must not silently delete offense history.
CREATE UNIQUE INDEX IF NOT EXISTS sdo_student_records_unique_active_student
  ON public.sdo_student_records (upper(btrim(student_number)))
  WHERE is_archived = false;
