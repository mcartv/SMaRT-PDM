-- Live function definitions captured read-only from configured smart_pdm_test.
-- Synthetic schema/data only. Run in the disposable test database, never Supabase.
DO $$ BEGIN
    IF current_database() <> 'smart_pdm_notification_policy_test' OR to_regclass('public.notifications') IS NOT NULL THEN
        RAISE EXCEPTION 'Use a fresh disposable smart_pdm_notification_policy_test database';
    END IF;
END $$;
CREATE TYPE public.notification_source_action AS ENUM ('application_submitted', 'application_status_changed', 'endorsement_pd_endorsed', 'endorsement_sdo_cleared', 'endorsement_guidance_completed', 'sdo_offense_status_changed', 'announcement_published', 'scholar_status_changed', 'system_manual');
CREATE TABLE public.general_settings (general_settings_id integer PRIMARY KEY, notifications_enabled boolean);
INSERT INTO public.general_settings VALUES (1, true);
CREATE TABLE public.users (user_id uuid PRIMARY KEY, role text);
CREATE TABLE public.admin_profiles (user_id uuid, department text, position text, is_archived boolean DEFAULT false);
CREATE TABLE public.students (student_id uuid PRIMARY KEY, user_id uuid, first_name text, last_name text,
    is_archived boolean DEFAULT false, scholar_is_archived boolean DEFAULT false,
    account_status text DEFAULT 'verified', is_active_scholar boolean DEFAULT false,
    scholarship_status text, current_program_id uuid);
CREATE TABLE public.scholarship_program (program_id uuid PRIMARY KEY, program_name text, is_archived boolean DEFAULT false);
CREATE TABLE public.announcements (announcement_id uuid PRIMARY KEY, target_audience text, target_program_id uuid,
    subject text, content text, author_id uuid, status text, is_archived boolean DEFAULT false,
    published_at timestamptz, publish_date timestamptz);
CREATE TABLE public.applications (application_id uuid PRIMARY KEY, student_id uuid, opening_id uuid, program_id uuid, application_status text);
CREATE TABLE public.endorsement_slips (slip_id uuid PRIMARY KEY, student_id uuid, application_id uuid,
    current_stage text, overall_status text, pd_status text, guidance_status text, sdo_status text,
    pd_acted_by_user_id uuid, guidance_acted_by_user_id uuid, sdo_acted_by_user_id uuid);
CREATE TABLE public.notifications (notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
    type varchar DEFAULT 'General', title varchar, message text, reference_id text, reference_type varchar,
    actor_user_id uuid, source_table text, source_record_id text, source_action public.notification_source_action DEFAULT 'system_manual',
    metadata jsonb DEFAULT '{}', is_read boolean DEFAULT false, read_at timestamptz,
    push_sent boolean DEFAULT false, email_sent boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.notification_delivery_attempts (user_id uuid, channel text, status text,
    source_action public.notification_source_action, error_message text, metadata jsonb);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);
CREATE UNIQUE INDEX uq_notifications_announcement_recipient ON public.notifications USING btree (user_id, reference_id) WHERE (((reference_type)::text = 'announcement'::text) AND ((type)::text = 'Announcement'::text) AND (reference_id IS NOT NULL));
CREATE INDEX idx_notifications_user_unread_created ON public.notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_reference ON public.notifications USING btree (reference_type, reference_id);
CREATE UNIQUE INDEX uq_notifications_source_idempotency ON public.notifications USING btree (user_id, source_table, source_record_id, source_action) WHERE ((source_table IS NOT NULL) AND (source_record_id IS NOT NULL) AND (source_action IS NOT NULL));

CREATE OR REPLACE FUNCTION public.notification_can_insert(p_user_id uuid, p_source_action notification_source_action, p_limit integer DEFAULT 10, p_window interval DEFAULT '00:01:00'::interval)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
    recent_count integer;
