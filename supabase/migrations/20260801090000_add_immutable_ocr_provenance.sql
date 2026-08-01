begin;

do $$
begin
  if exists (
    select 1
    from public.application_documents
    group by application_id, document_type
    having count(*) > 1
  ) then
    raise exception 'Duplicate application document slots must be resolved before this migration';
  end if;
end
$$;

alter table public.application_documents
  add constraint application_documents_application_type_unique
  unique (application_id, document_type);

create table public.application_document_versions (
  version_id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.application_documents(document_id),
  application_id uuid not null references public.applications(application_id),
  document_type text not null,
  version_number integer not null check (version_number > 0),
  file_path text not null,
  file_url text,
  file_name text not null,
  content_sha256 text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  legacy_unhashed boolean not null default false,
  created_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  constraint application_document_versions_sha256_format check (
    content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint application_document_versions_verified_source check (
    legacy_unhashed or content_sha256 is not null
  ),
  constraint application_document_versions_document_version_unique
    unique (document_id, version_number),
  constraint application_document_versions_application_type_version_unique
    unique (application_id, document_type, version_number)
);

create index application_document_versions_document_idx
  on public.application_document_versions(document_id, version_number desc);
create index application_document_versions_application_type_idx
  on public.application_document_versions(application_id, document_type, version_number desc);
create index application_document_versions_sha256_idx
  on public.application_document_versions(content_sha256)
  where content_sha256 is not null;

alter table public.application_documents
  add column current_version_id uuid;
alter table public.application_documents
  add constraint application_documents_current_version_fk
  foreign key (current_version_id)
  references public.application_document_versions(version_id);

insert into public.application_document_versions (
  document_id,
  application_id,
  document_type,
  version_number,
  file_path,
  file_url,
  file_name,
  content_sha256,
  file_size_bytes,
  legacy_unhashed,
  created_at
)
select
  ad.document_id,
  ad.application_id,
  ad.document_type,
  1,
  ad.file_path,
  ad.file_url,
  coalesce(nullif(ad.file_name, ''), 'legacy-document'),
  null,
  null,
  true,
  coalesce(ad.updated_at, ad.created_at, now())
from public.application_documents ad
where ad.is_submitted = true
  and ad.file_path is not null
  and not exists (
    select 1
    from public.application_document_versions adv
    where adv.document_id = ad.document_id
  );

update public.application_documents ad
set current_version_id = adv.version_id
from public.application_document_versions adv
where adv.document_id = ad.document_id
  and adv.version_number = 1
  and ad.current_version_id is null;

alter table public.application_documents
  add constraint application_documents_submitted_version_check
  check (not is_submitted or current_version_id is not null) not valid;
alter table public.application_documents
  validate constraint application_documents_submitted_version_check;

alter table public.iot_ocr_requests
  add column application_document_version_id uuid,
  add column source_content_sha256 text,
  add column provenance_legacy_unbound boolean not null default false;
update public.iot_ocr_requests
set provenance_legacy_unbound = true;
alter table public.iot_ocr_requests
  add constraint iot_ocr_requests_document_version_fk
  foreign key (application_document_version_id)
  references public.application_document_versions(version_id);
alter table public.iot_ocr_requests
  add constraint iot_ocr_requests_source_sha256_format
  check (source_content_sha256 is null or source_content_sha256 ~ '^[a-f0-9]{64}$');
alter table public.iot_ocr_requests
  add constraint iot_ocr_requests_provenance_required
  check (
    provenance_legacy_unbound
    or (
      application_document_version_id is not null
      and source_content_sha256 is not null
    )
  );
create index iot_ocr_requests_document_version_idx
  on public.iot_ocr_requests(application_document_version_id, created_at desc);

alter table public.ocr_extracted_documents
  add column iot_ocr_request_id uuid,
  add column application_document_version_id uuid,
  add column source_content_sha256 text,
  add column processing_status text,
  add column is_current boolean not null default false,
  add column supersedes_document_id uuid;
alter table public.ocr_extracted_documents
  add constraint ocr_extracted_documents_request_fk
  foreign key (iot_ocr_request_id)
  references public.iot_ocr_requests(request_id);
alter table public.ocr_extracted_documents
  add constraint ocr_extracted_documents_version_fk
  foreign key (application_document_version_id)
  references public.application_document_versions(version_id);
alter table public.ocr_extracted_documents
  add constraint ocr_extracted_documents_supersedes_fk
  foreign key (supersedes_document_id)
  references public.ocr_extracted_documents(document_id);
alter table public.ocr_extracted_documents
  add constraint ocr_extracted_documents_processing_status_check
  check (
    processing_status is null or processing_status in (
      'completed', 'partial', 'failed', 'superseded', 'legacy_unverified'
    )
  );
alter table public.ocr_extracted_documents
  add constraint ocr_extracted_documents_source_sha256_format
  check (source_content_sha256 is null or source_content_sha256 ~ '^[a-f0-9]{64}$');
create unique index ocr_extracted_documents_request_unique_idx
  on public.ocr_extracted_documents(iot_ocr_request_id)
  where iot_ocr_request_id is not null;

update public.ocr_extracted_documents
set processing_status = 'legacy_unverified';

with ranked as (
  select
    oed.document_id,
    ad.current_version_id,
    row_number() over (
      partition by oed.linked_record_id, oed.linked_record_type, oed.document_key
      order by oed.updated_at desc, oed.created_at desc, oed.document_id desc
    ) as position
  from public.ocr_extracted_documents oed
  join public.application_documents ad
    on oed.linked_record_type = 'application'
   and oed.linked_record_id = ad.application_id
   and oed.document_type = ad.document_type
)
update public.ocr_extracted_documents oed
set
  application_document_version_id = ranked.current_version_id,
  processing_status = 'legacy_unverified',
  is_current = ranked.position = 1
from ranked
where oed.document_id = ranked.document_id;

alter table public.ocr_extracted_documents
  add constraint ocr_extracted_documents_provenance_required
  check (
    processing_status = 'legacy_unverified'
    or (
      processing_status is not null
      and application_document_version_id is not null
      and source_content_sha256 is not null
    )
  );

create unique index ocr_extracted_documents_one_current_idx
  on public.ocr_extracted_documents(linked_record_id, linked_record_type, document_key)
  where is_current = true;

create or replace function public.register_application_document_version(
  p_document_id uuid,
  p_application_id uuid,
  p_document_type text,
  p_uploaded_by uuid,
  p_file_path text,
  p_file_url text,
  p_file_name text,
  p_content_sha256 text,
  p_file_size_bytes bigint,
  p_created_by uuid default null
)
returns public.application_document_versions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.application_documents;
  v_next_version integer;
  v_created public.application_document_versions;
begin
  if p_content_sha256 is null or p_content_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'A valid lowercase SHA-256 value is required.';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes < 0 then
    raise exception using errcode = '22023', message = 'A valid file size is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_application_id::text || ':' || p_document_type, 0)
  );

  select * into v_document
  from public.application_documents
  where application_id = p_application_id
    and document_type = p_document_type
    and (p_document_id is null or document_id = p_document_id)
  for update;

  if not found then
    insert into public.application_documents (
      application_id, uploaded_by, document_type, is_submitted,
      source_type, review_status, updated_at
    ) values (
      p_application_id, p_uploaded_by, p_document_type, false,
      'upload', 'pending', now()
    ) returning * into v_document;
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_next_version
  from public.application_document_versions
  where document_id = v_document.document_id;

  insert into public.application_document_versions (
    document_id, application_id, document_type, version_number,
    file_path, file_url, file_name, content_sha256, file_size_bytes,
    legacy_unhashed, created_by
  ) values (
    v_document.document_id, p_application_id, p_document_type, v_next_version,
    p_file_path, p_file_url, p_file_name, p_content_sha256, p_file_size_bytes,
    false, p_created_by
  ) returning * into v_created;

  update public.ocr_extracted_documents
  set
    is_current = false,
    processing_status = case
      when processing_status in ('completed', 'partial') then 'superseded'
      else processing_status
    end,
    updated_at = now()
  where linked_record_id = p_application_id
    and linked_record_type = 'application'
    and document_type = p_document_type
    and is_current = true;

  update public.iot_ocr_requests
  set
    status = 'cancelled',
    error_message = 'Superseded by a newer document upload',
    completed_at = now(),
    updated_at = now()
  where application_id = p_application_id
    and document_type = p_document_type
    and status = 'pending';

  update public.application_documents
  set
    uploaded_by = p_uploaded_by,
    file_path = p_file_path,
    file_url = p_file_url,
    file_name = p_file_name,
    is_submitted = true,
    source_type = 'upload',
    review_status = 'pending',
    submitted_at = now(),
    current_version_id = v_created.version_id,
    updated_at = now()
  where document_id = v_document.document_id;

  return v_created;
