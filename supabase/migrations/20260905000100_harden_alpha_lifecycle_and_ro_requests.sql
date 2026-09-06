-- Keep RO request capacity correct even when assignments are created from
-- different application/database connections. Locking the request row makes
-- the check safe across Admin sessions and across future assignment clients.

-- Keep this hardening migration safe to run even when the earlier request-link
-- migration was not deployed. Existing placements remain valid with NULL links.
ALTER TABLE public.ro_placements
  ADD COLUMN IF NOT EXISTS scholar_request_id uuid NULL
    REFERENCES public.ro_scholar_requests(request_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ro_placements_scholar_request
  ON public.ro_placements (scholar_request_id, placement_status, created_at)
  WHERE scholar_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ro_placements_request_obligation
  ON public.ro_placements (scholar_request_id, ro_id)
  WHERE scholar_request_id IS NOT NULL;

-- Older removals used both Inactive and Removed for the same archived scholar
-- lifecycle. Preserve their reasons and audit fields while normalizing the
-- visible lifecycle state.
UPDATE public.students
SET scholarship_status = 'Removed',
    updated_at = now()
WHERE COALESCE(scholar_is_archived, false) = true
  AND COALESCE(scholarship_status, '') <> 'Removed';

CREATE OR REPLACE FUNCTION public.guard_ro_scholar_request_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requested_count integer;
  v_active_count integer;
BEGIN
  IF NEW.scholar_request_id IS NULL
     OR NEW.placement_status <> 'Approved'
     OR NEW.conflict_reason IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT requested_scholar_count
  INTO v_requested_count
  FROM public.ro_scholar_requests
  WHERE request_id = NEW.scholar_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RO scholar request % was not found', NEW.scholar_request_id
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ro_scholar_requests
    WHERE request_id = NEW.scholar_request_id
      AND request_status IN ('Declined', 'Cancelled')
  ) THEN
    RAISE EXCEPTION 'RO scholar request % is no longer active', NEW.scholar_request_id
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer
  INTO v_active_count
  FROM public.ro_placements rp
  WHERE rp.scholar_request_id = NEW.scholar_request_id
    AND rp.placement_status = 'Approved'
    AND rp.conflict_reason IS NULL
    AND (TG_OP = 'INSERT' OR rp.placement_id <> NEW.placement_id);

  IF v_active_count >= v_requested_count THEN
    RAISE EXCEPTION 'RO scholar request % already has all requested scholars assigned', NEW.scholar_request_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ro_scholar_request_capacity
  ON public.ro_placements;

CREATE TRIGGER trg_guard_ro_scholar_request_capacity
BEFORE INSERT OR UPDATE OF scholar_request_id, placement_status, conflict_reason
ON public.ro_placements
FOR EACH ROW
EXECUTE FUNCTION public.guard_ro_scholar_request_capacity();

