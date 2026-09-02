-- SMaRT-PDM: Scholar conversion process flow
-- 1) Explicit Admin activation is the only Applicant -> Scholar conversion.
-- 2) One canonical approval notification is emitted by the application service.
-- 3) Historical partial conversion states are reconciled conservatively.
-- 4) filled_slots uses the same canonical active-scholar definition as runtime.

create or replace function public.notify_application_status_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    if coalesce(current_setting('smart_pdm.scholar_activation', true), '') = '1' then
        return new;
    end if;

    if tg_op = 'UPDATE'
       and coalesce(old.application_status::text, '') is distinct from coalesce(new.application_status::text, '') then
        perform public.notify_student_by_student_id(
            new.student_id,
            'Application',
            'Application status updated',
            'Your scholarship application status changed to ' || coalesce(new.application_status::text, 'Updated') || '.',
            'application',
            new.application_id::text,
            null,
            'applications',
            new.application_id::text || ':' || coalesce(new.application_status::text, 'updated'),
            'application_status_changed',
            jsonb_build_object(
                'old_status', old.application_status,
                'new_status', new.application_status,
                'opening_id', new.opening_id,
                'program_id', new.program_id
            )
        );
    end if;

    return new;
end;
$function$;

create or replace function public.notify_student_scholarship_status_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    if coalesce(current_setting('smart_pdm.scholar_activation', true), '') = '1' then
        return new;
    end if;

    if tg_op = 'UPDATE'
       and coalesce(old.scholarship_status::text, '') is distinct from coalesce(new.scholarship_status::text, '') then
        perform public.notify_student_by_student_id(
            new.student_id,
            'Scholarship',
            'Scholarship status updated',
            'Your scholarship status changed to ' || coalesce(new.scholarship_status::text, 'Updated') || '.',
            'student',
            new.student_id::text,
            null,
            'students',
            new.student_id::text || ':' || coalesce(new.scholarship_status::text, 'updated'),
            'scholar_status_changed',
            jsonb_build_object(
                'old_status', old.scholarship_status,
                'new_status', new.scholarship_status
            )
        );
    end if;

    return new;
end;
$function$;

select set_config('smart_pdm.scholar_activation', '1', true);

-- Student is already active for this exact application:
-- repair the application workflow side to the same converted state.
update public.applications a
set application_status = 'Approved',
    selection_status = 'Selected',
    activation_status = 'Activated',
    selected_at = coalesce(a.selected_at, a.activated_at, now()),
    activated_at = coalesce(a.activated_at, a.finalized_at, a.selected_at, now()),
    finalized_at = coalesce(a.finalized_at, a.activated_at, a.selected_at, now()),
    updated_at = now()
from public.students st
where st.current_application_id = a.application_id
  and st.student_id = a.student_id
  and coalesce(st.is_active_scholar, false) = true
  and lower(coalesce(st.scholarship_status::text, '')) = 'active'
  and (
      lower(coalesce(a.application_status::text, '')) <> 'approved'
      or lower(coalesce(a.selection_status::text, '')) <> 'selected'
      or lower(coalesce(a.activation_status::text, '')) <> 'activated'
  );

-- Application is explicitly Activated:
-- repair only its own linked student. Never replace another current scholarship.
update public.students st
set is_active_scholar = true,
    scholarship_status = 'Active',
    current_program_id = a.program_id,
    current_application_id = a.application_id,
    active_academic_year_id = po.academic_year_id,
    active_period_id = po.period_id,
    date_awarded = coalesce(st.date_awarded, a.activated_at::date, current_date),
    scholar_is_archived = false,
    updated_at = now()
from public.applications a
join public.program_openings po on po.opening_id = a.opening_id
where a.student_id = st.student_id
  and lower(coalesce(a.application_status::text, '')) = 'approved'
  and lower(coalesce(a.activation_status::text, '')) = 'activated'
  and (st.current_application_id is null or st.current_application_id = a.application_id)
  and (
      coalesce(st.is_active_scholar, false) = false
      or lower(coalesce(st.scholarship_status::text, '')) <> 'active'
      or st.current_application_id is distinct from a.application_id
      or st.current_program_id is distinct from a.program_id
      or st.active_academic_year_id is distinct from po.academic_year_id
      or st.active_period_id is distinct from po.period_id
      or coalesce(st.scholar_is_archived, false) = true
  );

with canonical_counts as (
    select
        po.opening_id,
        po.allocated_slots,
        count(st.student_id)::integer as occupied_slots
    from public.program_openings po
    left join public.applications a
      on a.opening_id = po.opening_id
    left join public.students st
      on st.current_application_id = a.application_id
     and st.student_id = a.student_id
     and coalesce(st.is_active_scholar, false) = true
     and lower(coalesce(st.scholarship_status::text, '')) = 'active'
     and coalesce(st.scholar_is_archived, false) = false
    group by po.opening_id, po.allocated_slots
)
update public.program_openings po
set filled_slots = least(cc.allocated_slots, cc.occupied_slots),
    posting_status = case
        when cc.allocated_slots > 0
         and cc.occupied_slots >= cc.allocated_slots
         and lower(coalesce(po.posting_status::text, '')) = 'open'
            then 'closed'
        else po.posting_status
    end,
    updated_at = case
        when po.filled_slots is distinct from least(cc.allocated_slots, cc.occupied_slots)
          or (
              cc.allocated_slots > 0
              and cc.occupied_slots >= cc.allocated_slots
              and lower(coalesce(po.posting_status::text, '')) = 'open'
          )
            then now()
        else po.updated_at
    end
from canonical_counts cc
where cc.opening_id = po.opening_id
  and (
      po.filled_slots is distinct from least(cc.allocated_slots, cc.occupied_slots)
      or (
          cc.allocated_slots > 0
          and cc.occupied_slots >= cc.allocated_slots
          and lower(coalesce(po.posting_status::text, '')) = 'open'
      )
  );