end;
$$;

create or replace function public.insert_immutable_ocr_snapshot(
  p_student_id uuid,
  p_application_id uuid,
  p_document_key text,
  p_document_type text,
  p_iot_ocr_request_id uuid,
  p_application_document_version_id uuid,
  p_source_content_sha256 text,
  p_file_url text,
  p_scanned_via_iot boolean,
  p_iot_device_id uuid,
  p_ocr_extracted_name text,
  p_ocr_extracted_gwa numeric,
  p_ocr_confidence numeric,
  p_ocr_raw_text text,
  p_ocr_structured_fields jsonb,
  p_ocr_review_required boolean,
  p_ocr_processing_metadata jsonb,
  p_processing_status text,
  p_scanned_at timestamptz,
  p_make_current boolean default true
)
returns public.ocr_extracted_documents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.iot_ocr_requests;
  v_version public.application_document_versions;
  v_document public.application_documents;
  v_previous public.ocr_extracted_documents;
  v_created public.ocr_extracted_documents;
  v_effective_current boolean := false;
begin
  if p_iot_ocr_request_id is not null then
    select * into v_request
    from public.iot_ocr_requests
    where request_id = p_iot_ocr_request_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'OCR request was not found.';
    end if;
    if v_request.application_id <> p_application_id
      or v_request.student_id <> p_student_id
      or v_request.document_key <> p_document_key
      or v_request.application_document_version_id is distinct from p_application_document_version_id
      or v_request.source_content_sha256 is distinct from p_source_content_sha256 then
      raise exception using errcode = '23514', message = 'OCR request provenance mismatch.';
    end if;
  end if;

  select * into v_version
  from public.application_document_versions
  where version_id = p_application_document_version_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Source document version was not found.';
  end if;
  if v_version.application_id <> p_application_id
    or v_version.document_type <> p_document_type
    or v_version.content_sha256 is distinct from p_source_content_sha256 then
    raise exception using errcode = '23514', message = 'OCR source document provenance mismatch.';
  end if;

  select * into v_document
  from public.application_documents
  where document_id = v_version.document_id
    and application_id = p_application_id
    and document_type = p_document_type
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Current application document was not found.';
  end if;

  v_effective_current := p_make_current
    and v_document.current_version_id = p_application_document_version_id
    and p_processing_status in ('completed', 'partial');

  if v_effective_current then
    select * into v_previous
    from public.ocr_extracted_documents
    where linked_record_id = p_application_id
      and linked_record_type = 'application'
      and document_key = p_document_key
      and is_current = true
    order by created_at desc
    limit 1
    for update;

    if found then
      update public.ocr_extracted_documents
      set
        is_current = false,
        processing_status = 'superseded',
        updated_at = now()
      where document_id = v_previous.document_id;
    end if;
  end if;

  insert into public.ocr_extracted_documents (
    student_id, linked_record_id, linked_record_type, document_key, document_type,
    file_url, scanned_via_iot, iot_device_id, ocr_extracted_name,
    ocr_extracted_gwa, ocr_confidence, ocr_raw_text, scanned_at,
    ocr_structured_fields, ocr_review_required, ocr_processing_metadata,
    iot_ocr_request_id, application_document_version_id, source_content_sha256,
    processing_status, is_current, supersedes_document_id, created_at, updated_at
  ) values (
    p_student_id, p_application_id, 'application', p_document_key, p_document_type,
    p_file_url, coalesce(p_scanned_via_iot, false), p_iot_device_id, p_ocr_extracted_name,
    p_ocr_extracted_gwa, p_ocr_confidence, p_ocr_raw_text, p_scanned_at,
    coalesce(p_ocr_structured_fields, '{}'::jsonb), coalesce(p_ocr_review_required, false),
    coalesce(p_ocr_processing_metadata, '{}'::jsonb), p_iot_ocr_request_id,
    p_application_document_version_id, p_source_content_sha256,
    case when p_make_current and not v_effective_current then 'superseded' else p_processing_status end,
    v_effective_current, v_previous.document_id, now(), now()
  ) returning * into v_created;

  return v_created;
