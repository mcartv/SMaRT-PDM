-- Snapshot of current smart_pdm_test definitions inspected via pg_get_functiondef.
-- Change only new creation; preserve signatures, privileges, flood guard,
-- source metadata, idempotency and existing announcement synchronization.
BEGIN;

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
    -- Pause creation only; helpers inherit this before flood-guard work.
    IF COALESCE((SELECT notifications_enabled FROM public.general_settings WHERE general_settings_id = 1), TRUE) = FALSE THEN
        RETURN NULL;
    END IF;

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

    -- Existing-card UPDATE/DELETE above must continue while creation is OFF.
    IF COALESCE((SELECT notifications_enabled FROM public.general_settings WHERE general_settings_id = 1), TRUE) THEN
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
    END IF;

    return new;
end;
$function$;

-- Last line of defense for direct Node INSERTs, RO timeout RPCs and future
-- notification writers. This never fires for UPDATE or DELETE.
CREATE OR REPLACE FUNCTION public.guard_notification_creation_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF COALESCE((SELECT notifications_enabled FROM public.general_settings WHERE general_settings_id = 1), TRUE) = FALSE THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_notification_creation_policy() FROM PUBLIC;

-- Install once, without changing any existing triggers.
DO $install$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.notifications'::regclass
          AND tgname = 'trg_notifications_creation_policy'
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER trg_notifications_creation_policy
        BEFORE INSERT ON public.notifications
        FOR EACH ROW EXECUTE FUNCTION public.guard_notification_creation_policy();
    END IF;
END;
$install$;

COMMIT;
