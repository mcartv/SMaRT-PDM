-- Run manually in Supabase SQL Editor. Does not change any assignments.
-- Review duplicates first; unassign through Community Service after resolving active work.
SELECT rac.user_id, concat_ws(' ',ap.first_name,ap.last_name) AS name,
       array_agg(d.department_name ORDER BY d.department_name) AS assigned_areas
FROM public.ro_area_coordinators rac
JOIN public.ro_departments d ON d.department_id=rac.ro_area_id
LEFT JOIN public.admin_profiles ap ON ap.user_id=rac.user_id
WHERE rac.is_active=true
GROUP BY rac.user_id,ap.first_name,ap.last_name HAVING count(*)>1;

BEGIN;
LOCK TABLE public.ro_area_coordinators IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.ro_area_coordinators WHERE is_active=true GROUP BY user_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Some PICs have multiple active assignments. Review the duplicate report and unassign safely before rerunning. No assignments were changed.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ro_pic_one_active_area
ON public.ro_area_coordinators(user_id) WHERE is_active=true;
COMMIT;
