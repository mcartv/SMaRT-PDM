-- Atomically close an active RO log at the exact instant its remaining
-- requirement is reached. Notification persistence is part of the transaction;
-- Socket.IO refresh events remain an after-commit application concern.

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
  v_target_time timestamptz;
  v_progress_status text;
  v_assignment_status text;
  v_notification_id uuid;
BEGIN
  SELECT rtl.*
  INTO v_log
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

  SELECT ro.*
  INTO v_ro
  FROM public.return_of_obligations ro
  WHERE ro.ro_id = v_log.ro_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RO assignment not found for log %', p_log_id
      USING ERRCODE = '23503';
  END IF;

  -- Lock sibling logs deterministically so totals cannot change while the
  -- completion timestamp and capped duration are being calculated.
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
  v_target_time := v_log.time_in_at + make_interval(mins => v_remaining_minutes);

  IF v_now < v_target_time THEN
    RETURN jsonb_build_object(
      'transitioned', false,
      'reason', 'REQUIREMENT_NOT_REACHED',
      'log_id', v_log.log_id,
      'ro_id', v_log.ro_id,
      'target_time', v_target_time,
      'remaining_minutes', v_remaining_minutes
    );
  END IF;

  UPDATE public.ro_time_logs rtl
  SET time_out_at = v_target_time,
      duration_minutes = v_remaining_minutes,
      log_status = 'Timed Out',
      validation_status = 'Pending Validation',
      auto_timed_out = true,
      auto_timeout_reason = CASE
        WHEN v_remaining_minutes = 0
          THEN 'Required RO hours were already satisfied; the active session was closed with no additional credited time.'
        ELSE 'Required RO time was reached; extra elapsed time was not credited.'
      END,
      requires_admin_attention = true,
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

  SELECT st.user_id
  INTO v_user_id
  FROM public.students st
  WHERE st.student_id = v_log.student_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      reference_id,
      reference_type,
      created_at
    ) VALUES (
      v_user_id,
      'RO Auto Timeout',
      'RO Session Auto Timed Out',
      format(
        'Your RO session was automatically timed out after reaching the required remaining time. Recorded time: %s minute(s). The log is pending admin validation.',
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
    'target_time', v_target_time,
    'duration_minutes', v_remaining_minutes,
    'student_user_id', v_user_id,
    'notification_id', v_notification_id,
    'log', to_jsonb(v_log),
    'ro', to_jsonb(v_ro)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_timeout_ro_log(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_timeout_ro_log(uuid) TO service_role;

