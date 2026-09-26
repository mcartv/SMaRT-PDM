-- SMaRT-PDM Return of Obligation list/pagination indexes.
-- Additive only: no INSERT/UPDATE/DELETE and no workflow/status changes.

CREATE INDEX IF NOT EXISTS idx_ro_page_applications_status_submission
ON public.applications (
    application_status,
    submission_date DESC,
    application_id DESC
);

CREATE INDEX IF NOT EXISTS idx_ro_page_applications_program_status
ON public.applications (
    program_id,
    application_status,
    submission_date DESC
);

CREATE INDEX IF NOT EXISTS idx_ro_page_applications_opening_status
ON public.applications (
    opening_id,
    application_status,
    submission_date DESC
);

CREATE INDEX IF NOT EXISTS idx_ro_page_students_active_course_year
ON public.students (
    course_id,
    year_level,
    student_id
)
WHERE is_active_scholar = TRUE;

CREATE INDEX IF NOT EXISTS idx_ro_page_current_obligation
ON public.return_of_obligations (
    period_id,
    application_id,
    ro_status,
    assignment_status
);

CREATE INDEX IF NOT EXISTS idx_ro_page_pending_logs
ON public.ro_time_logs (
    ro_id,
    validation_status
);
