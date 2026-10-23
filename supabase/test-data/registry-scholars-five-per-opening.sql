-- MANUAL ONLY. Run in the Supabase SQL Editor for the intended development database.
-- Five NEW scholars per non-archived opening across ALL periods (closed included).
-- Opening archive status is the cutoff; parent program/year flags are not changed.
-- Uses actual imported registry identities; never creates registry records or login users.
-- Internal seed provenance makes this repeat-safe without changing displayed student names.
-- Application/endorsement states are seeded; no uploaded documents, grades, reviewer IDs,
-- payout releases, or completed Community Service are invented.
-- Do not use the notification helper (its delivery-attempt table may be absent).
-- Only the listed notification/FCFS triggers are paused, transactionally, while
-- table write locks prevent other sessions from missing their normal triggers.
-- Every original trigger state is restored before COMMIT; errors roll it back.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $prepare$
DECLARE target record; state record;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('registry-scholars-five-per-opening-v1'));
    -- Abort instead of waiting behind live writes. Normal SELECTs remain possible.
    LOCK TABLE public.students, public.applications, public.endorsement_slips,
        public.program_openings, public.student_master_records
        IN SHARE ROW EXCLUSIVE MODE NOWAIT;

    CREATE TEMP TABLE registry_seed_preserved (
        table_name text, row_key text, document jsonb, PRIMARY KEY(table_name,row_key)
    ) ON COMMIT DROP;
    FOR target IN SELECT * FROM (VALUES
        ('students','student_id'), ('student_master_records','master_student_id'),
        ('applications','application_id'), ('endorsement_slips','slip_id'),
        ('notifications','notification_id'), ('general_settings','general_settings_id')
    ) AS tables_to_preserve(table_name,key_column) LOOP
        IF to_regclass('public.' || target.table_name) IS NOT NULL THEN
            EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE NOWAIT',target.table_name);
            EXECUTE format('INSERT INTO registry_seed_preserved SELECT %L,%I::text,to_jsonb(t) FROM public.%I t',
                target.table_name,target.key_column,target.table_name);
        END IF;
    END LOOP;
    CREATE TEMP TABLE registry_seed_opening_before ON COMMIT DROP AS
    SELECT o.opening_id,to_jsonb(o) AS document,
        NOT o.is_archived AND NOT EXISTS (
            SELECT 1 FROM public.applications a WHERE a.opening_id=o.opening_id
              AND a.application_payload->>'seed_batch'='registry-scholars-five-per-opening-v1'
        ) AS may_update_counter
    FROM public.program_openings o;

    CREATE TEMP TABLE registry_seed_trigger_states ON COMMIT DROP AS
    SELECT tgrelid, tgname, tgenabled FROM pg_trigger WHERE NOT tgisinternal AND (
        (tgrelid='public.applications'::regclass AND tgname IN (
            'trg_notifications_application_submitted','trg_notifications_application_status_changed','trg_applications_fcfs'))
        OR (tgrelid='public.endorsement_slips'::regclass AND tgname IN (
            'trg_notifications_endorsement_slip_changed','trg_endorsement_slips_fcfs'))
        OR (tgrelid='public.program_openings'::regclass AND tgname='trg_program_openings_slots_fcfs')
        OR (tgrelid='public.students'::regclass AND tgname='trg_notifications_scholarship_status_changed')
    );
    FOR state IN SELECT * FROM registry_seed_trigger_states LOOP
        EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I',state.tgrelid::regclass,state.tgname);
    END LOOP;
END;
$prepare$;

