CREATE TABLE IF NOT EXISTS ocr_jobs (
    id BIGSERIAL PRIMARY KEY,
    application_id TEXT NOT NULL,
    document_key TEXT NOT NULL,
    document_type TEXT NOT NULL,
    student_id TEXT NULL,
    student_name TEXT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    priority INTEGER NOT NULL DEFAULT 0,
    requested_by TEXT NULL,
    claimed_by TEXT NULL,
    raw_text TEXT NULL,
    ocr_confidence NUMERIC NULL,
    extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ocr_jobs_status_check
        CHECK (status IN ('queued', 'in_progress', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status_priority_created_at
    ON ocr_jobs (status, priority DESC, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ocr_jobs_active_unique
    ON ocr_jobs (application_id, document_key)
    WHERE status IN ('queued', 'in_progress');