end;
$$;

create or replace function public.protect_immutable_ocr_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.student_id is distinct from old.student_id
    or new.linked_record_id is distinct from old.linked_record_id
    or new.linked_record_type is distinct from old.linked_record_type
    or new.document_key is distinct from old.document_key
    or new.document_type is distinct from old.document_type
    or new.file_url is distinct from old.file_url
    or new.scanned_via_iot is distinct from old.scanned_via_iot
    or new.iot_device_id is distinct from old.iot_device_id
    or new.ocr_extracted_name is distinct from old.ocr_extracted_name
    or new.ocr_extracted_gwa is distinct from old.ocr_extracted_gwa
    or new.ocr_confidence is distinct from old.ocr_confidence
    or new.ocr_raw_text is distinct from old.ocr_raw_text
    or new.scanned_at is distinct from old.scanned_at
    or new.ocr_structured_fields is distinct from old.ocr_structured_fields
    or new.ocr_review_required is distinct from old.ocr_review_required
    or new.ocr_processing_metadata is distinct from old.ocr_processing_metadata
    or new.iot_ocr_request_id is distinct from old.iot_ocr_request_id
    or new.application_document_version_id is distinct from old.application_document_version_id
    or new.source_content_sha256 is distinct from old.source_content_sha256
    or new.supersedes_document_id is distinct from old.supersedes_document_id
    or new.created_at is distinct from old.created_at then
    raise exception using errcode = '55000', message = 'OCR snapshot content and provenance are immutable.';
  end if;

  if old.is_current = false and new.is_current = true then
    raise exception using errcode = '55000', message = 'A stale OCR snapshot cannot become current again.';
  end if;

  if new.processing_status is distinct from old.processing_status
    and not (
      old.processing_status in ('completed', 'partial', 'legacy_unverified')
      and new.processing_status = 'superseded'
      and old.is_current = true
      and new.is_current = false
    ) then
    raise exception using errcode = '55000', message = 'OCR snapshot status transition is not permitted.';
  end if;

  return new;
