-- Pre-submission signing evidence metadata. File content remains in private Storage.
create table if not exists public.application_signing_sessions (
  signing_session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  application_id uuid references public.applications(application_id) on delete restrict,
  application_form_hash text not null check (application_form_hash ~ '^[a-f0-9]{64}$'),
  guardian_name text not null default '',
  guardian_relationship text not null default '',
  consent_acknowledged_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  finalized_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'ready', 'finalized', 'expired')),
  student_signature_path text,
  student_signature_name text,
  student_signature_sha256 text,
  student_signature_size_bytes bigint,
  guardian_signature_path text,
  guardian_signature_name text,
  guardian_signature_sha256 text,
  guardian_signature_size_bytes bigint,
  guardian_id_path text,
  guardian_id_name text,
  guardian_id_sha256 text,
  guardian_id_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_signing_sessions_file_hashes_check check (
    (student_signature_sha256 is null or student_signature_sha256 ~ '^[a-f0-9]{64}$') and
    (guardian_signature_sha256 is null or guardian_signature_sha256 ~ '^[a-f0-9]{64}$') and
    (guardian_id_sha256 is null or guardian_id_sha256 ~ '^[a-f0-9]{64}$')
  )
);

create unique index if not exists application_signing_sessions_open_user_hash_idx
  on public.application_signing_sessions (user_id, application_form_hash)
  where finalized_at is null and status in ('draft', 'ready');
create unique index if not exists application_signing_sessions_application_idx
  on public.application_signing_sessions (application_id)
  where application_id is not null;

alter table public.application_signing_sessions enable row level security;
revoke all on public.application_signing_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.application_signing_sessions to service_role;

create or replace function public.finalize_application_signing_session(
  p_signing_session_id uuid,
  p_user_id uuid,
  p_application_id uuid,
  p_application_form_hash text,
  p_uploaded_by uuid,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_session public.application_signing_sessions%rowtype;
  v_document_id uuid;
  v_version_id uuid;
  v_type text;
  v_path text;
  v_name text;
  v_hash text;
  v_size bigint;
begin
  select * into v_session
  from public.application_signing_sessions
  where signing_session_id = p_signing_session_id
  for update;

  if not found or v_session.user_id <> p_user_id then
    raise exception 'Signing session not found.' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.applications a
    join public.students s on s.student_id = a.student_id
    where a.application_id = p_application_id
      and a.student_id = p_uploaded_by
      and s.user_id = p_user_id
  ) then
    raise exception 'Application does not belong to this signing session owner.' using errcode = '42501';
  end if;
  if v_session.finalized_at is not null then
    if v_session.application_id = p_application_id then
      return jsonb_build_object('application_id', p_application_id, 'already_finalized', true);
    end if;
    raise exception 'Signing session has already been finalized.' using errcode = '23505';
  end if;
  if v_session.expires_at <= now() then
    update public.application_signing_sessions
      set status = 'expired', updated_at = now()
      where signing_session_id = v_session.signing_session_id;
    raise exception 'Signing session has expired.' using errcode = '22023';
  end if;
  if v_session.application_form_hash <> p_application_form_hash then
    raise exception 'Application form changed; signatures must be reconfirmed.' using errcode = '22023';
  end if;
  if v_session.consent_acknowledged_at is null or btrim(v_session.guardian_name) = ''
     or btrim(v_session.guardian_relationship) = ''
     or v_session.student_signature_path is null or v_session.guardian_signature_path is null
     or v_session.guardian_id_path is null then
    raise exception 'Signing session is incomplete.' using errcode = '22023';
  end if;

  foreach v_type in array array['Student Signature', 'Guardian Signature', 'Guardian ID'] loop
    if v_type = 'Student Signature' then
      v_path := v_session.student_signature_path; v_name := v_session.student_signature_name;
      v_hash := v_session.student_signature_sha256; v_size := v_session.student_signature_size_bytes;
    elsif v_type = 'Guardian Signature' then
      v_path := v_session.guardian_signature_path; v_name := v_session.guardian_signature_name;
      v_hash := v_session.guardian_signature_sha256; v_size := v_session.guardian_signature_size_bytes;
    else
      v_path := v_session.guardian_id_path; v_name := v_session.guardian_id_name;
      v_hash := v_session.guardian_id_sha256; v_size := v_session.guardian_id_size_bytes;
    end if;

    insert into public.application_documents (
      document_id, application_id, uploaded_by, document_type, is_submitted,
      file_path, file_name, source_type, review_status, submitted_at
    ) values (
      gen_random_uuid(), p_application_id, p_uploaded_by, v_type, true,
      v_path, v_name, 'signing_session', 'pending', now()
    ) on conflict (application_id, document_type) do update
      set uploaded_by = excluded.uploaded_by,
          is_submitted = true,
          file_path = excluded.file_path,
          file_name = excluded.file_name,
          source_type = excluded.source_type,
          review_status = 'pending',
          reviewed_by = null,
          reviewed_at = null,
          submitted_at = now(),
          updated_at = now()
      where public.application_documents.current_version_id is null
    returning document_id into v_document_id;

    if v_document_id is null then
      select document_id into v_document_id from public.application_documents
       where application_id = p_application_id and document_type = v_type;
    end if;

    insert into public.application_document_versions (
      version_id, document_id, application_id, document_type, version_number,
      file_path, file_name, content_sha256, file_size_bytes, legacy_unhashed, created_by
    ) values (
      gen_random_uuid(), v_document_id, p_application_id, v_type, 1,
      v_path, v_name, v_hash, v_size, false, p_created_by
    ) on conflict do nothing
    returning version_id into v_version_id;

    if v_version_id is not null then
      update public.application_documents set current_version_id = v_version_id
       where document_id = v_document_id and current_version_id is null;
    end if;
  end loop;

  update public.application_signing_sessions
  set application_id = p_application_id, status = 'finalized', finalized_at = now(), updated_at = now()
  where signing_session_id = v_session.signing_session_id;

  return jsonb_build_object('application_id', p_application_id, 'already_finalized', false);
end;
$function$;

revoke all on function public.finalize_application_signing_session(uuid, uuid, uuid, text, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.finalize_application_signing_session(uuid, uuid, uuid, text, uuid, uuid)
to service_role;
