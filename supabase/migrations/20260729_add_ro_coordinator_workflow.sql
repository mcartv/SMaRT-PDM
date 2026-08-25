-- Return of Obligation coordinator and split-placement workflow.
-- One obligation keeps the configured total hours. Placements allow those hours
-- to be rendered in one area or split across multiple approved RO Areas.

ALTER TABLE public.return_of_obligations
  ADD COLUMN IF NOT EXISTS coordinator_status text NULL,
  ADD COLUMN IF NOT EXISTS coordinator_remarks text NULL,
  ADD COLUMN IF NOT EXISTS coordinator_user_id uuid NULL
    REFERENCES public.users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coordinator_decided_at timestamptz NULL;

UPDATE public.return_of_obligations
SET coordinator_status = 'Approved'
WHERE coordinator_status IS NULL
   OR coordinator_status NOT IN ('Pending', 'Approved', 'Rejected');

ALTER TABLE public.return_of_obligations
  ALTER COLUMN coordinator_status SET DEFAULT 'Pending',
  ALTER COLUMN coordinator_status SET NOT NULL;

ALTER TABLE public.return_of_obligations
  DROP CONSTRAINT IF EXISTS return_of_obligations_coordinator_status_check;

ALTER TABLE public.return_of_obligations
  ADD CONSTRAINT return_of_obligations_coordinator_status_check
  CHECK (coordinator_status IN ('Pending', 'Approved', 'Rejected'));

CREATE TABLE IF NOT EXISTS public.ro_area_coordinators (
  coordinator_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_area_id uuid NOT NULL
    REFERENCES public.ro_departments(department_id) ON DELETE RESTRICT,
  user_id uuid NOT NULL
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  assigned_by_user_id uuid NULL
    REFERENCES public.users(user_id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ro_area_active_coordinator
  ON public.ro_area_coordinators (ro_area_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ro_area_coordinators_user
  ON public.ro_area_coordinators (user_id, is_active);

-- A staff account may keep its primary role (for example Program Director)
-- while also receiving an RO Area coordinator assignment.
DROP INDEX IF EXISTS public.uq_active_ro_coordinator_area;

INSERT INTO public.ro_area_coordinators (
  ro_area_id,
  user_id,
  is_active,
  assigned_at
)
SELECT
  rd.department_id,
  ap.user_id,
  true,
  now()
FROM public.admin_profiles ap
JOIN public.ro_departments rd
  ON LOWER(TRIM(rd.department_name)) = LOWER(TRIM(ap.department))
WHERE COALESCE(ap.is_archived, false) = false
  AND LOWER(TRIM(COALESCE(ap.position, ''))) = 'ro coordinator'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ro_placements (
  placement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_id uuid NOT NULL
    REFERENCES public.return_of_obligations(ro_id) ON DELETE CASCADE,
  ro_area_id uuid NOT NULL
    REFERENCES public.ro_departments(department_id) ON DELETE RESTRICT,
  coordinator_assignment_id uuid NULL
    REFERENCES public.ro_area_coordinators(coordinator_assignment_id)
    ON DELETE SET NULL,
  placement_status text NOT NULL DEFAULT 'Pending',
  admin_remarks text NULL,
  coordinator_remarks text NULL,
  requested_by_user_id uuid NULL
    REFERENCES public.users(user_id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by_user_id uuid NULL
    REFERENCES public.users(user_id) ON DELETE SET NULL,
  decided_at timestamptz NULL,
  student_acknowledged_at timestamptz NULL,
  conflict_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ro_placements_status_check
    CHECK (placement_status IN ('Pending', 'Approved', 'Rejected', 'Cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ro_current_placement_area
  ON public.ro_placements (ro_id, ro_area_id)
  WHERE placement_status IN ('Pending', 'Approved');

CREATE INDEX IF NOT EXISTS idx_ro_placements_coordinator_queue
  ON public.ro_placements (
    coordinator_assignment_id,
    placement_status,
    updated_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_ro_placements_obligation
  ON public.ro_placements (ro_id, placement_status, updated_at DESC);

-- Preserve every existing assignment as an approved legacy placement.
INSERT INTO public.ro_placements (
  ro_id,
  ro_area_id,
  coordinator_assignment_id,
  placement_status,
  admin_remarks,
  requested_by_user_id,
  requested_at,
  decided_by_user_id,
  decided_at,
  student_acknowledged_at,
  conflict_reason,
  created_at,
  updated_at
)
SELECT
  ro.ro_id,
  rd.department_id,
  rac.coordinator_assignment_id,
  'Approved',
  ro.remarks,
  ro.assigned_by,
  COALESCE(ro.assigned_at, ro.created_at, now()),
  ro.coordinator_user_id,
  COALESCE(ro.coordinator_decided_at, ro.assigned_at, ro.created_at, now()),
  ro.assignment_acknowledged_at,
  ro.conflict_reason,
  COALESCE(ro.assigned_at, ro.created_at, now()),
  COALESCE(ro.updated_at, now())
FROM public.return_of_obligations ro
JOIN public.ro_departments rd
  ON LOWER(TRIM(rd.department_name)) = LOWER(TRIM(ro.assigned_area))
LEFT JOIN public.ro_area_coordinators rac
  ON rac.ro_area_id = rd.department_id
 AND rac.is_active = true
WHERE NULLIF(TRIM(COALESCE(ro.assigned_area, '')), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.ro_placements rp
    WHERE rp.ro_id = ro.ro_id
      AND rp.ro_area_id = rd.department_id
      AND rp.placement_status IN ('Pending', 'Approved')
  );

ALTER TABLE public.ro_time_logs
  ADD COLUMN IF NOT EXISTS placement_id uuid NULL
    REFERENCES public.ro_placements(placement_id) ON DELETE RESTRICT;

UPDATE public.ro_time_logs rtl
SET placement_id = (
  SELECT rp.placement_id
  FROM public.ro_placements rp
  WHERE rp.ro_id = rtl.ro_id
    AND rp.placement_status = 'Approved'
  ORDER BY rp.decided_at NULLS LAST, rp.created_at
  LIMIT 1
)
WHERE rtl.placement_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.ro_placements rp
    WHERE rp.ro_id = rtl.ro_id
      AND rp.placement_status = 'Approved'
  );

CREATE INDEX IF NOT EXISTS idx_ro_time_logs_placement
  ON public.ro_time_logs (placement_id, time_in_at DESC);

ALTER TABLE public.ro_area_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ro_placements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ro_area_coordinators FROM anon, authenticated;
REVOKE ALL ON TABLE public.ro_placements FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.ro_area_coordinators TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.ro_placements TO service_role;

ALTER TABLE IF EXISTS public.staff_portal_theme_settings
  DROP CONSTRAINT IF EXISTS staff_portal_theme_settings_portal_key_check;

ALTER TABLE IF EXISTS public.staff_portal_theme_settings
  ADD CONSTRAINT staff_portal_theme_settings_portal_key_check
  CHECK (portal_key IN ('admin', 'sdo', 'guidance', 'pd', 'ro_coordinator'));

DO $$
DECLARE
  target_table text;
  realtime_tables text[] := ARRAY[
    'return_of_obligations',
    'ro_area_coordinators',
    'ro_placements',
    'ro_time_logs'
  ];
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    FOREACH target_table IN ARRAY realtime_tables LOOP
      IF to_regclass(format('public.%I', target_table)) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = target_table
        )
      THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          target_table
        );
      END IF;
    END LOOP;
  END IF;
END
$$;