DO $seed$
DECLARE
    batch_key CONSTANT text := 'registry-scholars-five-per-opening-v1';
    per_opening CONSTANT integer := 5;
    opening record;
    registry_person record;
    new_student uuid;
    new_application uuid;
    existing_seed integer;
    valid_seed integer;
    occupied integer;
    reserved integer;
    available_registry integer;
    openings_needed integer;
    made integer := 0;
    awarded_on date := (now() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(batch_key));
    CREATE TEMP TABLE registry_seed_openings ON COMMIT DROP AS
    SELECT o.*, p.program_name
    FROM public.program_openings o
    JOIN public.scholarship_program p USING (program_id)
    JOIN public.academic_years ay USING (academic_year_id)
    WHERE NOT o.is_archived;

    IF NOT EXISTS (SELECT 1 FROM registry_seed_openings) THEN
        RAISE EXCEPTION 'No non-archived scholarship openings were found.';
    END IF;

    IF EXISTS (SELECT 1 FROM registry_seed_openings WHERE period_id IS NULL) THEN
        RAISE EXCEPTION 'Assign an academic period to each non-archived opening before seeding.';
    END IF;

    -- Match the application's per-opening capacity lock before inspecting reservations.
    FOR opening IN SELECT * FROM registry_seed_openings ORDER BY opening_id LOOP
        PERFORM pg_advisory_xact_lock(hashtext(opening.opening_id::text));
        PERFORM 1 FROM public.program_openings o WHERE o.opening_id = opening.opening_id FOR UPDATE;
    END LOOP;

    -- Do not promote/overwrite existing student accounts or their application history.
    -- Spread selection across courses rather than taking everyone from the first course.
    CREATE TEMP TABLE registry_seed_candidates ON COMMIT DROP AS
    SELECT m.*, row_number() OVER (
        PARTITION BY m.course_id ORDER BY m.student_number, m.master_student_id
    ) AS course_position
    FROM public.student_master_records m
    JOIN public.academic_course c ON c.course_id = m.course_id AND NOT c.is_archived
    WHERE m.is_active AND NOT m.is_archived AND m.source_registry
      AND m.latest_import_batch_id IS NOT NULL
      AND nullif(btrim(m.pdm_id), '') IS NOT NULL
      AND nullif(btrim(m.student_number), '') IS NOT NULL
      AND nullif(btrim(m.first_name), '') IS NOT NULL
      AND nullif(btrim(m.last_name), '') IS NOT NULL
      AND m.year_level BETWEEN 1 AND 6
      AND NOT coalesce(m.has_disciplinary_action, false)
      AND lower(btrim(coalesce(m.offense_type, ''))) IN ('', 'none', 'clear', 'no offense', 'no disciplinary offense')
      AND NOT EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.master_student_id = m.master_student_id
             OR lower(btrim(s.pdm_id)) = lower(btrim(m.pdm_id))
             OR lower(btrim(s.registrar_student_number)) = lower(btrim(m.student_number))
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.student_master_records other
          WHERE other.master_student_id <> m.master_student_id
            AND lower(btrim(other.pdm_id)) = lower(btrim(m.pdm_id))
      );

    SELECT count(*) INTO available_registry FROM registry_seed_candidates;
    SELECT count(*) INTO openings_needed FROM registry_seed_openings o
    WHERE NOT EXISTS (
        SELECT 1 FROM public.applications a WHERE a.opening_id = o.opening_id
          AND a.application_payload->>'seed_batch' = batch_key
    );
    IF available_registry < openings_needed * per_opening THEN
        RAISE EXCEPTION 'Need % unused imported students; only % qualify. Nothing was changed.',
            openings_needed * per_opening, available_registry;
    END IF;

    FOR opening IN SELECT * FROM registry_seed_openings ORDER BY program_name, opening_id LOOP
        SELECT count(*) INTO existing_seed FROM public.applications a
        WHERE a.opening_id = opening.opening_id AND a.application_payload->>'seed_batch' = batch_key;
        IF existing_seed > 0 THEN
            SELECT count(*) INTO valid_seed FROM public.applications a
            JOIN public.students s ON s.student_id = a.student_id
            WHERE a.opening_id = opening.opening_id AND a.application_payload->>'seed_batch' = batch_key
              AND a.application_status = 'Approved' AND a.activation_status = 'Activated'
              AND NOT a.is_archived AND s.current_application_id = a.application_id
              AND s.current_program_id = opening.program_id AND s.master_student_id IS NOT NULL
              AND s.is_active_scholar AND s.scholarship_status = 'Active'
              AND NOT s.is_archived AND NOT s.scholar_is_archived;
            IF existing_seed <> per_opening OR valid_seed <> per_opening THEN
                RAISE EXCEPTION 'The seed batch for % was changed or is incomplete. Review it before rerunning.', opening.program_name;
            END IF;
            CONTINUE;
        END IF;

        SELECT count(*) INTO occupied FROM public.students s
        JOIN public.applications a ON a.application_id = s.current_application_id AND a.student_id = s.student_id
        WHERE a.opening_id = opening.opening_id AND a.application_status = 'Approved'
          AND s.is_active_scholar AND s.scholarship_status = 'Active' AND NOT s.scholar_is_archived;
        SELECT count(*) INTO reserved FROM public.applications a
        WHERE a.opening_id = opening.opening_id AND NOT a.is_archived AND NOT a.is_disqualified
          AND a.activation_status <> 'Activated'
          AND lower(a.selection_status) IN ('selected', 'reserved', 'promoted');
        IF occupied + reserved + per_opening > opening.allocated_slots THEN
            RAISE EXCEPTION '% needs % free slots but only % remain after existing scholars/reservations. Nothing was changed.',
                opening.program_name, per_opening, opening.allocated_slots - occupied - reserved;
        END IF;

        FOR registry_person IN
            SELECT * FROM registry_seed_candidates
            ORDER BY course_position, course_id, student_number, master_student_id LIMIT per_opening
        LOOP
            INSERT INTO public.students (
                master_student_id, pdm_id, registrar_student_number, course_id,
                first_name, middle_name, last_name, year_level, sex_at_birth,
                email_address, phone_number, sequence_number, is_active_scholar,
                scholarship_status, current_program_id, active_academic_year_id,
                active_period_id, date_awarded, sdo_status
            ) VALUES (
                registry_person.master_student_id, registry_person.pdm_id, registry_person.student_number,
                registry_person.course_id, registry_person.first_name, registry_person.middle_name,
                registry_person.last_name, registry_person.year_level, registry_person.sex_at_birth,
                registry_person.email_address, registry_person.phone_number, registry_person.sequence_number,
                true, 'Active', opening.program_id, opening.academic_year_id, opening.period_id,
                awarded_on, 'Clear'
            ) RETURNING student_id INTO new_student;

            INSERT INTO public.applications (
                student_id, opening_id, program_id, application_status, selection_status,
                activation_status, selected_at, finalized_at, activated_at, endorsement_completed_at, application_payload
            ) VALUES (
                new_student, opening.opening_id, opening.program_id, 'Approved', 'Selected',
                'Activated', now(), now(), now(), now(),
                jsonb_build_object('seed_batch', batch_key, 'source', 'imported_student_registry',
                    'master_student_id', registry_person.master_student_id,
                    'seeded_at', now(), 'documents_uploaded', false, 'endorsements_simulated', true)
            ) RETURNING application_id INTO new_application;

            UPDATE public.students SET current_application_id = new_application WHERE student_id = new_student;

            -- Complete only this batch's generated slips; do not impersonate real reviewers.
            INSERT INTO public.endorsement_slips (
                application_id, student_id, opening_id, current_stage, overall_status,
                sdo_status, guidance_status, pd_status, completed_at
            ) VALUES (
                new_application, new_student, opening.opening_id, 'completed', 'completed',
                'no_offense', 'good_moral_standing', 'good_scholastic_standing', now()
            ) ON CONFLICT (application_id) DO UPDATE SET
                current_stage = 'completed', overall_status = 'completed', sdo_status = 'no_offense',
                guidance_status = 'good_moral_standing', pd_status = 'good_scholastic_standing',
                completed_at = excluded.completed_at, updated_at = now();

            DELETE FROM registry_seed_candidates WHERE master_student_id = registry_person.master_student_id;
            made := made + 1;
        END LOOP;

        -- Same canonical occupied-slot definition used by normal scholar activation.
        UPDATE public.program_openings o SET filled_slots = (
            SELECT count(*) FROM public.students s
            JOIN public.applications a ON a.application_id = s.current_application_id AND a.student_id = s.student_id
            WHERE a.opening_id = o.opening_id AND a.application_status = 'Approved'
              AND s.is_active_scholar AND s.scholarship_status = 'Active' AND NOT s.scholar_is_archived
        ), updated_at = now() WHERE o.opening_id = opening.opening_id;
    END LOOP;
    RAISE NOTICE 'Created % scholars; % per eligible opening. Existing batches were left unchanged.', made, per_opening;
