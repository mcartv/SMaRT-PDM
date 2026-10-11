ALTER TABLE public.sdo_student_records
  ADD COLUMN IF NOT EXISTS course_code text,
  ADD COLUMN IF NOT EXISTS year_level text;
