-- Run with psql -v ON_ERROR_STOP=1 against a FRESH disposable database named
-- smart_pdm_notification_policy_test. The fixture refuses existing databases.
\set ON_ERROR_STOP on
\ir fixtures/notification_policy_baseline.sql

CREATE TEMP TABLE original_notification_functions AS
SELECT p.proname, p.prosecdef, p.proconfig, p.proacl, p.prorettype,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('create_notification', 'notify_announcement_published');
CREATE TEMP TABLE original_notification_triggers AS
SELECT tgname, pg_get_triggerdef(oid) AS definition FROM pg_trigger
WHERE tgname LIKE 'trg_notifications_%';

\ir ../migrations/20261004171730_enforce_global_notification_creation_policy.sql
-- Reapplying must not create another guard or duplicate the original triggers.
\ir ../migrations/20261004171730_enforce_global_notification_creation_policy.sql

BEGIN;
CREATE TEMP TABLE policy_assertions (label text);
CREATE FUNCTION pg_temp.check_policy(condition boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
    INSERT INTO policy_assertions VALUES (label);
END;
$$;

INSERT INTO public.users VALUES
('00000000-0000-0000-0000-000000000001', 'student'),
('00000000-0000-0000-0000-000000000002', 'applicant'),
('00000000-0000-0000-0000-000000000003', 'applicant'),
('00000000-0000-0000-0000-000000000004', 'pd'),
('00000000-0000-0000-0000-000000000005', 'student'),
('00000000-0000-0000-0000-000000000006', 'sdo'),
('00000000-0000-0000-0000-000000000007', 'guidance');
INSERT INTO public.admin_profiles (user_id, department) VALUES
('00000000-0000-0000-0000-000000000004', 'pd'),
('00000000-0000-0000-0000-000000000006', 'sdo'),
('00000000-0000-0000-0000-000000000007', 'guidance');
UPDATE public.general_settings SET notifications_enabled = false;
INSERT INTO public.students (student_id, user_id, scholarship_status, is_active_scholar, is_archived) VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Active', true, false),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Applicant', false, false),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Applicant', false, true);

