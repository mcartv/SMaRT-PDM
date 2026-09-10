-- Keep the stored civil-status contract aligned with the application forms.
ALTER TABLE public.student_profiles
  DROP CONSTRAINT IF EXISTS student_profiles_civil_status_check;

ALTER TABLE public.student_profiles
  ADD CONSTRAINT student_profiles_civil_status_check
  CHECK (
    civil_status IN (
      'Single',
      'Married',
      'Widowed',
      'Separated',
      'Divorced'
    )
  ) NOT VALID;

ALTER TABLE public.student_profiles
  VALIDATE CONSTRAINT student_profiles_civil_status_check;