END;
$seed$;

DO $restore_and_verify$
DECLARE state record; target record; changed boolean;
BEGIN
    FOR state IN SELECT * FROM registry_seed_trigger_states LOOP
        EXECUTE format('ALTER TABLE %s %s TRIGGER %I',state.tgrelid::regclass,
            CASE state.tgenabled WHEN 'A' THEN 'ENABLE ALWAYS' WHEN 'R' THEN 'ENABLE REPLICA'
                WHEN 'D' THEN 'DISABLE' ELSE 'ENABLE' END,state.tgname);
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM registry_seed_trigger_states original
        LEFT JOIN pg_trigger current ON current.tgrelid=original.tgrelid AND current.tgname=original.tgname
        WHERE current.tgenabled IS DISTINCT FROM original.tgenabled
    ) THEN RAISE EXCEPTION 'Trigger restoration failed. Rolling back the entire seed.'; END IF;

    FOR target IN SELECT * FROM (VALUES
        ('students','student_id'), ('student_master_records','master_student_id'),
        ('applications','application_id'), ('endorsement_slips','slip_id'),
        ('notifications','notification_id'), ('general_settings','general_settings_id')
    ) AS tables_to_preserve(table_name,key_column) LOOP
        IF to_regclass('public.' || target.table_name) IS NOT NULL THEN
            EXECUTE format('SELECT EXISTS(SELECT 1 FROM registry_seed_preserved original
                LEFT JOIN public.%I current ON current.%I::text=original.row_key
                WHERE original.table_name=%L AND to_jsonb(current) IS DISTINCT FROM original.document)',
                target.table_name,target.key_column,target.table_name) INTO changed;
            IF changed THEN RAISE EXCEPTION 'Existing % records changed unexpectedly. Rolling back the entire seed.',target.table_name; END IF;
        END IF;
    END LOOP;
    IF to_regclass('public.notifications') IS NOT NULL THEN
        EXECUTE 'SELECT count(*)<>(SELECT count(*) FROM registry_seed_preserved WHERE table_name=''notifications'') FROM public.notifications' INTO changed;
        IF changed THEN RAISE EXCEPTION 'Seed notifications were created unexpectedly. Rolling back the entire seed.'; END IF;
    END IF;
    IF EXISTS (
        SELECT 1 FROM registry_seed_opening_before original
        LEFT JOIN public.program_openings current USING(opening_id)
        WHERE CASE WHEN original.may_update_counter
            THEN to_jsonb(current)-'filled_slots'-'updated_at' IS DISTINCT FROM original.document-'filled_slots'-'updated_at'
            ELSE to_jsonb(current) IS DISTINCT FROM original.document END
    ) THEN RAISE EXCEPTION 'Existing opening details changed unexpectedly. Rolling back the entire seed.'; END IF;
END;
$restore_and_verify$;

-- Result includes only this batch; each opening should show five active scholars.
SELECT p.program_name, o.opening_title, ay.label AS academic_year, ap.term,
       count(*) AS seeded_scholars, o.allocated_slots, o.filled_slots
FROM public.applications a
JOIN public.students s ON s.current_application_id = a.application_id AND s.student_id = a.student_id
JOIN public.program_openings o ON o.opening_id = a.opening_id
JOIN public.scholarship_program p ON p.program_id = o.program_id
JOIN public.academic_years ay ON ay.academic_year_id = o.academic_year_id
JOIN public.academic_period ap ON ap.period_id = o.period_id
WHERE a.application_payload->>'seed_batch' = 'registry-scholars-five-per-opening-v1'
GROUP BY p.program_name, o.opening_title, ay.label, ap.term, o.opening_id, o.allocated_slots, o.filled_slots
ORDER BY p.program_name, o.opening_title;
COMMIT;
