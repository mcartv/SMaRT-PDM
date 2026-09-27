begin;

alter table public.iot_ocr_requests
    add column if not exists processing_owner text,
    add column if not exists processing_claimed_at timestamptz;

create index if not exists idx_iot_ocr_processing_owner
    on public.iot_ocr_requests(processing_owner, processing_claimed_at)
    where status = 'processing';

commit;
