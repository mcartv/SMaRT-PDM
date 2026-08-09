begin;

alter table public.iot_ocr_requests
    add column if not exists template_id text,
    add column if not exists processing_started_at timestamptz,
    add column if not exists processing_heartbeat_at timestamptz,
    add column if not exists reviewed_by uuid,
    add column if not exists reviewed_at timestamptz,
    add column if not exists retry_of_request_id uuid,
    add column if not exists error_code text;

alter table public.iot_ocr_requests
    drop constraint if exists iot_ocr_requests_status_check;

alter table public.iot_ocr_requests
    add constraint iot_ocr_requests_status_check check (
        status in (
            'pending', 'claimed', 'previewing', 'focusing', 'capturing',
            'processing', 'review_required', 'completed', 'cancelled',
            'failed', 'expired'
        )
    );

alter table public.iot_ocr_requests
    drop constraint if exists iot_ocr_requests_retry_of_fk;

alter table public.iot_ocr_requests
    add constraint iot_ocr_requests_retry_of_fk
    foreign key (retry_of_request_id)
    references public.iot_ocr_requests(request_id)
    on delete set null;

create index if not exists idx_iot_ocr_retry_of
    on public.iot_ocr_requests(retry_of_request_id);

drop index if exists public.uq_iot_ocr_active_request;
create unique index uq_iot_ocr_active_request
    on public.iot_ocr_requests(application_id, document_key)
    where status in (
        'pending', 'claimed', 'previewing', 'focusing', 'capturing', 'processing'
    );

create table if not exists public.iot_ocr_candidates (
    candidate_id uuid primary key default gen_random_uuid(),
    request_id uuid not null unique
        references public.iot_ocr_requests(request_id) on delete restrict,
    document_key text not null,
    template_id text not null,
    raw_text text not null default '',
    fields jsonb not null default '{}'::jsonb,
    field_confidence jsonb not null default '{}'::jsonb,
    validation_issues jsonb not null default '[]'::jsonb,
    processing jsonb not null default '{}'::jsonb,
    device_id uuid not null,
    created_at timestamptz not null default now(),
    constraint iot_ocr_candidates_fields_object check (jsonb_typeof(fields) = 'object'),
    constraint iot_ocr_candidates_confidence_object check (jsonb_typeof(field_confidence) = 'object'),
    constraint iot_ocr_candidates_issues_array check (jsonb_typeof(validation_issues) = 'array'),
    constraint iot_ocr_candidates_processing_object check (jsonb_typeof(processing) = 'object')
);

create table if not exists public.iot_ocr_reviews (
    review_id uuid primary key default gen_random_uuid(),
    request_id uuid not null unique
        references public.iot_ocr_requests(request_id) on delete restrict,
    application_id uuid not null references public.applications(application_id),
    document_key text not null,
    verified_fields jsonb not null,
    reviewed_by uuid not null,
    reviewed_at timestamptz not null default now(),
    constraint iot_ocr_reviews_fields_object
        check (jsonb_typeof(verified_fields) = 'object')
);

alter table public.iot_ocr_candidates enable row level security;
alter table public.iot_ocr_reviews enable row level security;
revoke all on public.iot_ocr_candidates from anon, authenticated;
revoke all on public.iot_ocr_reviews from anon, authenticated;

create or replace function public.prevent_iot_ocr_candidate_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'iot_ocr_candidates are immutable';
end;
$$;

drop trigger if exists trg_iot_ocr_candidates_immutable
    on public.iot_ocr_candidates;
create trigger trg_iot_ocr_candidates_immutable
before update or delete on public.iot_ocr_candidates
for each row execute function public.prevent_iot_ocr_candidate_mutation();

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
            where c.oid = 'public.iot_ocr_candidates'::regclass
              and pg_get_userbyid(c.relowner) = 'smart_pdm_runtime'
        ) then
            raise exception 'smart_pdm_runtime must not own iot_ocr_candidates';
        end if;

        execute 'grant select, insert on public.iot_ocr_candidates to smart_pdm_runtime';
        execute 'revoke update, delete, truncate on public.iot_ocr_candidates from smart_pdm_runtime';
        execute 'grant select, insert on public.iot_ocr_reviews to smart_pdm_runtime';
        execute 'revoke update, delete, truncate on public.iot_ocr_reviews from smart_pdm_runtime';

        execute 'drop policy if exists iot_ocr_candidates_runtime_select on public.iot_ocr_candidates';
        execute 'create policy iot_ocr_candidates_runtime_select on public.iot_ocr_candidates for select to smart_pdm_runtime using (true)';
        execute 'drop policy if exists iot_ocr_candidates_runtime_insert on public.iot_ocr_candidates';
        execute 'create policy iot_ocr_candidates_runtime_insert on public.iot_ocr_candidates for insert to smart_pdm_runtime with check (true)';
        execute 'drop policy if exists iot_ocr_reviews_runtime_select on public.iot_ocr_reviews';
        execute 'create policy iot_ocr_reviews_runtime_select on public.iot_ocr_reviews for select to smart_pdm_runtime using (true)';
        execute 'drop policy if exists iot_ocr_reviews_runtime_insert on public.iot_ocr_reviews';
        execute 'create policy iot_ocr_reviews_runtime_insert on public.iot_ocr_reviews for insert to smart_pdm_runtime with check (true)';
    end if;
end
$$;

commit;
