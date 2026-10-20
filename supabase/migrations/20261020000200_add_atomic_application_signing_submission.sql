-- Atomically creates/updates the application state that is bound to a
-- pre-uploaded signing session. Storage uploads deliberately happen before this
-- RPC because PostgreSQL cannot commit Supabase Storage operations.
create or replace function public.submit_application_with_signing(
  p_user_id uuid,
  p_student_id uuid,
  p_opening_id uuid,
  p_program_id uuid,
  p_application_payload jsonb,
  p_application_form_hash text,
  p_signing_session_id uuid,
  p_edit_existing boolean default false,
  p_application_status text default 'Pending Review',
  p_document_status text default 'Missing Docs',
  p_verification_status text default 'pending',
  p_gwa numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_application public.applications%rowtype;
  v_finalization jsonb;
  v_endorsement_slip_id uuid;
  v_endorsement_created boolean := false;
  v_has_remaining_corrections boolean := false;
begin
  if p_user_id is null or p_student_id is null or p_opening_id is null
     or p_signing_session_id is null then
    raise exception 'Applicant, student, opening, and signing session are required.'
      using errcode = '22023';
  end if;
  if p_application_form_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'A valid application form hash is required.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.students s
    where s.student_id = p_student_id
      and s.user_id = p_user_id
      and coalesce(s.is_archived, false) = false
  ) then
    raise exception 'You are not allowed to submit for this student.' using errcode = '42501';
  end if;

  -- Serialize submissions for this applicant/opening even when there is not yet
  -- an application row to lock. The session finalizer separately locks the
  -- signing session and every signing document row.
  perform pg_advisory_xact_lock(
    hashtextextended(p_student_id::text || ':' || p_opening_id::text, 0)
  );

  select * into v_application
  from public.applications
  where student_id = p_student_id
    and opening_id = p_opening_id
    and coalesce(is_archived, false) = false
  for update;

  if found then
    update public.applications
    set program_id = p_program_id,
        application_payload = coalesce(p_application_payload, '{}'::jsonb),
        application_status = coalesce(nullif(btrim(p_application_status), ''), 'Pending Review'),
        document_status = coalesce(nullif(btrim(p_document_status), ''), 'Missing Docs'),
        verification_status = coalesce(nullif(btrim(p_verification_status), ''), 'pending'),
        is_archived = false,
        updated_at = now()
    where application_id = v_application.application_id
    returning * into v_application;
  elsif p_edit_existing then
    raise exception 'The submitted application changed. Refresh the form before editing.'
      using errcode = '22023';
  else
    insert into public.applications (
      student_id, opening_id, program_id, application_status, document_status,
      verification_status, application_payload, is_archived
    ) values (
      p_student_id, p_opening_id, p_program_id,
      coalesce(nullif(btrim(p_application_status), ''), 'Pending Review'),
      coalesce(nullif(btrim(p_document_status), ''), 'Missing Docs'),
      coalesce(nullif(btrim(p_verification_status), ''), 'pending'),
      coalesce(p_application_payload, '{}'::jsonb), false
    ) returning * into v_application;
  end if;

  -- Preserve the established five-document completion gate. Existing rows are
  -- never overwritten, so retrying this RPC cannot blank an uploaded document.
  insert into public.application_documents (
    document_id, application_id, uploaded_by, document_type, is_submitted,
    source_type, ocr
  )
  select gen_random_uuid(), v_application.application_id, p_student_id,
         required_type, false, 'upload', '{}'::jsonb
  from unnest(array[
    'Birth Certificate / PSA',
    'Certificate of Registration',
    'Grade Report',
    'Certificate of Indigency',
    'Letter of Request'
  ]) as required_type
  on conflict (application_id, document_type) do nothing;

  v_finalization := public.finalize_application_signing_session(
    p_signing_session_id,
    p_user_id,
    v_application.application_id,
    p_application_form_hash,
    p_student_id,
    p_user_id
  );

  insert into public.endorsement_slips (
    application_id, student_id, opening_id, current_stage, overall_status
  ) values (
    v_application.application_id, p_student_id, p_opening_id,
    'pending_sdo', 'pending_sdo'
  ) on conflict do nothing
  returning slip_id into v_endorsement_slip_id;

  if v_endorsement_slip_id is not null then
    v_endorsement_created := true;
  else
    select slip_id into v_endorsement_slip_id
    from public.endorsement_slips
    where application_id = v_application.application_id
    limit 1;
  end if;

  update public.students
  set is_profile_complete = true,
      current_application_id = v_application.application_id,
      current_program_id = v_application.program_id,
      gwa = case when p_gwa is null then gwa else p_gwa end,
      updated_at = now()
  where student_id = p_student_id;

  if p_edit_existing then
    insert into public.application_document_reviews (
      application_id, document_key, document_name, review_status,
      admin_comment, issue_severity, reason_code, reviewed_by, reviewed_at,
      updated_at
    ) values (
      v_application.application_id, 'application_form', 'Application Form',
      'pending', '', null, 'APPLICATION_FORM_RESUBMITTED', null, null, now()
    ) on conflict (application_id, document_key) do update set
      document_name = excluded.document_name,
      review_status = 'pending',
      admin_comment = '',
      issue_severity = null,
      reason_code = 'APPLICATION_FORM_RESUBMITTED',
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now();

    select exists (
      select 1
      from public.application_document_reviews
      where application_id = v_application.application_id
        and review_status = 'reupload_required'
    ) into v_has_remaining_corrections;

    update public.applications
    set application_status = case when v_has_remaining_corrections then 'Requires Reupload' else 'Pending Review' end,
        verification_status = case when v_has_remaining_corrections then 'requires_reupload' else 'pending' end,
        document_status = case when v_has_remaining_corrections then 'Requires Reupload' else 'Under Review' end,
        is_disqualified = false,
        rejection_reason = null,
        requirements_verified_at = null,
        updated_at = now()
    where application_id = v_application.application_id
    returning * into v_application;
  end if;

  return jsonb_build_object(
    'application', to_jsonb(v_application),
    'endorsement_slip_id', v_endorsement_slip_id,
    'endorsement_created', v_endorsement_created,
    'already_finalized', coalesce((v_finalization ->> 'already_finalized')::boolean, false)
  );
end;
$function$;

revoke all on function public.submit_application_with_signing(
  uuid, uuid, uuid, uuid, jsonb, text, uuid, boolean, text, text, text, numeric
) from public, anon, authenticated;
grant execute on function public.submit_application_with_signing(
  uuid, uuid, uuid, uuid, jsonb, text, uuid, boolean, text, text, text, numeric
) to service_role;
