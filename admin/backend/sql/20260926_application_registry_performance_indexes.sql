-- SMaRT-PDM Applications registry read-path indexes
-- Safe to run repeatedly. Apply once in Supabase/PostgreSQL.

CREATE INDEX IF NOT EXISTS idx_applications_registry_student_opening_submission
    ON public.applications (
        student_id,
        opening_id,
        submission_date DESC,
        application_id DESC
    )
    WHERE COALESCE(is_archived, FALSE) = FALSE
      AND COALESCE(is_disqualified, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_applications_registry_submission
    ON public.applications (submission_date DESC, application_id DESC)
    WHERE COALESCE(is_archived, FALSE) = FALSE
      AND COALESCE(is_disqualified, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_application_documents_readiness_lookup
    ON public.application_documents (
        application_id,
        LOWER(TRIM(COALESCE(document_type, '')))
    )
    WHERE COALESCE(is_submitted, FALSE) = TRUE;

CREATE INDEX IF NOT EXISTS idx_application_document_reviews_readiness_lookup
    ON public.application_document_reviews (
        application_id,
        LOWER(COALESCE(document_key, '')),
        LOWER(COALESCE(review_status, ''))
    );

-- Supports server-side status filters and newest-first paging.
CREATE INDEX IF NOT EXISTS idx_applications_registry_status_filters
    ON public.applications (
        LOWER(COALESCE(application_status, '')),
        LOWER(COALESCE(document_status, '')),
        submission_date DESC,
        application_id DESC
    )
    WHERE COALESCE(is_archived, FALSE) = FALSE
      AND COALESCE(is_disqualified, FALSE) = FALSE;

-- Supports the read-only Readiness/FCFS split without recalculating queues.
CREATE INDEX IF NOT EXISTS idx_applications_registry_readiness
    ON public.applications (
        opening_id,
        LOWER(COALESCE(verification_status, '')),
        LOWER(COALESCE(selection_status, '')),
        queue_position,
        fcfs_completed_at
    )
    WHERE COALESCE(is_archived, FALSE) = FALSE
      AND COALESCE(is_disqualified, FALSE) = FALSE;