end;
$$;

create trigger protect_immutable_ocr_snapshot_before_update
before update on public.ocr_extracted_documents
for each row execute function public.protect_immutable_ocr_snapshot();

create or replace function public.prevent_ocr_snapshot_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = '55000', message = 'OCR snapshots cannot be deleted.';
end;
$$;

create trigger prevent_ocr_snapshot_delete_before_delete
before delete on public.ocr_extracted_documents
for each row execute function public.prevent_ocr_snapshot_delete();

create or replace function public.prevent_document_version_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = '55000', message = 'Application document versions are immutable.';
end;
$$;

create trigger prevent_document_version_update
before update on public.application_document_versions
for each row execute function public.prevent_document_version_mutation();

create trigger prevent_document_version_delete
before delete on public.application_document_versions
for each row execute function public.prevent_document_version_mutation();

alter table public.application_document_versions enable row level security;
revoke all on public.application_document_versions from anon, authenticated;
grant select, insert on public.application_document_versions to service_role;
revoke execute on function public.register_application_document_version(uuid, uuid, text, uuid, text, text, text, text, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.register_application_document_version(uuid, uuid, text, uuid, text, text, text, text, bigint, uuid)
  to service_role;
revoke execute on function public.insert_immutable_ocr_snapshot(uuid, uuid, text, text, uuid, uuid, text, text, boolean, uuid, text, numeric, numeric, text, jsonb, boolean, jsonb, text, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.insert_immutable_ocr_snapshot(uuid, uuid, text, text, uuid, uuid, text, text, boolean, uuid, text, numeric, numeric, text, jsonb, boolean, jsonb, text, timestamptz, boolean)
  to service_role;

commit;
