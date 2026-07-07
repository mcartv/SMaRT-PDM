alter table public.endorsement_slips
    add column if not exists sdo_offense_type text null,
    add column if not exists sdo_incident_date date null,
    add column if not exists sdo_case_reference_number text null;

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
                'guidance_rejected',
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
                'guidance_rejected',
                'held',
                'disqualified_minor',
                'disqualified_major'
            )
        );

alter table public.endorsement_slips
    drop constraint if exists endorsement_slips_guidance_status_check,
    add constraint endorsement_slips_guidance_status_check
        check (guidance_status is null or guidance_status in ('cleared', 'held', 'rejected'));