DO $$
DECLARE id uuid; count_before integer;
BEGIN
    PERFORM pg_temp.check_policy(NOT EXISTS (
        SELECT 1 FROM original_notification_functions o
        JOIN pg_proc p ON p.proname = o.proname
        JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
        WHERE p.prosecdef IS DISTINCT FROM o.prosecdef OR p.proconfig IS DISTINCT FROM o.proconfig
           OR p.proacl IS DISTINCT FROM o.proacl OR p.prorettype <> o.prorettype
           OR pg_get_function_identity_arguments(p.oid) <> o.args
    ), 'existing function signatures, return types, SECURITY DEFINER, search_path and ACL preserved');
    PERFORM pg_temp.check_policy(NOT EXISTS (
        SELECT 1 FROM original_notification_triggers o
        LEFT JOIN pg_trigger t ON t.tgname = o.tgname
        WHERE t.oid IS NULL OR pg_get_triggerdef(t.oid) <> o.definition
    ), 'all existing notification trigger names and definitions preserved');
    PERFORM pg_temp.check_policy((SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_notifications_creation_policy') = 1,
        'migration can be reapplied without duplicate guards');

    id := public.create_notification('00000000-0000-0000-0000-000000000001', 'Test', 'OFF', 'Blocked');
    PERFORM pg_temp.check_policy(id IS NULL AND NOT EXISTS (SELECT 1 FROM public.notifications), 'OFF shared helper returns NULL and inserts nothing');
    PERFORM pg_temp.check_policy(NOT EXISTS (SELECT 1 FROM public.notification_delivery_attempts), 'OFF does not produce flood-guard log rows');
    id := public.notify_student_by_student_id('10000000-0000-0000-0000-000000000001', 'Test', 'OFF', 'Blocked');
    PERFORM pg_temp.check_policy(id IS NULL, 'OFF student helper inherits shared guard');
    PERFORM pg_temp.check_policy(public.notify_users_by_staff_role('pd', 'Test', 'OFF', 'Blocked') = 0, 'OFF staff-role helper reports zero inserts');
    INSERT INTO public.notifications (user_id, title, message) VALUES ('00000000-0000-0000-0000-000000000001', 'Direct', 'Blocked');
    PERFORM pg_temp.check_policy(NOT EXISTS (SELECT 1 FROM public.notifications), 'OFF direct INSERT cannot bypass policy');
    INSERT INTO public.applications VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', null, null, 'Submitted');
    UPDATE public.applications SET application_status = 'Approved';
    INSERT INTO public.endorsement_slips (slip_id, student_id, current_stage) VALUES
        ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'pending_pd');
    UPDATE public.endorsement_slips SET current_stage = 'pending_sdo';
    UPDATE public.students SET scholarship_status = 'Removed' WHERE student_id = '10000000-0000-0000-0000-000000000001';
    PERFORM pg_temp.check_policy(NOT EXISTS (SELECT 1 FROM public.notifications), 'OFF application, endorsement and scholarship triggers insert nothing');

    UPDATE public.general_settings SET notifications_enabled = true;
    id := public.create_notification('00000000-0000-0000-0000-000000000001', 'Test', 'ON', 'Created',
        'test', 'test-ref', null, 'policy_test', 'once', 'system_manual', '{"preserved":true}');
    PERFORM pg_temp.check_policy(id IS NOT NULL, 'ON shared helper resumes creation');
    PERFORM pg_temp.check_policy((SELECT metadata = '{"preserved":true}'::jsonb AND reference_id = 'test-ref' FROM public.notifications WHERE notification_id = id), 'helper metadata and references preserved');
    PERFORM pg_temp.check_policy(public.create_notification('00000000-0000-0000-0000-000000000001', 'Test', 'ON', 'Duplicate',
        'test', 'test-ref', null, 'policy_test', 'once', 'system_manual') IS NULL, 'helper source idempotency preserved');
    UPDATE public.notifications SET is_read = true, read_at = '2026-10-01T00:00:00Z', push_sent = true WHERE notification_id = id;
    UPDATE public.general_settings SET notifications_enabled = false;
    UPDATE public.notifications SET title = 'Edited while OFF' WHERE notification_id = id;
    PERFORM pg_temp.check_policy((SELECT title = 'Edited while OFF' AND is_read AND read_at = '2026-10-01T00:00:00Z' AND push_sent FROM public.notifications WHERE notification_id = id), 'OFF text updates preserve read and delivery state');
    UPDATE public.notifications SET is_read = false, read_at = null WHERE notification_id = id;
    PERFORM pg_temp.check_policy((SELECT NOT is_read AND read_at IS NULL FROM public.notifications WHERE notification_id = id), 'OFF allows mark unread');
    UPDATE public.notifications SET is_read = true WHERE notification_id = id;
    PERFORM pg_temp.check_policy((SELECT is_read FROM public.notifications WHERE notification_id = id), 'OFF allows mark read');
    DELETE FROM public.notifications WHERE notification_id = id;
    PERFORM pg_temp.check_policy(NOT EXISTS (SELECT 1 FROM public.notifications WHERE notification_id = id), 'OFF allows existing notification deletion');

    UPDATE public.general_settings SET notifications_enabled = true;
    PERFORM pg_temp.check_policy(public.notify_student_by_student_id('10000000-0000-0000-0000-000000000001', 'Test', 'ON', 'Created') IS NOT NULL, 'ON student helper resumes');
    PERFORM pg_temp.check_policy(public.notify_users_by_staff_role('pd', 'Test', 'ON', 'Created') = 1, 'ON staff-role helper resumes');
    SELECT count(*) INTO count_before FROM public.notifications;
    INSERT INTO public.applications VALUES ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', null, null, 'Submitted');
    UPDATE public.applications SET application_status = 'Approved' WHERE application_id = '20000000-0000-0000-0000-000000000002';
    UPDATE public.endorsement_slips SET current_stage = 'pending_guidance';
    UPDATE public.students SET scholarship_status = 'Active' WHERE student_id = '10000000-0000-0000-0000-000000000001';
    PERFORM pg_temp.check_policy((SELECT count(*) FROM public.notifications) > count_before, 'ON original database notification triggers resume');
    PERFORM pg_temp.check_policy(EXISTS (SELECT 1 FROM public.notifications WHERE source_action = 'application_submitted'), 'ON application submission trigger resumes');
    PERFORM pg_temp.check_policy(EXISTS (SELECT 1 FROM public.notifications WHERE source_action = 'application_status_changed'), 'ON application status trigger resumes');
    PERFORM pg_temp.check_policy(EXISTS (SELECT 1 FROM public.notifications WHERE source_action = 'endorsement_sdo_cleared'), 'ON endorsement handoff trigger resumes');
    PERFORM pg_temp.check_policy(EXISTS (SELECT 1 FROM public.notifications WHERE source_action = 'scholar_status_changed'), 'ON scholarship status trigger resumes');
    FOR i IN 1..11 LOOP
        PERFORM public.create_notification('00000000-0000-0000-0000-000000000005', 'Test', 'Flood', 'Limit');
    END LOOP;
    PERFORM pg_temp.check_policy((SELECT count(*) FROM public.notifications WHERE user_id = '00000000-0000-0000-0000-000000000005') = 10
        AND (SELECT count(*) FROM public.notification_delivery_attempts) = 1, 'ON original flood limit and skipped-attempt logging preserved');

    INSERT INTO public.announcements (announcement_id, target_audience, subject, content, status) VALUES
        ('40000000-0000-0000-0000-000000000001', 'all', 'First title', 'First body', 'Published');
    PERFORM pg_temp.check_policy((SELECT count(*) FROM public.notifications WHERE reference_id = '40000000-0000-0000-0000-000000000001') = 2, 'ON announcement fanout respects eligible audience');
    UPDATE public.notifications SET is_read = true, read_at = '2026-10-01T00:00:00Z', push_sent = true
        WHERE reference_id = '40000000-0000-0000-0000-000000000001' AND user_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.general_settings SET notifications_enabled = false;
    UPDATE public.students SET is_archived = false WHERE student_id = '10000000-0000-0000-0000-000000000003';
    UPDATE public.announcements SET subject = 'Edited title', content = 'Edited body' WHERE announcement_id = '40000000-0000-0000-0000-000000000001';
    PERFORM pg_temp.check_policy((SELECT count(*) FROM public.notifications WHERE reference_id = '40000000-0000-0000-0000-000000000001') = 2, 'OFF announcement edit does not add new recipients');
    PERFORM pg_temp.check_policy((SELECT bool_and(title = 'Edited title' AND message = 'Edited body') FROM public.notifications WHERE reference_id = '40000000-0000-0000-0000-000000000001'), 'OFF announcement edit updates existing cards');
    PERFORM pg_temp.check_policy((SELECT is_read AND read_at = '2026-10-01T00:00:00Z' AND push_sent FROM public.notifications
        WHERE reference_id = '40000000-0000-0000-0000-000000000001' AND user_id = '00000000-0000-0000-0000-000000000001'), 'OFF announcement edit never resets read state');
    UPDATE public.announcements SET target_audience = 'scholars' WHERE announcement_id = '40000000-0000-0000-0000-000000000001';
    PERFORM pg_temp.check_policy((SELECT count(*) FROM public.notifications WHERE reference_id = '40000000-0000-0000-0000-000000000001') = 1, 'OFF announcement audience change removes stale recipients');
    UPDATE public.announcements SET target_audience = 'all' WHERE announcement_id = '40000000-0000-0000-0000-000000000001';
    PERFORM pg_temp.check_policy((SELECT count(*) FROM public.notifications WHERE reference_id = '40000000-0000-0000-0000-000000000001') = 1, 'OFF audience expansion cannot create cards');
    INSERT INTO public.announcements (announcement_id, target_audience, subject, content, status) VALUES
        ('40000000-0000-0000-0000-000000000002', 'all', 'Scheduled', 'Due', 'Scheduled');
    UPDATE public.announcements SET status = 'Published' WHERE announcement_id = '40000000-0000-0000-0000-000000000002';
    PERFORM pg_temp.check_policy((SELECT status = 'Published' FROM public.announcements WHERE announcement_id = '40000000-0000-0000-0000-000000000002')
        AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE reference_id = '40000000-0000-0000-0000-000000000002'), 'OFF scheduled announcement still publishes without notification fanout');
    UPDATE public.announcements SET is_archived = true WHERE announcement_id = '40000000-0000-0000-0000-000000000001';
    PERFORM pg_temp.check_policy(NOT EXISTS (SELECT 1 FROM public.notifications WHERE reference_id = '40000000-0000-0000-0000-000000000001'), 'OFF archiving still cleans up existing cards');
    UPDATE public.general_settings SET notifications_enabled = true;
    UPDATE public.announcements SET content = 'New body' WHERE announcement_id = '40000000-0000-0000-0000-000000000002';
    UPDATE public.announcements SET subject = 'Edited twice' WHERE announcement_id = '40000000-0000-0000-0000-000000000002';
    PERFORM pg_temp.check_policy((SELECT count(*) FROM public.notifications WHERE reference_id = '40000000-0000-0000-0000-000000000002') = 3, 'ON fanout resumes with no duplicate recipient cards');
    PERFORM pg_temp.check_policy((SELECT bool_and(metadata->>'audience' = 'all' AND source_action = 'announcement_published') FROM public.notifications WHERE reference_id = '40000000-0000-0000-0000-000000000002'), 'ON fanout source action and metadata preserved');
    DELETE FROM public.general_settings;
    PERFORM pg_temp.check_policy(public.create_notification('00000000-0000-0000-0000-000000000003', 'Test', 'Missing setting', 'Default ON') IS NOT NULL, 'missing settings row preserves default ON');
    INSERT INTO public.general_settings VALUES (1, null);
    PERFORM pg_temp.check_policy(public.create_notification('00000000-0000-0000-0000-000000000003', 'Test', 'Null setting', 'Default ON') IS NOT NULL, 'NULL setting preserves default ON');
END;
$$;

SELECT 'PASS: ' || count(*) || ' database policy assertions' AS result FROM policy_assertions;
ROLLBACK;
