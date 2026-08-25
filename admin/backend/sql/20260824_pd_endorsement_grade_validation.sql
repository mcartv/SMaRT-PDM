-- SMaRT-PDM
-- PD Endorsement Grade Validation
-- Mirrors the database migration already applied to the connected Supabase project.

create or replace function public.get_endorsement_grade_validation(p_application_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
    grade_doc record;
    ocr_row record;
    raw_gwa text;
    extracted_gwa numeric;
    validation_status text;
    blocking_reason text;
begin
    select
        ad.document_id,
        ad.current_version_id,
        ad.review_status,
        ad.submitted_at
    into grade_doc
    from public.application_documents ad
    where ad.application_id = p_application_id
      and lower(trim(coalesce(ad.document_type, ''))) = 'grade report'
      and coalesce(ad.is_submitted, false) = true
      and (
        nullif(trim(coalesce(ad.file_path, '')), '') is not null
        or nullif(trim(coalesce(ad.file_url, '')), '') is not null
      )
    order by ad.submitted_at desc nulls last, ad.updated_at desc nulls last
    limit 1;

    if grade_doc.document_id is null then
        return jsonb_build_object(
            'status', 'missing_document',
            'is_valid', false,
            'document_uploaded', false,
            'blocking_reason',
            'A submitted Grade Report is required before Program Director endorsement.'
        );
    end if;

    select
        oed.document_id,
        oed.application_document_version_id,
        oed.processing_status,
        oed.is_current,
        oed.ocr_review_required,
        oed.ocr_extracted_gwa,
        oed.ocr_confidence,
        oed.ocr_structured_fields,
        oed.created_at
    into ocr_row
    from public.ocr_extracted_documents oed
    where lower(trim(coalesce(oed.document_type, ''))) = 'grade report'
      and (
        oed.linked_record_id = p_application_id
        or (
            grade_doc.current_version_id is not null
            and oed.application_document_version_id = grade_doc.current_version_id
        )
      )
    order by
        case
            when grade_doc.current_version_id is not null
             and oed.application_document_version_id = grade_doc.current_version_id
            then 0 else 1
        end,
        case when coalesce(oed.is_current, false) then 0 else 1 end,
        oed.created_at desc nulls last
    limit 1;

    if ocr_row.document_id is null then
        return jsonb_strip_nulls(jsonb_build_object(
            'status', 'ocr_missing',
            'is_valid', false,
            'document_uploaded', true,
            'document_id', grade_doc.document_id,
            'document_review_status', grade_doc.review_status,
            'document_submitted_at', grade_doc.submitted_at,
            'blocking_reason',
            'The Grade Report has not produced an OCR grade result yet. Scan or reprocess the document before Program Director endorsement.'
        ));
    end if;

    raw_gwa := coalesce(
        nullif(trim(ocr_row.ocr_extracted_gwa::text), ''),
        nullif(trim(ocr_row.ocr_structured_fields #>> '{fields,gwa,normalized_value}'), ''),
        nullif(trim(ocr_row.ocr_structured_fields #>> '{fields,general_weighted_average,normalized_value}'), ''),
        nullif(trim(ocr_row.ocr_structured_fields #>> '{fields,gwa,raw_text}'), ''),
        nullif(trim(ocr_row.ocr_structured_fields #>> '{fields,general_weighted_average,raw_text}'), '')
    );

    if raw_gwa is not null
       and raw_gwa ~ '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*$'
    then
        extracted_gwa := trim(raw_gwa)::numeric;
    end if;

    if lower(coalesce(ocr_row.processing_status, '')) in
       ('failed', 'error', 'template_mismatch', 'rejected')
    then
        validation_status := 'ocr_failed';
        blocking_reason :=
            'Grade Report OCR processing failed. Reprocess the document before Program Director endorsement.';
    elsif extracted_gwa is null then
        validation_status := 'gwa_missing';
        blocking_reason :=
            'OCR did not extract a usable GWA from the Grade Report. Re-scan or review the document before Program Director endorsement.';
    elsif extracted_gwa < 1.00 or extracted_gwa > 5.00 then
        validation_status := 'gwa_invalid';
        blocking_reason :=
            'The extracted GWA is outside the valid 1.00 to 5.00 range. Review or reprocess the Grade Report before endorsement.';
    else
        validation_status := 'valid';
        blocking_reason := null;
    end if;

    return jsonb_strip_nulls(jsonb_build_object(
        'status', validation_status,
        'is_valid', validation_status = 'valid',
        'document_uploaded', true,
        'document_id', grade_doc.document_id,
        'document_review_status', grade_doc.review_status,
        'document_submitted_at', grade_doc.submitted_at,
        'ocr_document_id', ocr_row.document_id,
        'ocr_processing_status', coalesce(ocr_row.processing_status, 'legacy'),
        'ocr_is_current', coalesce(ocr_row.is_current, false),
        'ocr_review_required', coalesce(ocr_row.ocr_review_required, false),
        'ocr_confidence', ocr_row.ocr_confidence,
        'extracted_gwa', extracted_gwa,
        'blocking_reason', blocking_reason,
        'validated_at', now()
    ));
end;
$$;

create or replace function public.sync_endorsement_slip_grade_summary(p_application_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
    validation jsonb;
begin
    validation := public.get_endorsement_grade_validation(p_application_id);

    update public.endorsement_slips es
    set
        grade_summary_json = jsonb_strip_nulls(jsonb_build_object(
            'gwa',
            case
                when nullif(validation ->> 'extracted_gwa', '') is not null
                then (validation ->> 'extracted_gwa')::numeric
                else null
            end,
            'student_record_gwa', st.gwa,
            'grade_document_uploaded',
                coalesce((validation ->> 'document_uploaded')::boolean, false),
            'grade_document_submitted_at', validation ->> 'document_submitted_at',
            'grade_validation', validation
        )),
        updated_at = now()
    from public.applications a
    join public.students st on st.student_id = a.student_id
    where es.application_id = a.application_id
      and a.application_id = p_application_id;
end;
$$;

create or replace function public.refresh_endorsement_slip_after_grade_upload()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    target_application_id uuid;
    relevant_document_type text;
begin
    target_application_id := coalesce(new.application_id, old.application_id);
    relevant_document_type := lower(trim(coalesce(new.document_type, old.document_type, '')));

    if target_application_id is not null and relevant_document_type = 'grade report' then
        perform public.sync_endorsement_slip_grade_summary(target_application_id);
    end if;

    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_application_documents_refresh_endorsement_slip
on public.application_documents;

create trigger trg_application_documents_refresh_endorsement_slip
after insert or update or delete on public.application_documents
for each row execute function public.refresh_endorsement_slip_after_grade_upload();

create or replace function public.refresh_endorsement_slip_after_grade_ocr()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    source_row public.ocr_extracted_documents%rowtype;
    target_application_id uuid;
begin
    source_row := coalesce(new, old);

    if lower(trim(coalesce(source_row.document_type, ''))) <> 'grade report' then
        return coalesce(new, old);
    end if;

    if lower(trim(coalesce(source_row.linked_record_type, ''))) = 'application' then
        target_application_id := source_row.linked_record_id;
    end if;

    if target_application_id is null
       and source_row.application_document_version_id is not null
    then
        select adv.application_id
        into target_application_id
        from public.application_document_versions adv
        where adv.version_id = source_row.application_document_version_id
        limit 1;
    end if;

    if target_application_id is not null then
        perform public.sync_endorsement_slip_grade_summary(target_application_id);
    end if;

    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ocr_grade_refresh_endorsement_slip
on public.ocr_extracted_documents;

create trigger trg_ocr_grade_refresh_endorsement_slip
after insert or update or delete on public.ocr_extracted_documents
for each row execute function public.refresh_endorsement_slip_after_grade_ocr();

create or replace function public.enforce_pd_grade_validation_before_endorsement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    validation jsonb;
    reason text;
begin
    if new.pd_status is distinct from old.pd_status
       and lower(trim(coalesce(new.pd_status, ''))) in (
           'good_scholastic_standing',
           'average_scholastic_standing',
           'approved'
       )
    then
        validation := public.get_endorsement_grade_validation(new.application_id);

        if not coalesce((validation ->> 'is_valid')::boolean, false) then
            reason := coalesce(
                nullif(validation ->> 'blocking_reason', ''),
                'Grade Report validation must pass before Program Director endorsement.'
            );

            raise exception using
                errcode = '23514',
                message = 'PD grade validation failed: ' || reason,
                detail = validation::text;
        end if;

        new.grade_summary_json := jsonb_set(
            coalesce(new.grade_summary_json, '{}'::jsonb),
            '{grade_validation}',
            validation,
            true
        );

        new.grade_summary_json := jsonb_set(
            new.grade_summary_json,
            '{gwa}',
            to_jsonb((validation ->> 'extracted_gwa')::numeric),
            true
        );
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_pd_grade_validation
on public.endorsement_slips;

create trigger trg_enforce_pd_grade_validation
before update of pd_status on public.endorsement_slips
for each row execute function public.enforce_pd_grade_validation_before_endorsement();

do $$
declare
    item record;
begin
    for item in
        select distinct application_id
        from public.endorsement_slips
        where application_id is not null
    loop
        perform public.sync_endorsement_slip_grade_summary(item.application_id);
    end loop;
end;
$$;
