create table if not exists public.mobile_user_preferences (
  user_id uuid primary key references public.users(user_id) on delete cascade,
  onboarding_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mobile_user_preferences enable row level security;

revoke all on table public.mobile_user_preferences from anon, authenticated;
grant select, insert, update on table public.mobile_user_preferences to service_role;

create or replace function public.finalize_application_document_upload(
  p_document_id uuid,
  p_uploaded_by uuid,
  p_created_by uuid,
  p_file_path text,
  p_file_url text,
  p_file_name text,
  p_content_sha256 text,
  p_file_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_document public.application_documents%rowtype;
  v_version_id uuid := gen_random_uuid();
  v_version_number integer;
begin
  if p_document_id is null then
    raise exception 'Document ID is required.';
  end if;
  if p_uploaded_by is null then
    raise exception 'Uploaded-by student ID is required.';
  end if;
  if nullif(btrim(p_file_path), '') is null then
    raise exception 'File path is required.';
  end if;
  if nullif(btrim(p_file_name), '') is null then
    raise exception 'File name is required.';
  end if;
  if p_content_sha256 is null or p_content_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'A valid SHA-256 hash is required.';
  end if;

  select * into v_document
  from public.application_documents
  where document_id = p_document_id
  for update;

  if not found then
    raise exception 'Application document not found.';
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_version_number
  from public.application_document_versions
  where document_id = p_document_id;

  insert into public.application_document_versions (
    version_id, document_id, application_id, document_type, version_number,
    file_path, file_url, file_name, content_sha256, file_size_bytes,
    legacy_unhashed, created_by
  ) values (
    v_version_id, v_document.document_id, v_document.application_id,
    v_document.document_type, v_version_number, p_file_path, p_file_url,
    p_file_name, p_content_sha256, p_file_size_bytes, false, p_created_by
  );

  update public.application_documents
  set uploaded_by = p_uploaded_by,
      current_version_id = v_version_id,
      is_submitted = true,
      file_url = p_file_url,
      file_name = p_file_name,
      file_path = p_file_path,
      source_type = 'upload',
      review_status = 'pending',
      reviewed_by = null,
      reviewed_at = null,
      submitted_at = now(),
      updated_at = now()
  where document_id = p_document_id;

  return jsonb_build_object(
    'document_id', p_document_id,
    'version_id', v_version_id,
    'version_number', v_version_number,
    'file_path', p_file_path,
    'file_url', p_file_url
  );
end;
$function$;

revoke all on function public.finalize_application_document_upload(
  uuid, uuid, uuid, text, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.finalize_application_document_upload(
  uuid, uuid, uuid, text, text, text, text, bigint
) to service_role;
