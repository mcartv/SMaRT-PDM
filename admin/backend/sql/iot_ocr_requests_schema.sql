CREATE TABLE IF NOT EXISTS public.iot_ocr_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    student_id UUID NOT NULL,
    student_name TEXT NULL,
    document_key TEXT NOT NULL,
    document_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by UUID NULL,
    claimed_by TEXT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT iot_ocr_requests_status_check
        CHECK (status IN ('pending', 'claimed', 'completed', 'cancelled', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_iot_ocr_active_request
    ON public.iot_ocr_requests (application_id, document_key)
    WHERE status IN ('pending', 'claimed');
