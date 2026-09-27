begin;

alter table public.iot_ocr_requests
    add column if not exists processing_attempt_count integer not null default 0,
    add column if not exists processing_retry_at timestamptz,
    add column if not exists processing_last_error_code text,
    add column if not exists processing_last_error_at timestamptz;

create index if not exists idx_iot_ocr_processing_retry
    on public.iot_ocr_requests(status, processing_retry_at, processing_claimed_at)
    where status = 'processing';

commit;
