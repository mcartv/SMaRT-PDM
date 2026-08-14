begin;

alter table public.iot_ocr_requests
    add column if not exists ocr_version text not null default 'v1';

alter table public.iot_ocr_requests
    drop constraint if exists iot_ocr_requests_ocr_version_check;

alter table public.iot_ocr_requests
    add constraint iot_ocr_requests_ocr_version_check
    check (ocr_version in ('v1', 'v2'));

alter table public.iot_ocr_candidates
    add column if not exists ocr_version text not null default 'v1';

alter table public.iot_ocr_candidates
    drop constraint if exists iot_ocr_candidates_ocr_version_check;

alter table public.iot_ocr_candidates
    add constraint iot_ocr_candidates_ocr_version_check
    check (ocr_version in ('v1', 'v2'));

create table if not exists public.iot_ocr_capture_artifacts (
    artifact_id uuid primary key default gen_random_uuid(),
    request_id uuid not null
        references public.iot_ocr_requests(request_id) on delete restrict,
    artifact_kind text not null,
    cell_key text,
    bucket_name text not null,
    object_path text not null unique,
    mime_type text not null,
    byte_count bigint not null check (byte_count > 0 and byte_count <= 15728640),
    sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
    roi_polygon jsonb,
    upload_status text not null default 'pending',
    device_id uuid not null,
    created_at timestamptz not null default now(),
    uploaded_at timestamptz,
    deletion_pending_at timestamptz,
    deleted_at timestamptz,
    updated_at timestamptz not null default now(),
    constraint iot_ocr_capture_artifact_kind_check check (
        artifact_kind in ('original', 'cell')
    ),
    constraint iot_ocr_capture_artifact_cell_check check (
        (artifact_kind = 'original' and cell_key is null)
        or
        (artifact_kind = 'cell' and cell_key in (
            'item1_first', 'item1_middle', 'item1_last',
            'item6_first', 'item6_middle', 'item6_last',
            'item13_first', 'item13_middle', 'item13_last'
        ))
    ),
    constraint iot_ocr_capture_artifact_mime_check check (
        mime_type in ('image/jpeg', 'image/png')
    ),
    constraint iot_ocr_capture_artifact_status_check check (
        upload_status in ('pending', 'available', 'deletion_pending', 'deleted', 'failed')
    ),
    constraint iot_ocr_capture_artifact_roi_check check (
        roi_polygon is null or jsonb_typeof(roi_polygon) = 'array'
    )
);

create unique index if not exists uq_iot_ocr_capture_artifact_slot
    on public.iot_ocr_capture_artifacts(request_id, artifact_kind, coalesce(cell_key, ''));
create index if not exists idx_iot_ocr_capture_artifacts_request
    on public.iot_ocr_capture_artifacts(request_id, upload_status);
create index if not exists idx_iot_ocr_capture_artifacts_hash
    on public.iot_ocr_capture_artifacts(sha256)
    where artifact_kind = 'original'
      and upload_status in ('available', 'deletion_pending', 'deleted');

create table if not exists public.iot_ocr_review_exceptions (
    exception_id uuid primary key default gen_random_uuid(),
    request_id uuid not null
        references public.iot_ocr_requests(request_id) on delete restrict,
    candidate_id uuid
        references public.iot_ocr_candidates(candidate_id) on delete restrict,
    field_key text,
    exception_group text not null,
    priority text not null,
    rule_code text not null,
    resolved_at timestamptz,
    resolved_by uuid,
    created_at timestamptz not null default now(),
    constraint iot_ocr_review_exception_group_check check (
        exception_group in (
            'ready_to_confirm', 'low_confidence', 'missing_field',
            'failed_validation', 'duplicate_suspicion', 'diagnostic_only'
        )
    ),
    constraint iot_ocr_review_exception_priority_check check (
        priority in ('compliance_hold', 'customer_facing', 'standard')
    )
);

create index if not exists idx_iot_ocr_review_exceptions_queue
    on public.iot_ocr_review_exceptions(resolved_at, priority, exception_group, created_at);
create index if not exists idx_iot_ocr_review_exceptions_request
    on public.iot_ocr_review_exceptions(request_id);
create index if not exists idx_iot_ocr_review_exceptions_candidate
    on public.iot_ocr_review_exceptions(candidate_id)
    where candidate_id is not null;

