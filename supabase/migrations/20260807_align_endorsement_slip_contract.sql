-- Align endorsement_slips with the official PDM-OSFA paper endorsement slip.
-- This migration is intentionally backward compatible. Historical legacy
-- values remain accepted so existing endorsement records are not invalidated.

alter table public.endorsement_slips
    drop constraint if exists endorsement_slips_sdo_status_check,
    add constraint endorsement_slips_sdo_status_check
        check (
            sdo_status is null
            or sdo_status in (
                'no_offense',
                'minor_offense',
                'major_offense',
                -- Legacy historical values retained during phased rollout.
                'cleared',
                'disqualified_minor',
                'disqualified_major'
            )
        ),
    drop constraint if exists endorsement_slips_guidance_status_check,
    add constraint endorsement_slips_guidance_status_check
        check (
            guidance_status is null
            or guidance_status in (
                'good_moral_standing',
                -- Legacy historical values retained during phased rollout.
                'cleared',
                'held',
                'rejected'
            )
        ),
    drop constraint if exists endorsement_slips_pd_status_check,
    add constraint endorsement_slips_pd_status_check
        check (
            pd_status is null
            or pd_status in (
                'good_scholastic_standing',
                'average_scholastic_standing',
                -- Legacy historical values retained during phased rollout.
                'approved',
                'rejected'
            )
        );

comment on column public.endorsement_slips.sdo_offense_type is
    'Deprecated for endorsement actions. Detailed offense data belongs to the SDO disciplinary-record module; retained temporarily for historical compatibility.';
comment on column public.endorsement_slips.sdo_incident_date is
    'Deprecated for endorsement actions; retained temporarily for historical compatibility.';
comment on column public.endorsement_slips.sdo_case_reference_number is
    'Deprecated for endorsement actions; retained temporarily for historical compatibility.';
