-- Grade OCR is Admin evidence, not a Program Director prerequisite.
-- Keep informational summaries and historical JSON intact.
drop trigger if exists trg_enforce_pd_grade_validation
on public.endorsement_slips;

comment on function public.get_endorsement_grade_validation(uuid) is
    'Informational Grade OCR summary. It must not block Program Director endorsement.';

comment on function public.sync_endorsement_slip_grade_summary(uuid) is
    'Synchronizes informational Grade OCR evidence without changing endorsement decisions.';