-- Match the database auto-timeout path with the Mobile service: allow the
-- full 30-minute checkout grace period, cap credited minutes at the remaining
-- requirement, and keep the real automatic checkout timestamp.
CREATE OR REPLACE FUNCTION public.auto_timeout_ro_log(p_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_log public.ro_time_logs%ROWTYPE;
  v_ro public.return_of_obligations%ROWTYPE;
  v_user_id uuid;
  v_required_minutes integer := 0;
  v_previous_submitted integer := 0;
  v_remaining_minutes integer := 0;
  v_submitted_minutes integer := 0;
  v_validated_minutes integer := 0;
  v_requirement_time timestamptz;
  v_timeout_time timestamptz;
  v_progress_status text;
  v_assignment_status text;
  v_notification_id uuid;
  v_grace_minutes integer := 30;
BEGIN
  SELECT rtl.* INTO v_log
  FROM public.ro_time_logs rtl
  WHERE rtl.log_id = p_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('transitioned', false, 'reason', 'LOG_NOT_FOUND');
  END IF;

  IF v_log.time_out_at IS NOT NULL OR v_log.log_status <> 'Timed In' THEN
    RETURN jsonb_build_object(
      'transitioned', false,
      'reason', 'LOG_NOT_ACTIVE',
      'log_id', v_log.log_id,
      'ro_id', v_log.ro_id
    );
  END IF;

  SELECT ro.* INTO v_ro
  FROM public.return_of_obligations ro
  WHERE ro.ro_id = v_log.ro_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RO assignment not found for log %', p_log_id
      USING ERRCODE = '23503';
  END IF;

  PERFORM 1
  FROM public.ro_time_logs rtl
  WHERE rtl.ro_id = v_ro.ro_id
    AND rtl.log_id <> v_log.log_id
  ORDER BY rtl.log_id
  FOR UPDATE;

  v_required_minutes := greatest(0, coalesce(v_ro.required_hours, 0) * 60);

  SELECT coalesce(sum(rtl.duration_minutes), 0)::integer
  INTO v_previous_submitted
  FROM public.ro_time_logs rtl
  WHERE rtl.ro_id = v_ro.ro_id
    AND rtl.log_id <> v_log.log_id
    AND rtl.log_status = 'Timed Out'
    AND rtl.validation_status <> 'Rejected';

  v_remaining_minutes := greatest(0, v_required_minutes - v_previous_submitted);
  v_requirement_time := v_log.time_in_at + make_interval(mins => v_remaining_minutes);
  v_timeout_time := v_requirement_time + make_interval(mins => v_grace_minutes);

  IF v_now < v_timeout_time THEN
    RETURN jsonb_build_object(
      'transitioned', false,
      'reason', CASE
        WHEN v_now < v_requirement_time THEN 'REQUIREMENT_NOT_REACHED'
        ELSE 'CHECKOUT_GRACE_ACTIVE'
      END,
      'log_id', v_log.log_id,
      'ro_id', v_log.ro_id,
      'requirement_time', v_requirement_time,
      'timeout_time', v_timeout_time,
      'remaining_minutes', v_remaining_minutes,
      'checkout_grace_minutes', v_grace_minutes
    );
  END IF;

  UPDATE public.ro_time_logs rtl
  SET time_out_at = v_now,
      duration_minutes = v_remaining_minutes,
      log_status = 'Timed Out',
      validation_status = 'Pending Validation',
      auto_timed_out = true,
      auto_timeout_reason = CASE
        WHEN v_remaining_minutes = 0
          THEN format('Required RO hours were already satisfied. The %s-minute checkout grace period expired, so no additional time was credited.', v_grace_minutes)
        ELSE format('Required RO time was reached. The %s-minute checkout grace period expired, and extra elapsed time was not credited.', v_grace_minutes)
      END,
      requires_admin_attention = false,
      updated_at = v_now
  WHERE rtl.log_id = v_log.log_id
  RETURNING rtl.* INTO v_log;

  SELECT
    coalesce(sum(rtl.duration_minutes) FILTER (
      WHERE rtl.log_status = 'Timed Out'
        AND rtl.validation_status <> 'Rejected'
    ), 0)::integer,
    coalesce(sum(rtl.validated_minutes) FILTER (
      WHERE rtl.validation_status = 'Approved'
    ), 0)::integer
  INTO v_submitted_minutes, v_validated_minutes
  FROM public.ro_time_logs rtl
  WHERE rtl.ro_id = v_ro.ro_id;

  IF v_ro.ro_status = 'Cleared' THEN
    v_progress_status := 'Cleared';
    v_assignment_status := 'Cleared';
  ELSIF v_submitted_minutes <= 0 THEN
    v_progress_status := 'Not Started';
    v_assignment_status := v_ro.assignment_status;
  ELSIF v_required_minutes > 0 AND v_submitted_minutes >= v_required_minutes THEN
    v_progress_status := 'For Validation';
    v_assignment_status := 'For Validation';
  ELSE
    v_progress_status := 'In Progress';
    v_assignment_status := 'In Progress';
  END IF;

  UPDATE public.return_of_obligations ro
  SET submitted_minutes = v_submitted_minutes,
      validated_minutes = v_validated_minutes,
      progress_status = v_progress_status,
      assignment_status = v_assignment_status,
      updated_at = v_now
  WHERE ro.ro_id = v_ro.ro_id
  RETURNING ro.* INTO v_ro;

  SELECT st.user_id INTO v_user_id
  FROM public.students st
  WHERE st.student_id = v_log.student_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, type, title, message, reference_id, reference_type, created_at
    ) VALUES (
      v_user_id,
      'RO Auto Timeout',
      'RO Session Auto Timed Out',
      format(
        'Your RO session was closed after the %s-minute checkout grace period. Recorded time: %s minute(s). The log is pending validation.',
        v_grace_minutes,
        v_remaining_minutes
      ),
      v_ro.ro_id::text,
      'return_of_obligation',
      v_now
    )
    RETURNING notification_id INTO v_notification_id;
  END IF;

  RETURN jsonb_build_object(
    'transitioned', true,
    'reason', 'AUTO_TIMED_OUT',
    'database_time', v_now,
    'requirement_time', v_requirement_time,
    'timeout_time', v_timeout_time,
    'duration_minutes', v_remaining_minutes,
    'checkout_grace_minutes', v_grace_minutes,
    'student_user_id', v_user_id,
    'notification_id', v_notification_id,
    'log', to_jsonb(v_log),
    'ro', to_jsonb(v_ro)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_ro_scholar_request_capacity()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_timeout_ro_log(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_timeout_ro_log(uuid) TO service_role;
