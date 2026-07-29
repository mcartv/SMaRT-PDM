-- RO Areas can request scholars from Admin without creating a placement yet.
CREATE TABLE IF NOT EXISTS public.ro_scholar_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_area_id uuid NOT NULL
    REFERENCES public.ro_departments(department_id) ON DELETE RESTRICT,
  coordinator_assignment_id uuid NOT NULL
    REFERENCES public.ro_area_coordinators(coordinator_assignment_id)
    ON DELETE RESTRICT,
  requested_by_user_id uuid NOT NULL
    REFERENCES public.users(user_id) ON DELETE RESTRICT,
  requested_scholar_count integer NOT NULL DEFAULT 1
    CHECK (requested_scholar_count BETWEEN 1 AND 20),
  purpose text NOT NULL CHECK (char_length(trim(purpose)) BETWEEN 3 AND 1000),
  preferred_date date NULL,
  request_status text NOT NULL DEFAULT 'Pending'
    CHECK (
      request_status IN (
        'Pending',
        'Acknowledged',
        'Fulfilled',
        'Declined',
        'Cancelled'
      )
    ),
  admin_remarks text NULL,
  handled_by_user_id uuid NULL
    REFERENCES public.users(user_id) ON DELETE SET NULL,
  handled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ro_scholar_requests_admin_queue
  ON public.ro_scholar_requests (request_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ro_scholar_requests_coordinator
  ON public.ro_scholar_requests (
    coordinator_assignment_id,
    request_status,
    created_at DESC
  );

ALTER TABLE public.ro_scholar_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ro_scholar_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.ro_scholar_requests TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'ro_scholar_requests'
    )
  THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.ro_scholar_requests;
  END IF;
END
$$;
