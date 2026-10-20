-- Applicant correction path for signing evidence. Storage upload is deliberately
-- completed by the backend before this RPC; this transaction only binds metadata.
create or replace function public.replace_application_signing_document(
  p_document_id uuid,
  p_user_id uuid,
  p_uploaded_by uuid,
  p_file_path text,
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
  v_review_key text;
begin
  if p_document_id is null or p_user_id is null or p_uploaded_by is null then
    raise exception 'Document, owner, and applicant are required.' using errcode = '22023';
  end if;
  if nullif(btrim(p_file_path), '') is null or nullif(btrim(p_file_name), '') is null then
    raise exception 'File metadata is required.' using errcode = '22023';
  end if;
  if p_content_sha256 !~ '^[a-f0-9]{64}$' or coalesce(p_file_size_bytes, 0) < 1 then
    raise exception 'Valid file integrity metadata is required.' using errcode = '22023';
  end if;

  select * into v_document
  from public.application_documents
  where document_id = p_document_id
  for update;

  if not found then
    raise exception 'Signing document not found.' using errcode = '22023';
  end if;
  if v_document.document_type not in ('Student Signature', 'Guardian Signature', 'Guardian ID') then
    raise exception 'This document is not eligible for signing correction.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.applications a
    join public.students s on s.student_id = a.student_id
    where a.application_id = v_document.application_id
      and a.student_id = p_uploaded_by
      and s.user_id = p_user_id
      and coalesce(a.is_archived, false) = false
  ) then
    raise exception 'You are not allowed to correct this signing document.' using errcode = '42501';
  end if;
  if v_document.is_submitted is not true or v_document.current_version_id is null then
    raise exception 'Only an existing signing document can be corrected.' using errcode = '22023';
  end if;
  if lower(coalesce(v_document.review_status, '')) <> 'reupload_required' then
    raise exception 'Signing replacement is allowed only after a correction request.' using errcode = '22023';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.application_document_versions
  where document_id = v_document.document_id;

  insert into public.application_document_versions (
    version_id, document_id, application_id, document_type, version_number,
    file_path, file_url, file_name, content_sha256, file_size_bytes,
    legacy_unhashed, created_by
  ) values (
    v_version_id, v_document.document_id, v_document.application_id,
    v_document.document_type, v_version_number, p_file_path, null,
    p_file_name, p_content_sha256, p_file_size_bytes, false, p_user_id
  );

  update public.application_documents
  set uploaded_by = p_uploaded_by,
      current_version_id = v_version_id,
      is_submitted = true,
      file_url = null,
      file_name = p_file_name,
      file_path = p_file_path,
      preview_path = null,
      preview_size_bytes = null,
      preview_created_at = null,
      source_type = 'signing_correction',
      review_status = 'pending',
      reviewed_by = null,
      reviewed_at = null,
      submitted_at = now(),
      updated_at = now()
  where document_id = v_document.document_id;

  v_review_key := case v_document.document_type
    when 'Student Signature' then 'student_signature'
    when 'Guardian Signature' then 'guardian_signature'
    else 'guardian_id'
  end;
  insert into public.application_document_reviews (
    application_id, document_key, document_name, review_status,
    admin_comment, issue_severity, reason_code, reviewed_by, reviewed_at, updated_at
  ) values (
    v_document.application_id, v_review_key, v_document.document_type, 'pending',
    '', null, null, null, null, now()
  ) on conflict (application_id, document_key) do update set
    document_name = excluded.document_name,
    review_status = 'pending',
    admin_comment = '',
    issue_severity = null,
    reason_code = null,
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now();

  update public.applications
  set verification_status = 'pending', requirements_verified_at = null, updated_at = now()
  where application_id = v_document.application_id;

  return jsonb_build_object(
    'document_id', v_document.document_id,
    'version_id', v_version_id,
    'version_number', v_version_number,
    'review_status', 'pending'
  );
end;
$function$;

revoke all on function public.replace_application_signing_document(
  uuid, uuid, uuid, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.replace_application_signing_document(
  uuid, uuid, uuid, text, text, text, bigint
) to service_role;