begin
    if p_user_id is null then
        return false;
    end if;

    select count(*)
    into recent_count
    from public.notifications n
    where n.user_id = p_user_id
      and n.source_action = coalesce(p_source_action, 'system_manual'::public.notification_source_action)
      and n.created_at >= now() - p_window;

    return recent_count < greatest(coalesce(p_limit, 10), 1);
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_staff_role(p_user_role text, p_department text, p_position text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
    select case
        when lower(coalesce(p_user_role, '')) = 'pd'
          or lower(coalesce(p_department, '')) like '%program department%'
          or lower(coalesce(p_department, '')) = 'pd'
          or lower(coalesce(p_position, '')) like '%program director%'
          or lower(coalesce(p_position, '')) like '%program chair%'
          or lower(coalesce(p_position, '')) like '%department chair%'
          or lower(coalesce(p_position, '')) like '%pd reviewer%'
            then 'pd'
        when lower(coalesce(p_user_role, '')) in ('guidance', 'gco')
          or lower(coalesce(p_department, '')) like '%guidance%'
          or lower(coalesce(p_position, '')) like '%guidance%'
            then 'guidance'
        when lower(coalesce(p_user_role, '')) = 'sdo'
          or lower(coalesce(p_department, '')) like '%disciplinary%'
          or lower(coalesce(p_department, '')) like '%student discipline%'
          or lower(coalesce(p_department, '')) = 'sdo'
          or lower(coalesce(p_position, '')) like '%disciplinary%'
          or lower(coalesce(p_position, '')) like '%student discipline%'
          or lower(coalesce(p_position, '')) like '%sdo%'
            then 'sdo'
        when lower(coalesce(p_user_role, '')) = 'admin'
            then 'admin'
        else lower(coalesce(p_user_role, ''))
    end;
$function$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_reference_type text DEFAULT NULL::text, p_reference_id text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid, p_source_table text DEFAULT NULL::text, p_source_record_id text DEFAULT NULL::text, p_source_action notification_source_action DEFAULT 'system_manual'::notification_source_action, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    inserted_notification_id uuid;
    normalized_action public.notification_source_action;
begin
    normalized_action := coalesce(p_source_action, 'system_manual'::public.notification_source_action);

    if p_user_id is null
       or nullif(trim(coalesce(p_title, '')), '') is null
       or p_message is null then
        return null;
    end if;

    if not public.notification_can_insert(p_user_id, normalized_action, 10, interval '1 minute') then
        insert into public.notification_delivery_attempts (
            user_id,
            channel,
            status,
            source_action,
            error_message,
            metadata
        )
        values (
            p_user_id,
            'database',
            'skipped',
            normalized_action,
            'Notification flood guard skipped insert.',
            jsonb_build_object(
                'source_table', p_source_table,
                'source_record_id', p_source_record_id
            )
        );
        return null;
    end if;

    insert into public.notifications (
        user_id,
        type,
        title,
        message,
        reference_type,
        reference_id,
        actor_user_id,
        source_table,
        source_record_id,
        source_action,
        metadata,
        is_read,
        push_sent,
        email_sent,
        created_at
    )
    values (
        p_user_id,
        coalesce(nullif(trim(p_type), ''), 'General'),
        trim(p_title),
        p_message,
        nullif(trim(coalesce(p_reference_type, '')), ''),
        nullif(trim(coalesce(p_reference_id, '')), ''),
        p_actor_user_id,
        nullif(trim(coalesce(p_source_table, '')), ''),
        nullif(trim(coalesce(p_source_record_id, '')), ''),
        normalized_action,
        coalesce(p_metadata, '{}'::jsonb),
        false,
        false,
        false,
        now()
    )
    on conflict (user_id, source_table, source_record_id, source_action)
        where source_table is not null
          and source_record_id is not null
          and source_action is not null
    do nothing
    returning notification_id into inserted_notification_id;

    return inserted_notification_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_announcement_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    normalized_audience text;
    title_text text;
    message_text text;
    legacy_program_id uuid;
begin
    normalized_audience := lower(trim(coalesce(new.target_audience, 'all')));
    title_text := coalesce(nullif(trim(new.subject), ''), 'New announcement');
    message_text := coalesce(
        nullif(trim(new.content), ''),
        'A new announcement has been published.'
    );

    -- Current announcement statuses are stored as values such as "Published".
    -- Normalize before comparison so notification fanout is not skipped.
    if lower(trim(coalesce(new.status, ''))) <> 'published'
       or coalesce(new.is_archived, false) = true then
        delete from public.notifications n
        where n.reference_id = new.announcement_id::text
          and lower(coalesce(n.reference_type, '')) = 'announcement'
          and lower(coalesce(n.type, '')) = 'announcement';

        return new;
    end if;

    if normalized_audience in ('tes', 'tdp') then
        select sp.program_id
        into legacy_program_id
        from public.scholarship_program sp
        where coalesce(sp.is_archived, false) = false
          and (
              (
                  normalized_audience = 'tes'
                  and lower(sp.program_name)
                      like '%tertiary education subsidy%'
              )
              or (
                  normalized_audience = 'tes'
                  and lower(sp.program_name)
                      ~ '(^|[^a-z0-9])tes([^a-z0-9]|$)'
              )
              or (
                  normalized_audience = 'tdp'
                  and lower(sp.program_name) like '%tulong dunong%'
              )
              or (
                  normalized_audience = 'tdp'
                  and lower(sp.program_name)
                      ~ '(^|[^a-z0-9])tdp([^a-z0-9]|$)'
              )
          )
        order by sp.program_name
        limit 1;
    end if;

    -- Remove rows that no longer belong to the current audience.
    delete from public.notifications n
    where n.reference_id = new.announcement_id::text
      and lower(coalesce(n.reference_type, '')) = 'announcement'
      and lower(coalesce(n.type, '')) = 'announcement'
      and not exists (
          select 1
          from public.students s
          where s.user_id = n.user_id
            and s.user_id is not null
            and coalesce(s.is_archived, false) = false
            and coalesce(s.scholar_is_archived, false) = false
            and lower(coalesce(s.account_status, 'verified')) <> 'disabled'
            and (
                normalized_audience = 'all'
                or (
                    normalized_audience = 'applicants'
                    and not (
                        coalesce(s.is_active_scholar, false) = true
                        or lower(coalesce(s.scholarship_status, '')) = 'active'
                    )
                )
                or (
                    normalized_audience = 'scholars'
                    and (
                        coalesce(s.is_active_scholar, false) = true
                        or lower(coalesce(s.scholarship_status, '')) = 'active'
                    )
                )
                or (
                    normalized_audience = 'program'
                    and (
                        coalesce(s.is_active_scholar, false) = true
                        or lower(coalesce(s.scholarship_status, '')) = 'active'
                    )
                    and new.target_program_id is not null
                    and s.current_program_id = new.target_program_id
                )
                or (
                    normalized_audience in ('tes', 'tdp')
                    and (
                        coalesce(s.is_active_scholar, false) = true
                        or lower(coalesce(s.scholarship_status, '')) = 'active'
                    )
                    and legacy_program_id is not null
                    and s.current_program_id = legacy_program_id
                )
            )
      );

    -- Keep existing cards synchronized without making edits unread again.
    update public.notifications n
    set title = title_text,
        message = message_text,
        actor_user_id = new.author_id,
        source_table = 'announcements',
        source_record_id = new.announcement_id::text,
        source_action =
            'announcement_published'::public.notification_source_action,
        metadata = jsonb_build_object(
            'audience', normalized_audience,
            'target_program_id', new.target_program_id
        )
    where n.reference_id = new.announcement_id::text
      and lower(coalesce(n.reference_type, '')) = 'announcement'
      and lower(coalesce(n.type, '')) = 'announcement';

    -- Set-based fanout: one database operation for the audience.
    insert into public.notifications (
        user_id,
        type,
        title,
        message,
        reference_type,
        reference_id,
        actor_user_id,
        source_table,
        source_record_id,
        source_action,
        metadata,
        is_read,
        push_sent,
        email_sent,
        created_at
    )
    select
        s.user_id,
        'Announcement',
        title_text,
        message_text,
        'announcement',
        new.announcement_id::text,
        new.author_id,
        'announcements',
        new.announcement_id::text,
        'announcement_published'::public.notification_source_action,
        jsonb_build_object(
            'audience', normalized_audience,
            'target_program_id', new.target_program_id
        ),
        false,
        false,
        false,
        coalesce(new.published_at, new.publish_date, now())
    from public.students s
    where s.user_id is not null
      and coalesce(s.is_archived, false) = false
      and coalesce(s.scholar_is_archived, false) = false
      and lower(coalesce(s.account_status, 'verified')) <> 'disabled'
      and (
          normalized_audience = 'all'
          or (
              normalized_audience = 'applicants'
              and not (
                  coalesce(s.is_active_scholar, false) = true
                  or lower(coalesce(s.scholarship_status, '')) = 'active'
              )
          )
          or (
              normalized_audience = 'scholars'
              and (
                  coalesce(s.is_active_scholar, false) = true
                  or lower(coalesce(s.scholarship_status, '')) = 'active'
              )
          )
          or (
              normalized_audience = 'program'
              and (
                  coalesce(s.is_active_scholar, false) = true
                  or lower(coalesce(s.scholarship_status, '')) = 'active'
              )
              and new.target_program_id is not null
              and s.current_program_id = new.target_program_id
          )
          or (
              normalized_audience in ('tes', 'tdp')
              and (
                  coalesce(s.is_active_scholar, false) = true
                  or lower(coalesce(s.scholarship_status, '')) = 'active'
              )
              and legacy_program_id is not null
              and s.current_program_id = legacy_program_id
          )
      )
      and not exists (
          select 1
          from public.notifications existing
          where existing.user_id = s.user_id
            and existing.reference_id = new.announcement_id::text
            and lower(coalesce(existing.reference_type, '')) = 'announcement'
            and lower(coalesce(existing.type, '')) = 'announcement'
      )
    on conflict do nothing;

    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_application_status_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.notify_application_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    perform public.notify_users_by_staff_role(
        'pd',
        'Application',
        'New scholarship application',
        'A new scholarship application has been submitted for review.',
        'application',
        new.application_id::text,
        null,
        'applications',
        new.application_id::text,
        'application_submitted',
        jsonb_build_object(
            'student_id', new.student_id,
            'opening_id', new.opening_id,
            'program_id', new.program_id
        )
    );

    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_endorsement_slip_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    student_name text;
begin
    if tg_op <> 'UPDATE' then
        return new;
    end if;

    if coalesce(old.current_stage::text, '') = coalesce(new.current_stage::text, '')
       and coalesce(old.overall_status::text, '') = coalesce(new.overall_status::text, '')
       and coalesce(old.pd_status::text, '') = coalesce(new.pd_status::text, '')
       and coalesce(old.guidance_status::text, '') = coalesce(new.guidance_status::text, '')
       and coalesce(old.sdo_status::text, '') = coalesce(new.sdo_status::text, '') then
        return new;
    end if;

    select nullif(trim(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''))), '')
    into student_name
    from public.students s
    where s.student_id = new.student_id
    limit 1;

    student_name := coalesce(student_name, 'A student');

    if old.current_stage is distinct from new.current_stage
       and new.current_stage = 'pending_sdo' then
        perform public.notify_users_by_staff_role(
            'sdo',
            'Endorsement',
            'SDO clearance pending',
            student_name || ' is ready for SDO review.',
            'endorsement_slip',
            new.slip_id::text,
            new.pd_acted_by_user_id,
            'endorsement_slips',
            new.slip_id::text || ':pending_sdo',
            'endorsement_pd_endorsed',
            jsonb_build_object('application_id', new.application_id, 'student_id', new.student_id)
        );
    end if;

    if old.current_stage is distinct from new.current_stage
       and new.current_stage = 'pending_guidance' then
        perform public.notify_users_by_staff_role(
            'guidance',
            'Endorsement',
            'Guidance clearance pending',
            student_name || ' is ready for Guidance review.',
            'endorsement_slip',
            new.slip_id::text,
            new.sdo_acted_by_user_id,
            'endorsement_slips',
            new.slip_id::text || ':pending_guidance',
            'endorsement_sdo_cleared',
            jsonb_build_object('application_id', new.application_id, 'student_id', new.student_id)
        );
    end if;

    if old.current_stage is distinct from new.current_stage
       and new.current_stage = 'pending_pd' then
        perform public.notify_users_by_staff_role(
            'pd',
            'Endorsement',
            'PD approval pending',
            student_name || ' is ready for PD review.',
            'endorsement_slip',
            new.slip_id::text,
            new.guidance_acted_by_user_id,
            'endorsement_slips',
            new.slip_id::text || ':pending_pd',
            'endorsement_guidance_completed',
            jsonb_build_object('application_id', new.application_id, 'student_id', new.student_id)
        );
    end if;

    if old.pd_status is distinct from new.pd_status
       and new.pd_status = 'approved' then
        perform public.notify_users_by_staff_role(
            'sdo',
            'Endorsement',
            'PD endorsement completed',
            student_name || ' has been endorsed by the Program Director.',
            'endorsement_slip',
            new.slip_id::text,
            new.pd_acted_by_user_id,
            'endorsement_slips',
            new.slip_id::text || ':pd_approved:sdo',
            'endorsement_pd_endorsed',
            jsonb_build_object('application_id', new.application_id, 'student_id', new.student_id)
        );

        perform public.notify_users_by_staff_role(
            'guidance',
            'Endorsement',
            'PD endorsement completed',
            student_name || ' has been endorsed by the Program Director.',
            'endorsement_slip',
            new.slip_id::text,
            new.pd_acted_by_user_id,
            'endorsement_slips',
            new.slip_id::text || ':pd_approved:guidance',
            'endorsement_pd_endorsed',
            jsonb_build_object('application_id', new.application_id, 'student_id', new.student_id)
        );
    end if;

    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_student_by_student_id(p_student_id uuid, p_type text, p_title text, p_message text, p_reference_type text DEFAULT NULL::text, p_reference_id text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid, p_source_table text DEFAULT NULL::text, p_source_record_id text DEFAULT NULL::text, p_source_action notification_source_action DEFAULT 'system_manual'::notification_source_action, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    target_user_id uuid;
begin
    select s.user_id
    into target_user_id
    from public.students s
    where s.student_id = p_student_id
    limit 1;

    if target_user_id is null then
        return null;
    end if;

    return public.create_notification(
        target_user_id,
        p_type,
        p_title,
        p_message,
        p_reference_type,
        p_reference_id,
        p_actor_user_id,
        p_source_table,
        p_source_record_id,
        p_source_action,
        p_metadata
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_student_scholarship_status_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.notify_users_by_staff_role(p_role text, p_type text, p_title text, p_message text, p_reference_type text DEFAULT NULL::text, p_reference_id text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid, p_source_table text DEFAULT NULL::text, p_source_record_id text DEFAULT NULL::text, p_source_action notification_source_action DEFAULT 'system_manual'::notification_source_action, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    target record;
    inserted_id uuid;
    inserted_count integer := 0;
    normalized_role text := lower(trim(coalesce(p_role, '')));
begin
    if normalized_role = 'gco' then
        normalized_role := 'guidance';
    end if;

    for target in
        select distinct u.user_id
        from public.users u
        left join public.admin_profiles ap on ap.user_id = u.user_id
        where coalesce(ap.is_archived, false) = false
          and public.resolve_staff_role(u.role, ap.department, ap.position) = normalized_role
    loop
        inserted_id := public.create_notification(
            target.user_id,
            p_type,
            p_title,
            p_message,
            p_reference_type,
            p_reference_id,
            p_actor_user_id,
            p_source_table,
            p_source_record_id,
            p_source_action,
            p_metadata
        );

        if inserted_id is not null then
            inserted_count := inserted_count + 1;
        end if;
    end loop;

    return inserted_count;
end;
$function$;

CREATE TRIGGER trg_notifications_announcement_published AFTER INSERT OR UPDATE OF status, is_archived, target_audience, target_program_id, subject, content ON public.announcements FOR EACH ROW EXECUTE FUNCTION notify_announcement_published();
CREATE TRIGGER trg_notifications_application_status_changed AFTER UPDATE OF application_status ON public.applications FOR EACH ROW EXECUTE FUNCTION notify_application_status_changed();
CREATE TRIGGER trg_notifications_application_submitted AFTER INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION notify_application_submitted();
CREATE TRIGGER trg_notifications_endorsement_slip_changed AFTER UPDATE OF current_stage, overall_status, pd_status, guidance_status, sdo_status ON public.endorsement_slips FOR EACH ROW EXECUTE FUNCTION notify_endorsement_slip_changed();
CREATE TRIGGER trg_notifications_scholarship_status_changed AFTER UPDATE OF scholarship_status ON public.students FOR EACH ROW EXECUTE FUNCTION notify_student_scholarship_status_changed();
