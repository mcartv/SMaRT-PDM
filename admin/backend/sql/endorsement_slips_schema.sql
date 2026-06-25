create extension if not exists pgcrypto;

create table if not exists public.endorsement_slips (
    slip_id uuid primary key default gen_random_uuid(),
    application_id uuid not null unique references public.applications(application_id) on delete cascade,
    student_id uuid not null references public.students(student_id) on delete cascade,
    opening_id uuid null references public.program_openings(opening_id) on delete set null,
    current_stage text not null default 'pending_pd',
    overall_status text not null default 'pending_pd',
    grade_summary_json jsonb not null default '{}'::jsonb,
    pd_status text null,
    pd_acted_at timestamptz null,
    pd_acted_by_user_id uuid null references public.users(user_id) on delete set null,
    pd_remarks text null,
    guidance_status text null,
    guidance_acted_at timestamptz null,
    guidance_acted_by_user_id uuid null references public.users(user_id) on delete set null,
    guidance_remarks text null,
    sdo_status text null,
    sdo_acted_at timestamptz null,
    sdo_acted_by_user_id uuid null references public.users(user_id) on delete set null,
    sdo_remarks text null,
    final_pdf_url text null,
    final_pdf_path text null,
    verification_token text not null unique default encode(gen_random_bytes(24), 'hex'),
    completed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint endorsement_slips_current_stage_check
        check (
            current_stage in (
                'pending_pd',
                'pending_guidance',
                'pending_sdo',
                'completed',
                'rejected',
                'held',
                'disqualified_minor',
                'disqualified_major'
            )
        ),
    constraint endorsement_slips_overall_status_check
        check (
            overall_status in (
                'pending_pd',
                'pending_guidance',
                'pending_sdo',
                'completed',
                'rejected',
                'held',
                'disqualified_minor',
                'disqualified_major'
            )
        ),
    constraint endorsement_slips_pd_status_check
        check (pd_status is null or pd_status in ('approved', 'rejected')),
    constraint endorsement_slips_guidance_status_check
        check (guidance_status is null or guidance_status in ('cleared', 'held')),
    constraint endorsement_slips_sdo_status_check
        check (sdo_status is null or sdo_status in ('cleared', 'disqualified_minor', 'disqualified_major'))
);

create index if not exists idx_endorsement_slips_stage
    on public.endorsement_slips(current_stage, created_at desc);

create index if not exists idx_endorsement_slips_student
    on public.endorsement_slips(student_id);

create index if not exists idx_endorsement_slips_token
    on public.endorsement_slips(verification_token);

create or replace function public.sync_endorsement_slip_grade_summary(p_application_id uuid)
returns void
language plpgsql
as $$
begin
    update public.endorsement_slips es
    set
        grade_summary_json = jsonb_strip_nulls(
            jsonb_build_object(
                'gwa', st.gwa,
                'grade_document_uploaded', exists(
                    select 1
                    from public.application_documents ad
                    where ad.application_id = p_application_id
                      and lower(coalesce(ad.document_type, '')) = 'grade report'
                      and coalesce(ad.is_submitted, false) = true
                ),
                'grade_document_submitted_at', (
                    select ad.submitted_at
                    from public.application_documents ad
                    where ad.application_id = p_application_id
                      and lower(coalesce(ad.document_type, '')) = 'grade report'
                    order by ad.submitted_at desc nulls last
                    limit 1
                )
            )
        ),
        updated_at = now()
    from public.applications a
    join public.students st on st.student_id = a.student_id
    where es.application_id = a.application_id
      and a.application_id = p_application_id;
end;
$$;

create or replace function public.ensure_endorsement_slip_for_application()
returns trigger
language plpgsql
as $$
begin
    insert into public.endorsement_slips (
        application_id,
        student_id,
        opening_id,
        current_stage,
        overall_status
    )
    values (
        new.application_id,
        new.student_id,
        new.opening_id,
        'pending_pd',
        'pending_pd'
    )
    on conflict (application_id) do update
    set
        student_id = excluded.student_id,
        opening_id = excluded.opening_id,
        updated_at = now();

    perform public.sync_endorsement_slip_grade_summary(new.application_id);
    return new;
end;
$$;

drop trigger if exists trg_applications_create_endorsement_slip on public.applications;
create trigger trg_applications_create_endorsement_slip
after insert on public.applications
for each row
execute function public.ensure_endorsement_slip_for_application();

create or replace function public.refresh_endorsement_slip_after_grade_upload()
returns trigger
language plpgsql
as $$
declare
    target_application_id uuid;
begin
    target_application_id := coalesce(new.application_id, old.application_id);

    if target_application_id is not null then
        perform public.sync_endorsement_slip_grade_summary(target_application_id);
    end if;

    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_application_documents_refresh_endorsement_slip on public.application_documents;
create trigger trg_application_documents_refresh_endorsement_slip
after insert or update on public.application_documents
for each row
execute function public.refresh_endorsement_slip_after_grade_upload();
