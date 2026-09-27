begin;

alter table public.iot_ocr_requests
    add column if not exists ocr_processing_metadata jsonb
    not null default '{}'::jsonb;

commit;
