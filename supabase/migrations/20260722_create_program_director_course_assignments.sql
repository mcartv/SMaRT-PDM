CREATE TABLE IF NOT EXISTS public.program_director_course_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pd_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academic_course(course_id) ON DELETE CASCADE,
  assigned_by_user_id uuid NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pd_per_course
  ON public.program_director_course_assignments (course_id)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pd_course_pair
  ON public.program_director_course_assignments (pd_user_id, course_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pd_course_assignments_user
  ON public.program_director_course_assignments (pd_user_id)
  WHERE is_active = true;

-- Preserve the current one-PD workflow by assigning every active course to
-- the oldest active Program Director when no assignments exist yet.
WITH current_pd AS (
  SELECT u.user_id
  FROM public.users u
  JOIN public.admin_profiles ap ON ap.user_id = u.user_id
  WHERE coalesce(ap.is_archived, false) = false
    AND (
      lower(coalesce(ap.position, '')) LIKE '%program director%'
      OR lower(coalesce(ap.department, '')) LIKE '%program department%'
    )
  ORDER BY u.created_at ASC
  LIMIT 1
)
INSERT INTO public.program_director_course_assignments (pd_user_id, course_id)
SELECT current_pd.user_id, course.course_id
FROM current_pd
CROSS JOIN public.academic_course course
WHERE coalesce(course.is_archived, false) = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.program_director_course_assignments assignment
    WHERE assignment.course_id = course.course_id
      AND assignment.is_active = true
  )
ON CONFLICT DO NOTHING;

ALTER TABLE public.program_director_course_assignments ENABLE ROW LEVEL SECURITY;