create table if not exists public.iot_ocr_review_events (
    event_id uuid primary key default gen_random_uuid(),
    request_id uuid not null
        references public.iot_ocr_requests(request_id) on delete restrict,
    candidate_id uuid not null
        references public.iot_ocr_candidates(candidate_id) on delete restrict,
    application_id uuid not null
        references public.applications(application_id) on delete restrict,
    event_type text not null,
    predicted_fields jsonb not null default '{}'::jsonb,
    submitted_fields jsonb not null default '{}'::jsonb,
    changed_fields jsonb not null default '[]'::jsonb,
    reason_code text,
    triggered_rules jsonb not null default '[]'::jsonb,
    reviewed_by uuid not null,
    created_at timestamptz not null default now(),
    constraint iot_ocr_review_event_type_check check (
        event_type in ('confirmed', 'corrected', 'rejected', 'rescan_requested')
    ),
    constraint iot_ocr_review_event_predicted_check check (
        jsonb_typeof(predicted_fields) = 'object'
    ),
    constraint iot_ocr_review_event_submitted_check check (
        jsonb_typeof(submitted_fields) = 'object'
    ),
    constraint iot_ocr_review_event_changed_check check (
        jsonb_typeof(changed_fields) = 'array'
    ),
    constraint iot_ocr_review_event_rules_check check (
        jsonb_typeof(triggered_rules) = 'array'
    )
);

create index if not exists idx_iot_ocr_review_events_request
    on public.iot_ocr_review_events(request_id, created_at);
create index if not exists idx_iot_ocr_review_events_candidate
    on public.iot_ocr_review_events(candidate_id);
create index if not exists idx_iot_ocr_review_events_application
    on public.iot_ocr_review_events(application_id, created_at);

create or replace function public.prevent_iot_ocr_review_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'iot_ocr_review_events are immutable';
end;
$$;

drop trigger if exists trg_iot_ocr_review_events_immutable
    on public.iot_ocr_review_events;
create trigger trg_iot_ocr_review_events_immutable
before update or delete on public.iot_ocr_review_events
for each row execute function public.prevent_iot_ocr_review_event_mutation();

alter table public.iot_ocr_capture_artifacts enable row level security;
alter table public.iot_ocr_review_exceptions enable row level security;
alter table public.iot_ocr_review_events enable row level security;

revoke all on public.iot_ocr_capture_artifacts from anon, authenticated;
revoke all on public.iot_ocr_review_exceptions from anon, authenticated;
revoke all on public.iot_ocr_review_events from anon, authenticated;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'smart_pdm_runtime') then
        if exists (
            select 1 from pg_roles
            where rolname = 'smart_pdm_runtime' and rolsuper
        ) then
            raise exception 'smart_pdm_runtime must not be a superuser';
        end if;
        if exists (
            select 1
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname in (
                'iot_ocr_candidates', 'iot_ocr_capture_artifacts',
                'iot_ocr_review_exceptions', 'iot_ocr_review_events'
              )
              and pg_get_userbyid(c.relowner) = 'smart_pdm_runtime'
        ) then
            raise exception 'smart_pdm_runtime must not own OCR persistence tables';
        end if;

        execute 'grant usage on schema public to smart_pdm_runtime';
        execute 'grant select, insert, update on public.iot_ocr_capture_artifacts to smart_pdm_runtime';
        execute 'revoke delete, truncate on public.iot_ocr_capture_artifacts from smart_pdm_runtime';
        execute 'grant select, insert, update on public.iot_ocr_review_exceptions to smart_pdm_runtime';
        execute 'revoke delete, truncate on public.iot_ocr_review_exceptions from smart_pdm_runtime';
        execute 'grant select, insert on public.iot_ocr_review_events to smart_pdm_runtime';
        execute 'revoke update, delete, truncate on public.iot_ocr_review_events from smart_pdm_runtime';

        execute 'drop policy if exists iot_ocr_capture_artifacts_runtime_all on public.iot_ocr_capture_artifacts';
        execute 'create policy iot_ocr_capture_artifacts_runtime_all on public.iot_ocr_capture_artifacts for all to smart_pdm_runtime using (true) with check (true)';
        execute 'drop policy if exists iot_ocr_review_exceptions_runtime_all on public.iot_ocr_review_exceptions';
        execute 'create policy iot_ocr_review_exceptions_runtime_all on public.iot_ocr_review_exceptions for all to smart_pdm_runtime using (true) with check (true)';
        execute 'drop policy if exists iot_ocr_review_events_runtime_select on public.iot_ocr_review_events';
        execute 'create policy iot_ocr_review_events_runtime_select on public.iot_ocr_review_events for select to smart_pdm_runtime using (true)';
        execute 'drop policy if exists iot_ocr_review_events_runtime_insert on public.iot_ocr_review_events';
        execute 'create policy iot_ocr_review_events_runtime_insert on public.iot_ocr_review_events for insert to smart_pdm_runtime with check (true)';
    end if;
end
$$;

commit;
