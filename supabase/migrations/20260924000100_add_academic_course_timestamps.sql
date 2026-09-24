ALTER TABLE public.academic_course
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.academic_course
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_academic_course_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS academic_course_set_updated_at ON public.academic_course;
CREATE TRIGGER academic_course_set_updated_at
BEFORE UPDATE ON public.academic_course
FOR EACH ROW EXECUTE FUNCTION public.set_academic_course_updated_at();
