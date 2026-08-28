-- SMaRT-PDM Renewal Availability by Semester
-- Enforce one renewal row per scholar per academic period.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.renewals
    WHERE period_id IS NOT NULL
    GROUP BY student_id, period_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create uq_renewals_student_period: duplicate student_id/period_id renewal rows exist. Resolve duplicates first.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_renewals_student_period
  ON public.renewals (student_id, period_id);

COMMENT ON INDEX public.uq_renewals_student_period IS
  'Prevents duplicate scholarship renewal records for the same scholar and academic period.';
