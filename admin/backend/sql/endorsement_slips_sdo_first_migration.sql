alter table public.endorsement_slips
    alter column current_stage set default 'pending_sdo',
    alter column overall_status set default 'pending_sdo';

alter table public.endorsement_slips
    drop constraint if exists endorsement_slips_current_stage_check,
    add constraint endorsement_slips_current_stage_check
        check (
            current_stage in (
                'pending_sdo',
                'pending_guidance',
                'pending_pd',
                'completed',
                'rejected',
                'held',
                'disqualified_minor',
                'disqualified_major'
            )
        );

alter table public.endorsement_slips
    drop constraint if exists endorsement_slips_overall_status_check,
    add constraint endorsement_slips_overall_status_check
        check (
            overall_status in (
                'pending_sdo',
                'pending_guidance',
                'pending_pd',
                'completed',
                'rejected',
                'held',
                'disqualified_minor',
                'disqualified_major'
            )
        );

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
        'pending_sdo',
        'pending_sdo'
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

update public.endorsement_slips
set current_stage = 'pending_sdo',
    overall_status = 'pending_sdo',
    updated_at = now()
where current_stage = 'pending_pd'
  and overall_status = 'pending_pd'
  and pd_status is null
  and guidance_status is null
  and sdo_status is null;
