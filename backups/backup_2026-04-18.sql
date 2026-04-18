


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."archive_applications_on_opening"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- when opening is archived
  if new.is_archived = true then
    update applications
    set is_archived = true
    where opening_id = new.opening_id;
  end if;

  -- when opening is unarchived
  if new.is_archived = false then
    update applications
    set is_archived = false
    where opening_id = new.opening_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."archive_applications_on_opening"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_single_active_period"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.is_active = TRUE THEN
        UPDATE academic_period
        SET is_active = FALSE
        WHERE period_id != NEW.period_id
          AND is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_single_active_period"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_admin_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT admin_id FROM admin_profiles WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_admin_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_benefactor_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT benefactor_id FROM benefactors WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_benefactor_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS character varying
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT role FROM users WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_student_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT student_id FROM students WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_student_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_null_per_scholar"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.per_scholar_amount IS NULL THEN
        NEW.per_scholar_amount := 0.00;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_null_per_scholar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_row_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_row_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_student_active_scholar"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Re-evaluate: is the student still an active scholar on ANY program?
    UPDATE students
    SET is_active_scholar = EXISTS (
        SELECT 1 FROM scholars
        WHERE student_id = NEW.student_id
          AND status = 'Active'
    )
    WHERE student_id = NEW.student_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_student_active_scholar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_student_sdo_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_has_major BOOLEAN;
    v_has_minor BOOLEAN;
BEGIN
    SELECT
        EXISTS (SELECT 1 FROM sdo_records
                WHERE student_id = NEW.student_id
                  AND status = 'Active'
                  AND offense_level = 'Major (P2)'),
        EXISTS (SELECT 1 FROM sdo_records
                WHERE student_id = NEW.student_id
                  AND status = 'Active'
                  AND offense_level = 'Minor (P1)')
    INTO v_has_major, v_has_minor;

    UPDATE students
    SET sdo_status = CASE
        WHEN v_has_major THEN 'Major Offense'
        WHEN v_has_minor THEN 'Minor Offense'
        ELSE 'Clear'
    END
    WHERE student_id = NEW.student_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_student_sdo_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_period_matches_academic_year"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  matched_year_id uuid;
begin
  if new.period_id is null then
    return new;
  end if;

  select academic_year_id
  into matched_year_id
  from public.academic_period
  where period_id = new.period_id;

  if new.academic_year_id is null then
    new.academic_year_id := matched_year_id;
    return new;
  end if;

  if new.academic_year_id <> matched_year_id then
    raise exception 'period_id does not belong to academic_year_id';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_period_matches_academic_year"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academic_course" (
    "course_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_code" character varying(20) NOT NULL,
    "course_name" character varying(150) NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "department_id" "uuid"
);


ALTER TABLE "public"."academic_course" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academic_departments" (
    "department_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_code" character varying(20) NOT NULL,
    "department_name" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_academic_departments_code_not_empty" CHECK ((TRIM(BOTH FROM "department_code") <> ''::"text"))
);


ALTER TABLE "public"."academic_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academic_period" (
    "period_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "activated_by" "uuid",
    "activated_at" timestamp without time zone,
    "academic_year_id" "uuid" NOT NULL,
    "term" character varying NOT NULL,
    CONSTRAINT "academic_period_term_check" CHECK ((("term")::"text" = ANY ((ARRAY['First Semester'::character varying, 'Second Semester'::character varying, 'Summer'::character varying])::"text"[])))
);


ALTER TABLE "public"."academic_period" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academic_years" (
    "academic_year_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "start_year" integer NOT NULL,
    "end_year" integer NOT NULL,
    "label" character varying GENERATED ALWAYS AS ((("start_year" || '-'::"text") || "end_year")) STORED NOT NULL,
    "is_active" boolean DEFAULT false,
    CONSTRAINT "academic_years_valid_range_check" CHECK (("end_year" = ("start_year" + 1)))
);


ALTER TABLE "public"."academic_years" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_profiles" (
    "admin_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_name" character varying(50) NOT NULL,
    "last_name" character varying(50) NOT NULL,
    "department" character varying(50),
    "position" character varying(50),
    "is_archived" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."admin_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "announcement_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid",
    "subject" character varying(150) NOT NULL,
    "content" "text" NOT NULL,
    "target_audience" character varying(50) DEFAULT 'All'::character varying NOT NULL,
    "is_ro_voluntary" boolean DEFAULT false NOT NULL,
    "publish_date" timestamp without time zone,
    "status" character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    "scheduled_at" timestamp without time zone,
    "published_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    CONSTRAINT "announcements_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Draft'::character varying, 'Published'::character varying, 'Scheduled'::character varying])::"text"[]))),
    CONSTRAINT "announcements_target_audience_check" CHECK ((("target_audience")::"text" = ANY ((ARRAY['all'::character varying, 'applicants'::character varying, 'scholars'::character varying, 'tes'::character varying, 'tdp'::character varying])::"text"[])))
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."application_document_reviews" (
    "review_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "document_key" character varying(50) NOT NULL,
    "document_name" character varying(100) NOT NULL,
    "review_status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "admin_comment" "text",
    "file_url" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp without time zone DEFAULT "now"(),
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."application_document_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."application_documents" (
    "document_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "document_type" character varying(100) NOT NULL,
    "is_submitted" boolean DEFAULT false,
    "file_url" "text",
    "submitted_at" timestamp with time zone,
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "file_name" "text",
    "file_path" "text",
    "notes" "text",
    CONSTRAINT "application_documents_document_type_check" CHECK ((("document_type")::"text" = ANY ((ARRAY['Survey Form'::character varying, 'Letter of Request'::character varying, 'Certificate of Indigency'::character varying, 'Certificate of Good Moral Character'::character varying, 'Senior High School Card'::character varying, 'Student Grade Forms'::character varying, 'Certificate of Registration'::character varying, 'ID Picture'::character varying])::"text"[])))
);


ALTER TABLE "public"."application_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."application_documents" IS 'Tracks documentary requirements submitted per application. One row per document type per application.';



COMMENT ON COLUMN "public"."application_documents"."file_url" IS 'Storage path or URL to the uploaded document file.';



COMMENT ON COLUMN "public"."application_documents"."submitted_at" IS 'Timestamp of when the document was marked as submitted.';



COMMENT ON COLUMN "public"."application_documents"."remarks" IS 'Coordinator notes on the document e.g. expired, blurry, incomplete.';



CREATE TABLE IF NOT EXISTS "public"."application_form_drafts" (
    "draft_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "opening_id" "uuid" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."application_form_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "application_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "program_id" "uuid",
    "application_status" character varying(30) DEFAULT 'Pending Review'::character varying NOT NULL,
    "evaluator_id" "uuid",
    "submission_date" timestamp without time zone DEFAULT "now"() NOT NULL,
    "deficiency_status" character varying(255) DEFAULT 'None'::character varying,
    "rejection_reason" "text",
    "document_status" character varying(30) DEFAULT 'Missing Docs'::character varying,
    "opening_id" "uuid",
    "is_archived" boolean DEFAULT false NOT NULL,
    "remarks" "text",
    "profile_id" "uuid" NOT NULL,
    "family_id" "uuid" NOT NULL,
    "education_id" "uuid",
    "is_disqualified" boolean DEFAULT false NOT NULL,
    CONSTRAINT "applications_application_status_check" CHECK ((("application_status")::"text" = ANY (ARRAY[('Pending Review'::character varying)::"text", ('Approved'::character varying)::"text", ('Rejected'::character varying)::"text"]))),
    CONSTRAINT "applications_document_status_check" CHECK ((("document_status")::"text" = ANY ((ARRAY['Documents Ready'::character varying, 'Missing Docs'::character varying, 'Under Review'::character varying])::"text"[])))
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "log_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action_taken" character varying(100) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT "now"() NOT NULL,
    "ip_address" character varying(45)
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."benefactor_contacts" (
    "contact_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "benefactor_id" "uuid" NOT NULL,
    "contact_person" character varying(150) NOT NULL,
    "contact_email" character varying(150),
    "contact_phone" character varying(30),
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."benefactor_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."benefactors" (
    "benefactor_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "benefactor_name" character varying(255) NOT NULL,
    "benefactor_type" character varying(20) NOT NULL,
    "description" "text",
    "is_archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "benefactors_benefactor_type_check1" CHECK ((("benefactor_type")::"text" = ANY ((ARRAY['Public'::character varying, 'Private'::character varying])::"text"[])))
);


ALTER TABLE "public"."benefactors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."benefactors_config" (
    "benefactor_config_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "benefactor_id" "uuid" NOT NULL,
    "applicable_programs" character varying(100),
    "min_gwa" numeric(4,2),
    "status" character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    CONSTRAINT "benefactors_config_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Published'::character varying, 'Draft'::character varying])::"text"[])))
);


ALTER TABLE "public"."benefactors_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "user_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_room_members" (
    "membership_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."chat_room_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_rooms" (
    "room_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_name" "text",
    "is_group" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "room_type" character varying(20) DEFAULT 'group'::character varying NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."criteria_year_levels" (
    "criteria_year_level_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "criteria_id" "uuid" NOT NULL,
    "year_level" integer NOT NULL,
    CONSTRAINT "criteria_year_levels_year_level_check" CHECK ((("year_level" >= 1) AND ("year_level" <= 6)))
);


ALTER TABLE "public"."criteria_year_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faqs" (
    "faq_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question" character varying(255) NOT NULL,
    "answer" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."faqs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_reports" (
    "report_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generated_by" "uuid",
    "report_type" character varying(50) NOT NULL,
    "period_id" "uuid",
    "file_format" character varying(10) NOT NULL,
    "generated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "file_url" character varying(255),
    CONSTRAINT "generated_reports_file_format_check" CHECK ((("file_format")::"text" = ANY ((ARRAY['PDF'::character varying, 'Excel'::character varying, 'CSV'::character varying])::"text"[])))
);


ALTER TABLE "public"."generated_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interviews" (
    "interview_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "interviewer_id" "uuid",
    "scheduled_datetime" timestamp without time zone NOT NULL,
    "location" character varying(150),
    "status" character varying(30) DEFAULT 'Scheduled'::character varying NOT NULL,
    "remarks" "text",
    CONSTRAINT "interviews_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Scheduled'::character varying, 'Completed'::character varying, 'No-Show'::character varying, 'Rescheduled'::character varying])::"text"[])))
);


ALTER TABLE "public"."interviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "message_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid",
    "subject" character varying(150),
    "message_body" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "attachment_url" character varying(255),
    "room_id" "uuid",
    CONSTRAINT "messages_target_check" CHECK (((("receiver_id" IS NOT NULL) AND ("room_id" IS NULL)) OR (("receiver_id" IS NULL) AND ("room_id" IS NOT NULL))))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mobile_sessions" (
    "session_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_token" character varying(255),
    "device_type" character varying(20),
    "session_token" character varying(512) NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp without time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "mobile_sessions_device_type_check" CHECK ((("device_type")::"text" = ANY ((ARRAY['Android'::character varying, 'iOS'::character varying])::"text"[])))
);


ALTER TABLE "public"."mobile_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "notification_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(50),
    "title" character varying(150) NOT NULL,
    "message" "text" NOT NULL,
    "reference_id" "uuid",
    "reference_type" character varying(50),
    "is_read" boolean DEFAULT false NOT NULL,
    "push_sent" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ocr_extracted_documents" (
    "document_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "linked_record_id" "uuid",
    "linked_record_type" character varying(30),
    "file_url" "text" NOT NULL,
    "scanned_via_iot" boolean DEFAULT false NOT NULL,
    "iot_device_id" "uuid",
    "ocr_extracted_name" character varying(200),
    "ocr_extracted_gwa" numeric(4,2),
    "ocr_confidence" numeric(5,2),
    "ocr_raw_text" "text",
    "scanned_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "documents_linked_record_type_check" CHECK ((("linked_record_type")::"text" = ANY ((ARRAY['application'::character varying, 'renewal'::character varying, 'ro'::character varying])::"text"[])))
);


ALTER TABLE "public"."ocr_extracted_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_attachments" (
    "attachment_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payout_batch_id" "uuid" NOT NULL,
    "payout_entry_id" "uuid",
    "file_name" character varying(255),
    "file_url" "text" NOT NULL,
    "file_type" character varying(50),
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payout_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_batch_scholars" (
    "payout_entry_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payout_batch_id" "uuid" NOT NULL,
    "scholar_id" "uuid" NOT NULL,
    "amount_received" numeric(12,2) DEFAULT 0 NOT NULL,
    "release_status" character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    "released_at" timestamp with time zone,
    "check_number" character varying(100),
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_payout_batch_scholars_amount_received" CHECK (("amount_received" >= (0)::numeric)),
    CONSTRAINT "chk_payout_batch_scholars_release_status" CHECK ((("release_status")::"text" = ANY ((ARRAY['Pending'::character varying, 'Released'::character varying, 'Absent'::character varying, 'On Hold'::character varying, 'Cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."payout_batch_scholars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_batches" (
    "payout_batch_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid" NOT NULL,
    "payout_title" character varying(150),
    "payout_date" "date",
    "payment_mode" character varying(20) NOT NULL,
    "amount_per_scholar" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "batch_status" character varying(30) DEFAULT 'Draft'::character varying NOT NULL,
    "acknowledgement_status" character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    "acknowledgement_sent_date" timestamp with time zone,
    "acknowledgement_channel" character varying(50),
    "remarks" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "opening_id" "uuid",
    "academic_year_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    CONSTRAINT "chk_payout_batches_amount_per_scholar" CHECK (("amount_per_scholar" >= (0)::numeric)),
    CONSTRAINT "chk_payout_batches_total_amount" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "payout_batches_ack_status_check" CHECK ((("acknowledgement_status")::"text" = ANY ((ARRAY['Pending'::character varying, 'Sent'::character varying, 'Confirmed'::character varying])::"text"[]))),
    CONSTRAINT "payout_batches_batch_status_check" CHECK ((("batch_status")::"text" = ANY ((ARRAY['Draft'::character varying, 'Finalized'::character varying, 'In Release'::character varying, 'Completed'::character varying, 'Cancelled'::character varying, 'Archived'::character varying])::"text"[]))),
    CONSTRAINT "payout_batches_payment_mode_check" CHECK ((("payment_mode")::"text" = ANY ((ARRAY['Cash'::character varying, 'Bank'::character varying, 'Cheque'::character varying])::"text"[])))
);


ALTER TABLE "public"."payout_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_history" (
    "history_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scholar_id" "uuid" NOT NULL,
    "amount_received" numeric(10,2) NOT NULL,
    "date_claimed" timestamp without time zone DEFAULT "now"() NOT NULL,
    "processed_by" "uuid",
    "remarks" "text",
    "payout_batch_id" "uuid",
    "payout_entry_id" "uuid"
);


ALTER TABLE "public"."payout_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_openings" (
    "opening_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opening_title" character varying(150) NOT NULL,
    "allocated_slots" integer DEFAULT 0 NOT NULL,
    "financial_allocation" numeric(12,2),
    "posting_status" character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    "announcement_text" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "program_id" "uuid" NOT NULL,
    "per_scholar_amount" numeric DEFAULT 0.00 NOT NULL,
    "filled_slots" integer DEFAULT 0 NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "period_id" "uuid",
    CONSTRAINT "chk_program_openings_allocated_slots_nonnegative" CHECK (("allocated_slots" >= 0)),
    CONSTRAINT "chk_program_openings_filled_not_exceed_allocated" CHECK (("filled_slots" <= "allocated_slots")),
    CONSTRAINT "chk_program_openings_filled_slots_nonnegative" CHECK (("filled_slots" >= 0)),
    CONSTRAINT "chk_program_openings_posting_status" CHECK ((("posting_status")::"text" = ANY ((ARRAY['draft'::character varying, 'open'::character varying, 'closed'::character varying, 'archived'::character varying])::"text"[]))),
    CONSTRAINT "program_openings_posting_status_check" CHECK ((("posting_status")::"text" = ANY ((ARRAY['draft'::character varying, 'open'::character varying, 'closed'::character varying, 'archived'::character varying])::"text"[])))
);


ALTER TABLE "public"."program_openings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_requirements" (
    "requirement_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid" NOT NULL,
    "document_type" character varying(50) NOT NULL,
    "is_mandatory" boolean DEFAULT true NOT NULL,
    "for_renewal" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."program_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."renewal_documents" (
    "renewal_document_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "renewal_id" "uuid" NOT NULL,
    "document_type" character varying(100) NOT NULL,
    "file_url" "text",
    "is_submitted" boolean DEFAULT false NOT NULL,
    "review_status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "admin_comment" "text",
    "submitted_at" timestamp without time zone,
    "reviewed_at" timestamp without time zone,
    "remarks" "text",
    CONSTRAINT "renewal_documents_type_check" CHECK ((("document_type")::"text" = ANY ((ARRAY['Certificate of Registration'::character varying, 'Grade Form / Transcript'::character varying])::"text"[])))
);


ALTER TABLE "public"."renewal_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."renewals" (
    "renewal_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scholar_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "status" character varying(30) DEFAULT 'Pending Submission'::character varying NOT NULL,
    "deadline_date" "date",
    "submitted_on" timestamp without time zone,
    CONSTRAINT "renewals_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Pending Submission'::character varying, 'Under Review'::character varying, 'Approved'::character varying, 'Failed'::character varying])::"text"[])))
);


ALTER TABLE "public"."renewals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."return_of_obligations" (
    "ro_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scholar_id" "uuid" NOT NULL,
    "department_assigned" "text",
    "task_description" "text" NOT NULL,
    "required_hours" integer DEFAULT 20 NOT NULL,
    "rendered_hours" integer DEFAULT 0 NOT NULL,
    "ro_status" character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    "deadline_date" timestamp without time zone,
    "proof_file_url" "text",
    "admin_note" "text",
    "rejection_reason" "text",
    "is_carry_over" boolean DEFAULT false NOT NULL,
    "previous_semester" character varying(100),
    "assigned_by" "uuid",
    "verified_by" "uuid",
    "rejected_by" "uuid",
    "assigned_at" timestamp without time zone,
    "submitted_at" timestamp without time zone,
    "verified_at" timestamp without time zone,
    "rejected_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "return_of_obligations_rendered_hours_check" CHECK (("rendered_hours" >= 0)),
    CONSTRAINT "return_of_obligations_required_hours_check" CHECK (("required_hours" >= 0)),
    CONSTRAINT "return_of_obligations_ro_status_check" CHECK ((("ro_status")::"text" = ANY ((ARRAY['Pending'::character varying, 'Verified'::character varying, 'Rejected'::character varying, 'Overdue'::character varying])::"text"[])))
);


ALTER TABLE "public"."return_of_obligations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ro_departments" (
    "department_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_name" character varying(100) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ro_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scholar_activity_logs" (
    "log_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scholar_id" "uuid" NOT NULL,
    "action" character varying(100) NOT NULL,
    "details" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."scholar_activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scholars" (
    "scholar_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "program_id" "uuid" NOT NULL,
    "application_id" "uuid" NOT NULL,
    "date_awarded" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" character varying(30) DEFAULT 'Active'::character varying NOT NULL,
    "ro_progress" integer DEFAULT 0,
    "remarks" "text",
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "is_archived" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    "removal_reason" "text",
    "removal_notes" "text",
    "removed_by" "uuid",
    "academic_year_id" "uuid" NOT NULL,
    "period_id" "uuid",
    CONSTRAINT "chk_ro_progress" CHECK ((("ro_progress" >= 0) AND ("ro_progress" <= 100))),
    CONSTRAINT "scholars_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'On Hold'::character varying, 'Inactive'::character varying, 'Removed'::character varying])::"text"[])))
);


ALTER TABLE "public"."scholars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scholarship_criteria" (
    "criteria_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scholarship_name" character varying(255) NOT NULL,
    "scholarship_code" character varying(20) NOT NULL,
    "min_gwa" numeric(4,2),
    "status" character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    CONSTRAINT "scholarship_criteria_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Draft'::character varying, 'Published'::character varying])::"text"[])))
);


ALTER TABLE "public"."scholarship_criteria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scholarship_program" (
    "program_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "program_name" character varying(150),
    "description" "text",
    "gwa_threshold" numeric(4,2) DEFAULT NULL::numeric,
    "renewal_cycle" character varying(20) DEFAULT 'Semester'::character varying,
    "visibility_status" character varying(20) DEFAULT 'Published'::character varying,
    "benefactor_id" "uuid",
    "target_audience" character varying,
    CONSTRAINT "benefactors_renewal_cycle_check" CHECK ((("renewal_cycle")::"text" = ANY ((ARRAY['Semester'::character varying, 'Annual'::character varying, 'None'::character varying])::"text"[]))),
    CONSTRAINT "benefactors_visibility_status_check" CHECK ((("visibility_status")::"text" = ANY ((ARRAY['Published'::character varying, 'Draft'::character varying])::"text"[])))
);


ALTER TABLE "public"."scholarship_program" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sdo_records" (
    "record_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "reported_by" "uuid",
    "offense_level" character varying(20) NOT NULL,
    "offense_description" "text",
    "date_reported" timestamp without time zone DEFAULT "now"() NOT NULL,
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    CONSTRAINT "sdo_records_offense_level_check" CHECK ((("offense_level")::"text" = ANY ((ARRAY['Minor (P1)'::character varying, 'Major (P2)'::character varying])::"text"[]))),
    CONSTRAINT "sdo_records_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Lifted'::character varying])::"text"[])))
);


ALTER TABLE "public"."sdo_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_education" (
    "education_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "education_level" character varying(30) NOT NULL,
    "school_name" character varying(255),
    "school_address" character varying(255),
    "honors_awards" character varying(255),
    "club_organization" character varying(255),
    "year_graduated" character varying(10),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "student_education_education_level_check" CHECK ((("education_level")::"text" = ANY ((ARRAY['Elementary'::character varying, 'High School'::character varying, 'Senior High School'::character varying, 'College'::character varying])::"text"[])))
);


ALTER TABLE "public"."student_education" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_education" IS 'Educational background history from Section III of the scholarship application form. One row per education level per student.';



COMMENT ON COLUMN "public"."student_education"."education_level" IS 'Elementary, High School, Senior High School, or College.';



COMMENT ON COLUMN "public"."student_education"."honors_awards" IS 'Academic honors or awards received at this level e.g. With Honors, Valedictorian, Dean''s Lister.';



COMMENT ON COLUMN "public"."student_education"."year_graduated" IS 'Year or school year of graduation e.g. 2022 or 2021-2022.';



CREATE TABLE IF NOT EXISTS "public"."student_family" (
    "family_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "relation" character varying(20) NOT NULL,
    "last_name" character varying(100),
    "first_name" character varying(100),
    "middle_name" character varying(100),
    "mobile_number" character varying(15),
    "address" "text",
    "highest_educational_attainment" character varying(100),
    "occupation" character varying(255),
    "company_name_address" character varying(255),
    "is_marilao_native" boolean,
    "years_as_resident" integer,
    "origin_province" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "student_family_highest_educational_attainment_check" CHECK ((("highest_educational_attainment")::"text" = ANY ((ARRAY['Elementary'::character varying, 'High School'::character varying, 'Senior High School'::character varying, 'Vocational'::character varying, 'College'::character varying, 'Post-Graduate'::character varying, 'None'::character varying])::"text"[]))),
    CONSTRAINT "student_family_relation_check" CHECK ((("relation")::"text" = ANY ((ARRAY['Father'::character varying, 'Mother'::character varying, 'Sibling'::character varying, 'Guardian'::character varying])::"text"[])))
);


ALTER TABLE "public"."student_family" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_family" IS 'Family data from Section II of the scholarship application form. One row per family member. Multiple siblings supported naturally.';



COMMENT ON COLUMN "public"."student_family"."relation" IS 'Father, Mother, Sibling, or Guardian.';



COMMENT ON COLUMN "public"."student_family"."address" IS 'Shared address of parents/guardian as written on the form.';



COMMENT ON COLUMN "public"."student_family"."is_marilao_native" IS 'Whether the parent is a native of Marilao. Applies to Father and Mother rows only.';



COMMENT ON COLUMN "public"."student_family"."years_as_resident" IS 'How long the parent has been a Marilao resident. Populated when is_marilao_native = TRUE.';



COMMENT ON COLUMN "public"."student_family"."origin_province" IS 'Town or province of origin. Populated when is_marilao_native = FALSE.';



CREATE TABLE IF NOT EXISTS "public"."student_profiles" (
    "profile_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "date_of_birth" "date",
    "place_of_birth" character varying(255),
    "sex" character varying(10),
    "civil_status" character varying(20),
    "maiden_name" character varying(255),
    "religion" character varying(100),
    "citizenship" character varying(100) DEFAULT 'Filipino'::character varying,
    "street_address" character varying(255),
    "subdivision" character varying(255),
    "city" character varying(100),
    "province" character varying(100),
    "zip_code" character varying(10),
    "landline_number" character varying(20),
    "learners_reference_number" character varying(30),
    "financial_support_type" character varying(20),
    "financial_support_other" character varying(255),
    "has_prior_scholarship" boolean DEFAULT false,
    "prior_scholarship_details" "text",
    "has_disciplinary_record" boolean DEFAULT false,
    "disciplinary_details" "text",
    "self_description" "text",
    "aims_and_ambitions" "text",
    "applicant_signature_url" "text",
    "guardian_signature_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "barangay" character varying(50),
    "phone_number" character varying(20),
    CONSTRAINT "student_profiles_civil_status_check" CHECK ((("civil_status")::"text" = ANY ((ARRAY['Single'::character varying, 'Married'::character varying, 'Widowed'::character varying, 'Separated'::character varying])::"text"[]))),
    CONSTRAINT "student_profiles_financial_support_type_check" CHECK ((("financial_support_type")::"text" = ANY ((ARRAY['Parents'::character varying, 'Scholarship'::character varying, 'Loan'::character varying, 'Other'::character varying])::"text"[]))),
    CONSTRAINT "student_profiles_sex_check" CHECK ((("sex")::"text" = ANY ((ARRAY['Male'::character varying, 'Female'::character varying])::"text"[])))
);


ALTER TABLE "public"."student_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_profiles" IS 'Personal and demographic data from Section I & III of the scholarship application form. One row per student.';



COMMENT ON COLUMN "public"."student_profiles"."maiden_name" IS 'Only populated if civil_status is Married.';



COMMENT ON COLUMN "public"."student_profiles"."street_address" IS 'House number, block, lot, phase, and street name.';



COMMENT ON COLUMN "public"."student_profiles"."landline_number" IS 'Format: area code + telephone number e.g. 02-8123456.';



COMMENT ON COLUMN "public"."student_profiles"."learners_reference_number" IS 'Learner Reference Number from DepEd, required for applicants.';



COMMENT ON COLUMN "public"."student_profiles"."financial_support_other" IS 'Only populated when financial_support_type is Other.';



COMMENT ON COLUMN "public"."student_profiles"."prior_scholarship_details" IS 'Free-text: school, course, year level, semester, SY, and amount granted.';



COMMENT ON COLUMN "public"."student_profiles"."applicant_signature_url" IS 'File URL or storage path to the scanned applicant signature.';



COMMENT ON COLUMN "public"."student_profiles"."guardian_signature_url" IS 'File URL or storage path to the scanned parent/guardian signature.';



CREATE TABLE IF NOT EXISTS "public"."student_registry" (
    "registry_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_number" character varying(20) NOT NULL,
    "learners_reference_number" character varying(50),
    "given_name" character varying(50) NOT NULL,
    "middle_name" character varying(50),
    "last_name" character varying(50) NOT NULL,
    "course_id" "uuid",
    "year_level" integer,
    "sex_at_birth" "text",
    "email_address" "text",
    "phone_number" "text",
    "sequence_number" integer,
    "imported_at" timestamp with time zone NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    CONSTRAINT "student_registry_year_level_check" CHECK ((("year_level" IS NULL) OR (("year_level" >= 1) AND ("year_level" <= 6))))
);


ALTER TABLE "public"."student_registry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "student_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pdm_id" character varying(20) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid",
    "first_name" character varying(50) NOT NULL,
    "middle_name" character varying(50),
    "last_name" character varying(50) NOT NULL,
    "year_level" integer,
    "gwa" numeric(4,2),
    "profile_photo_url" character varying(255),
    "is_active_scholar" boolean DEFAULT false NOT NULL,
    "account_status" character varying(20) DEFAULT 'Pending'::character varying NOT NULL,
    "sdo_status" character varying(20) DEFAULT 'Clear'::character varying NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "is_profile_complete" boolean DEFAULT false NOT NULL,
    CONSTRAINT "students_account_status_check" CHECK ((("account_status")::"text" = ANY ((ARRAY['Pending'::character varying, 'Verified'::character varying, 'Disabled'::character varying])::"text"[]))),
    CONSTRAINT "students_sdo_status_check" CHECK ((("sdo_status")::"text" = ANY ((ARRAY['Clear'::character varying, 'Minor Offense'::character varying, 'Major Offense'::character varying])::"text"[]))),
    CONSTRAINT "students_year_level_check" CHECK ((("year_level" IS NULL) OR (("year_level" >= 1) AND ("year_level" <= 6))))
);


ALTER TABLE "public"."students" OWNER TO "postgres";


COMMENT ON TABLE "public"."students" IS 'App master table for users who actually exist in the system';



CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "ticket_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "issue_category" character varying(50),
    "description" "text",
    "status" character varying(30) DEFAULT 'Open'::character varying NOT NULL,
    "handled_by" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp without time zone,
    "is_archived" boolean DEFAULT false,
    CONSTRAINT "support_tickets_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Open'::character varying, 'In Progress'::character varying, 'Resolved'::character varying, 'Closed'::character varying])::"text"[])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trivia" (
    "trivia_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question" character varying(255) NOT NULL,
    "fun_fact" "text",
    "display_date" "date",
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."trivia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_token" "text" NOT NULL,
    "platform" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_device_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role" character varying(20) NOT NULL,
    "username" character varying(50) NOT NULL,
    "password_hash" character varying(255) NOT NULL,
    "email" character varying(100) NOT NULL,
    "phone_number" character varying(15),
    "is_otp_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "users_role_check" CHECK ((("role")::"text" = ANY (ARRAY[('Student'::character varying)::"text", ('Admin'::character varying)::"text", ('SDO'::character varying)::"text", ('Benefactor'::character varying)::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academic_course"
    ADD CONSTRAINT "academic_course_course_code_key" UNIQUE ("course_code");



ALTER TABLE ONLY "public"."academic_course"
    ADD CONSTRAINT "academic_course_pkey" PRIMARY KEY ("course_id");



ALTER TABLE ONLY "public"."academic_departments"
    ADD CONSTRAINT "academic_departments_department_code_key" UNIQUE ("department_code");



ALTER TABLE ONLY "public"."academic_departments"
    ADD CONSTRAINT "academic_departments_pkey" PRIMARY KEY ("department_id");



ALTER TABLE ONLY "public"."academic_period"
    ADD CONSTRAINT "academic_period_pkey" PRIMARY KEY ("period_id");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "academic_years_pkey" PRIMARY KEY ("academic_year_id");



ALTER TABLE ONLY "public"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("admin_id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("announcement_id");



ALTER TABLE ONLY "public"."application_document_reviews"
    ADD CONSTRAINT "application_document_reviews_pkey" PRIMARY KEY ("review_id");



ALTER TABLE ONLY "public"."application_document_reviews"
    ADD CONSTRAINT "application_document_reviews_unique_app_doc" UNIQUE ("application_id", "document_key");



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_pkey" PRIMARY KEY ("document_id");



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_unique_app_doc" UNIQUE ("application_id", "document_type");



ALTER TABLE ONLY "public"."application_form_drafts"
    ADD CONSTRAINT "application_form_drafts_pkey" PRIMARY KEY ("draft_id");



ALTER TABLE ONLY "public"."application_form_drafts"
    ADD CONSTRAINT "application_form_drafts_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("application_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("log_id");



ALTER TABLE ONLY "public"."benefactor_contacts"
    ADD CONSTRAINT "benefactor_contacts_pkey" PRIMARY KEY ("contact_id");



ALTER TABLE ONLY "public"."benefactors_config"
    ADD CONSTRAINT "benefactors_config_pkey" PRIMARY KEY ("benefactor_config_id");



ALTER TABLE ONLY "public"."scholarship_program"
    ADD CONSTRAINT "benefactors_pkey" PRIMARY KEY ("program_id");



ALTER TABLE ONLY "public"."benefactors"
    ADD CONSTRAINT "benefactors_pkey1" PRIMARY KEY ("benefactor_id");



ALTER TABLE ONLY "public"."chat_members"
    ADD CONSTRAINT "chat_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_room_members"
    ADD CONSTRAINT "chat_room_members_pkey" PRIMARY KEY ("membership_id");



ALTER TABLE ONLY "public"."chat_room_members"
    ADD CONSTRAINT "chat_room_members_room_id_user_id_key" UNIQUE ("room_id", "user_id");



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("room_id");



ALTER TABLE ONLY "public"."criteria_year_levels"
    ADD CONSTRAINT "criteria_year_levels_criteria_id_year_level_key" UNIQUE ("criteria_id", "year_level");



ALTER TABLE ONLY "public"."criteria_year_levels"
    ADD CONSTRAINT "criteria_year_levels_pkey" PRIMARY KEY ("criteria_year_level_id");



ALTER TABLE ONLY "public"."ocr_extracted_documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("document_id");



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_pkey" PRIMARY KEY ("faq_id");



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("report_id");



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_pkey" PRIMARY KEY ("interview_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("message_id");



ALTER TABLE ONLY "public"."mobile_sessions"
    ADD CONSTRAINT "mobile_sessions_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."mobile_sessions"
    ADD CONSTRAINT "mobile_sessions_session_token_key" UNIQUE ("session_token");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id");



ALTER TABLE ONLY "public"."payout_attachments"
    ADD CONSTRAINT "payout_attachments_pkey" PRIMARY KEY ("attachment_id");



ALTER TABLE ONLY "public"."payout_batch_scholars"
    ADD CONSTRAINT "payout_batch_scholars_pkey" PRIMARY KEY ("payout_entry_id");



ALTER TABLE ONLY "public"."payout_batches"
    ADD CONSTRAINT "payout_batches_pkey" PRIMARY KEY ("payout_batch_id");



ALTER TABLE ONLY "public"."payout_history"
    ADD CONSTRAINT "payout_history_pkey" PRIMARY KEY ("history_id");



ALTER TABLE ONLY "public"."program_openings"
    ADD CONSTRAINT "program_openings_pkey" PRIMARY KEY ("opening_id");



ALTER TABLE ONLY "public"."program_requirements"
    ADD CONSTRAINT "program_requirements_pkey" PRIMARY KEY ("requirement_id");



ALTER TABLE ONLY "public"."renewal_documents"
    ADD CONSTRAINT "renewal_documents_pkey" PRIMARY KEY ("renewal_document_id");



ALTER TABLE ONLY "public"."renewal_documents"
    ADD CONSTRAINT "renewal_documents_unique" UNIQUE ("renewal_id", "document_type");



ALTER TABLE ONLY "public"."renewals"
    ADD CONSTRAINT "renewals_pkey" PRIMARY KEY ("renewal_id");



ALTER TABLE ONLY "public"."return_of_obligations"
    ADD CONSTRAINT "return_of_obligations_pkey" PRIMARY KEY ("ro_id");



ALTER TABLE ONLY "public"."ro_departments"
    ADD CONSTRAINT "ro_departments_department_name_key" UNIQUE ("department_name");



ALTER TABLE ONLY "public"."ro_departments"
    ADD CONSTRAINT "ro_departments_pkey" PRIMARY KEY ("department_id");



ALTER TABLE ONLY "public"."scholar_activity_logs"
    ADD CONSTRAINT "scholar_activity_logs_pkey" PRIMARY KEY ("log_id");



ALTER TABLE ONLY "public"."scholars"
    ADD CONSTRAINT "scholars_pkey" PRIMARY KEY ("scholar_id");



ALTER TABLE ONLY "public"."scholarship_criteria"
    ADD CONSTRAINT "scholarship_criteria_pkey" PRIMARY KEY ("criteria_id");



ALTER TABLE ONLY "public"."scholarship_criteria"
    ADD CONSTRAINT "scholarship_criteria_scholarship_code_key" UNIQUE ("scholarship_code");



ALTER TABLE ONLY "public"."sdo_records"
    ADD CONSTRAINT "sdo_records_pkey" PRIMARY KEY ("record_id");



ALTER TABLE ONLY "public"."student_education"
    ADD CONSTRAINT "student_education_pkey" PRIMARY KEY ("education_id");



ALTER TABLE ONLY "public"."student_family"
    ADD CONSTRAINT "student_family_pkey" PRIMARY KEY ("family_id");



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_student_id_key" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."student_registry"
    ADD CONSTRAINT "student_registry_pkey" PRIMARY KEY ("registry_id");



ALTER TABLE ONLY "public"."student_registry"
    ADD CONSTRAINT "student_registry_student_number_key" UNIQUE ("student_number");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pdm_id_key" UNIQUE ("pdm_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("student_id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("ticket_id");



ALTER TABLE ONLY "public"."trivia"
    ADD CONSTRAINT "trivia_pkey" PRIMARY KEY ("trivia_id");



ALTER TABLE ONLY "public"."benefactors"
    ADD CONSTRAINT "unique_benefactor_name" UNIQUE ("benefactor_name");



ALTER TABLE ONLY "public"."academic_period"
    ADD CONSTRAINT "uq_academic_period_per_year" UNIQUE ("academic_year_id", "term");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "uq_academic_years_label" UNIQUE ("label");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "uq_academic_years_range" UNIQUE ("start_year", "end_year");



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "uq_application_document" UNIQUE ("application_id", "document_type");



ALTER TABLE ONLY "public"."payout_batch_scholars"
    ADD CONSTRAINT "uq_payout_batch_scholar" UNIQUE ("payout_batch_id", "scholar_id");



ALTER TABLE ONLY "public"."payout_batch_scholars"
    ADD CONSTRAINT "uq_payout_batch_scholars_batch_scholar" UNIQUE ("payout_batch_id", "scholar_id");



ALTER TABLE ONLY "public"."student_education"
    ADD CONSTRAINT "uq_student_education_level" UNIQUE ("student_id", "education_level");



ALTER TABLE ONLY "public"."user_device_tokens"
    ADD CONSTRAINT "user_device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_device_tokens"
    ADD CONSTRAINT "user_device_tokens_unique_token" UNIQUE ("user_id", "device_token");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "idx_academic_course_code" ON "public"."academic_course" USING "btree" ("course_code");



CREATE INDEX "idx_academic_course_department_id" ON "public"."academic_course" USING "btree" ("department_id");



CREATE INDEX "idx_academic_period_academic_year_id" ON "public"."academic_period" USING "btree" ("academic_year_id");



CREATE INDEX "idx_academic_period_active" ON "public"."academic_period" USING "btree" ("period_id") WHERE ("is_active" = true);



CREATE INDEX "idx_academic_period_term" ON "public"."academic_period" USING "btree" ("term");



CREATE INDEX "idx_admin_profiles_active" ON "public"."admin_profiles" USING "btree" ("admin_id") WHERE ("is_archived" = false);



CREATE INDEX "idx_admin_profiles_user_id" ON "public"."admin_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_announcements_publish" ON "public"."announcements" USING "btree" ("published_at" DESC);



CREATE INDEX "idx_announcements_publish_date" ON "public"."announcements" USING "btree" ("publish_date" DESC) WHERE (("status")::"text" = 'Published'::"text");



CREATE INDEX "idx_announcements_status" ON "public"."announcements" USING "btree" ("status");



CREATE INDEX "idx_appdoc_application_id" ON "public"."application_documents" USING "btree" ("application_id");



CREATE INDEX "idx_appdoc_student_id" ON "public"."application_documents" USING "btree" ("uploaded_by");



CREATE INDEX "idx_application_document_reviews_app_id" ON "public"."application_document_reviews" USING "btree" ("application_id");



CREATE UNIQUE INDEX "idx_application_document_reviews_unique" ON "public"."application_document_reviews" USING "btree" ("application_id", "document_key");



CREATE INDEX "idx_application_form_drafts_opening_id" ON "public"."application_form_drafts" USING "btree" ("opening_id");



CREATE INDEX "idx_applications_opening_id" ON "public"."applications" USING "btree" ("opening_id");



CREATE INDEX "idx_applications_program_id" ON "public"."applications" USING "btree" ("program_id");



CREATE INDEX "idx_applications_program_status" ON "public"."applications" USING "btree" ("program_id", "application_status");



CREATE INDEX "idx_applications_status" ON "public"."applications" USING "btree" ("application_status");



CREATE INDEX "idx_applications_student_id" ON "public"."applications" USING "btree" ("student_id");



CREATE INDEX "idx_applications_student_opening" ON "public"."applications" USING "btree" ("student_id", "opening_id");



CREATE INDEX "idx_applications_submission_date" ON "public"."applications" USING "btree" ("submission_date" DESC);



CREATE INDEX "idx_audit_logs_timestamp" ON "public"."audit_logs" USING "btree" ("timestamp");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_benefactors_config_benefactor_id" ON "public"."benefactors_config" USING "btree" ("benefactor_id");



CREATE INDEX "idx_chat_room_members_room_id" ON "public"."chat_room_members" USING "btree" ("room_id");



CREATE INDEX "idx_chat_room_members_user_id" ON "public"."chat_room_members" USING "btree" ("user_id");



CREATE INDEX "idx_criteria_year_levels_criteria_id" ON "public"."criteria_year_levels" USING "btree" ("criteria_id");



CREATE INDEX "idx_generated_reports_generated_by" ON "public"."generated_reports" USING "btree" ("generated_by");



CREATE INDEX "idx_generated_reports_period_id" ON "public"."generated_reports" USING "btree" ("period_id");



CREATE INDEX "idx_interviews_application_id" ON "public"."interviews" USING "btree" ("application_id");



CREATE INDEX "idx_interviews_scheduled" ON "public"."interviews" USING "btree" ("scheduled_datetime") WHERE (("status")::"text" = 'Scheduled'::"text");



CREATE INDEX "idx_messages_receiver_id" ON "public"."messages" USING "btree" ("receiver_id");



CREATE INDEX "idx_messages_room_id" ON "public"."messages" USING "btree" ("room_id");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_messages_sent_at" ON "public"."messages" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_messages_unread" ON "public"."messages" USING "btree" ("receiver_id") WHERE ("is_read" = false);



CREATE INDEX "idx_mobile_sessions_active" ON "public"."mobile_sessions" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_mobile_sessions_device_token" ON "public"."mobile_sessions" USING "btree" ("device_token") WHERE ("device_token" IS NOT NULL);



CREATE INDEX "idx_mobile_sessions_is_active" ON "public"."mobile_sessions" USING "btree" ("is_active");



CREATE INDEX "idx_mobile_sessions_user_id" ON "public"."mobile_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_push_pending" ON "public"."notifications" USING "btree" ("notification_id") WHERE ("push_sent" = false);



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id") WHERE ("is_read" = false);



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_payout_attachments_batch_id" ON "public"."payout_attachments" USING "btree" ("payout_batch_id");



CREATE INDEX "idx_payout_attachments_entry_id" ON "public"."payout_attachments" USING "btree" ("payout_entry_id");



CREATE INDEX "idx_payout_batch_scholars_batch_id" ON "public"."payout_batch_scholars" USING "btree" ("payout_batch_id");



CREATE INDEX "idx_payout_batch_scholars_release_status" ON "public"."payout_batch_scholars" USING "btree" ("release_status");



CREATE INDEX "idx_payout_batch_scholars_scholar_id" ON "public"."payout_batch_scholars" USING "btree" ("scholar_id");



CREATE INDEX "idx_payout_batches_batch_status" ON "public"."payout_batches" USING "btree" ("batch_status");



CREATE INDEX "idx_payout_batches_opening_id" ON "public"."payout_batches" USING "btree" ("opening_id");



CREATE INDEX "idx_payout_batches_payout_date" ON "public"."payout_batches" USING "btree" ("payout_date" DESC);



CREATE INDEX "idx_payout_batches_program_id" ON "public"."payout_batches" USING "btree" ("program_id");



CREATE INDEX "idx_payout_batches_status" ON "public"."payout_batches" USING "btree" ("batch_status");



CREATE INDEX "idx_payout_date_claimed" ON "public"."payout_history" USING "btree" ("date_claimed" DESC);



CREATE INDEX "idx_payout_history_batch_id" ON "public"."payout_history" USING "btree" ("payout_batch_id");



CREATE INDEX "idx_payout_history_entry_id" ON "public"."payout_history" USING "btree" ("payout_entry_id");



CREATE INDEX "idx_payout_history_scholar_id" ON "public"."payout_history" USING "btree" ("scholar_id");



CREATE INDEX "idx_payout_scholar_id" ON "public"."payout_history" USING "btree" ("scholar_id");



CREATE INDEX "idx_program_openings_academic_year_id" ON "public"."program_openings" USING "btree" ("academic_year_id");



CREATE INDEX "idx_program_openings_period_id" ON "public"."program_openings" USING "btree" ("period_id");



CREATE INDEX "idx_program_requirements_program_id" ON "public"."program_requirements" USING "btree" ("program_id");



CREATE INDEX "idx_renewals_deadline" ON "public"."renewals" USING "btree" ("deadline_date");



CREATE INDEX "idx_renewals_period_id" ON "public"."renewals" USING "btree" ("period_id");



CREATE INDEX "idx_renewals_period_status" ON "public"."renewals" USING "btree" ("period_id", "status");



CREATE INDEX "idx_renewals_scholar_id" ON "public"."renewals" USING "btree" ("scholar_id");



CREATE INDEX "idx_renewals_status" ON "public"."renewals" USING "btree" ("status");



CREATE INDEX "idx_ro_deadline_date" ON "public"."return_of_obligations" USING "btree" ("deadline_date");



CREATE INDEX "idx_ro_department_assigned" ON "public"."return_of_obligations" USING "btree" ("department_assigned");



CREATE INDEX "idx_ro_scholar_id" ON "public"."return_of_obligations" USING "btree" ("scholar_id");



CREATE INDEX "idx_ro_status" ON "public"."return_of_obligations" USING "btree" ("ro_status");



CREATE INDEX "idx_scholar_logs_scholar_id" ON "public"."scholar_activity_logs" USING "btree" ("scholar_id");



CREATE INDEX "idx_scholars_academic_year_id" ON "public"."scholars" USING "btree" ("academic_year_id");



CREATE INDEX "idx_scholars_active" ON "public"."scholars" USING "btree" ("scholar_id") WHERE (("status")::"text" = 'Active'::"text");



CREATE INDEX "idx_scholars_period_id" ON "public"."scholars" USING "btree" ("period_id");



CREATE INDEX "idx_scholars_program_id" ON "public"."scholars" USING "btree" ("program_id");



CREATE INDEX "idx_scholars_status" ON "public"."scholars" USING "btree" ("status");



CREATE INDEX "idx_scholars_student_id" ON "public"."scholars" USING "btree" ("student_id");



CREATE INDEX "idx_scholarship_criteria_code" ON "public"."scholarship_criteria" USING "btree" ("scholarship_code");



CREATE INDEX "idx_scholarship_criteria_status" ON "public"."scholarship_criteria" USING "btree" ("status");



CREATE INDEX "idx_sdo_records_active" ON "public"."sdo_records" USING "btree" ("student_id") WHERE (("status")::"text" = 'Active'::"text");



CREATE INDEX "idx_sdo_records_student_id" ON "public"."sdo_records" USING "btree" ("student_id");



CREATE INDEX "idx_student_education_student_id" ON "public"."student_education" USING "btree" ("student_id");



CREATE INDEX "idx_student_family_student_id" ON "public"."student_family" USING "btree" ("student_id");



CREATE INDEX "idx_student_profiles_student_id" ON "public"."student_profiles" USING "btree" ("student_id");



CREATE INDEX "idx_students_account_status" ON "public"."students" USING "btree" ("account_status");



CREATE INDEX "idx_students_active_scholar" ON "public"."students" USING "btree" ("is_active_scholar");



CREATE INDEX "idx_students_course_id" ON "public"."students" USING "btree" ("course_id");



CREATE INDEX "idx_students_gwa_year" ON "public"."students" USING "btree" ("gwa", "year_level");



CREATE INDEX "idx_students_pdm_id" ON "public"."students" USING "btree" ("pdm_id");



CREATE INDEX "idx_students_sdo_status" ON "public"."students" USING "btree" ("sdo_status");



CREATE INDEX "idx_students_user_id" ON "public"."students" USING "btree" ("user_id");



CREATE INDEX "idx_support_tickets_created_at" ON "public"."support_tickets" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_support_tickets_handled_by" ON "public"."support_tickets" USING "btree" ("handled_by");



CREATE INDEX "idx_support_tickets_handler_status" ON "public"."support_tickets" USING "btree" ("handled_by", "status") WHERE (("status")::"text" = ANY ((ARRAY['Open'::character varying, 'In Progress'::character varying])::"text"[]));



CREATE INDEX "idx_support_tickets_status" ON "public"."support_tickets" USING "btree" ("status");



CREATE INDEX "idx_support_tickets_student_id" ON "public"."support_tickets" USING "btree" ("student_id");



CREATE INDEX "idx_trivia_display_date" ON "public"."trivia" USING "btree" ("display_date") WHERE ("is_active" = true);



CREATE INDEX "idx_user_device_tokens_user_id" ON "public"."user_device_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_phone" ON "public"."users" USING "btree" ("phone_number") WHERE ("phone_number" IS NOT NULL);



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE UNIQUE INDEX "uq_academic_course_code_lower" ON "public"."academic_course" USING "btree" ("lower"(("course_code")::"text"));



CREATE UNIQUE INDEX "uq_academic_departments_code_lower" ON "public"."academic_departments" USING "btree" ("lower"(("department_code")::"text"));



CREATE UNIQUE INDEX "uq_academic_years_single_active" ON "public"."academic_years" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "uq_active_application_per_program" ON "public"."applications" USING "btree" ("student_id", "program_id") WHERE (("application_status")::"text" = ANY ((ARRAY['Pending Review'::character varying, 'Interview'::character varying])::"text"[]));



CREATE UNIQUE INDEX "uq_active_base_application_per_student" ON "public"."applications" USING "btree" ("student_id") WHERE (("program_id" IS NULL) AND (("application_status")::"text" = ANY ((ARRAY['Pending Review'::character varying, 'Interview'::character varying])::"text"[])));



CREATE UNIQUE INDEX "uq_program_openings_one_draft_per_benefactor" ON "public"."program_openings" USING "btree" ("program_id") WHERE (("posting_status")::"text" = 'draft'::"text");



CREATE UNIQUE INDEX "uq_renewal_per_period" ON "public"."renewals" USING "btree" ("scholar_id", "period_id");



CREATE UNIQUE INDEX "uq_scholar_per_program_per_year" ON "public"."scholars" USING "btree" ("student_id", "program_id", "academic_year_id") WHERE (("status")::"text" = 'Active'::"text");



CREATE UNIQUE INDEX "uq_scholars_application_id" ON "public"."scholars" USING "btree" ("application_id");



CREATE OR REPLACE TRIGGER "trg_application_form_drafts_updated_at" BEFORE UPDATE ON "public"."application_form_drafts" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "trg_archive_applications_on_opening" AFTER UPDATE ON "public"."program_openings" FOR EACH ROW EXECUTE FUNCTION "public"."archive_applications_on_opening"();



CREATE OR REPLACE TRIGGER "trg_fix_null_amount" BEFORE INSERT OR UPDATE ON "public"."program_openings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_null_per_scholar"();



CREATE OR REPLACE TRIGGER "trg_payout_batch_scholars_updated_at" BEFORE UPDATE ON "public"."payout_batch_scholars" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payout_batches_updated_at" BEFORE UPDATE ON "public"."payout_batches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_single_active_period" BEFORE INSERT OR UPDATE OF "is_active" ON "public"."academic_period" FOR EACH ROW WHEN (("new"."is_active" = true)) EXECUTE FUNCTION "public"."enforce_single_active_period"();



CREATE OR REPLACE TRIGGER "trg_sync_active_scholar" AFTER INSERT OR UPDATE OF "status" ON "public"."scholars" FOR EACH ROW EXECUTE FUNCTION "public"."sync_student_active_scholar"();



CREATE OR REPLACE TRIGGER "trg_sync_sdo_status" AFTER INSERT OR UPDATE OF "status" ON "public"."sdo_records" FOR EACH ROW EXECUTE FUNCTION "public"."sync_student_sdo_status"();



CREATE OR REPLACE TRIGGER "trg_update_benefactors" BEFORE UPDATE ON "public"."benefactors" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "trg_validate_payout_batches_period_year" BEFORE INSERT OR UPDATE OF "academic_year_id", "period_id" ON "public"."payout_batches" FOR EACH ROW EXECUTE FUNCTION "public"."validate_period_matches_academic_year"();



ALTER TABLE ONLY "public"."academic_course"
    ADD CONSTRAINT "academic_course_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."academic_departments"("department_id");



ALTER TABLE ONLY "public"."academic_period"
    ADD CONSTRAINT "academic_period_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academic_period"
    ADD CONSTRAINT "academic_period_activated_by_fkey" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_document_reviews"
    ADD CONSTRAINT "application_document_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("application_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."students"("student_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_form_drafts"
    ADD CONSTRAINT "application_form_drafts_opening_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "public"."program_openings"("opening_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_form_drafts"
    ADD CONSTRAINT "application_form_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_education_id_fkey" FOREIGN KEY ("education_id") REFERENCES "public"."student_education"("education_id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "public"."admin_profiles"("admin_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."student_family"("family_id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_opening_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "public"."program_openings"("opening_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."student_profiles"("profile_id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."scholarship_program"("program_id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."benefactor_contacts"
    ADD CONSTRAINT "benefactor_contacts_benefactor_id_fkey" FOREIGN KEY ("benefactor_id") REFERENCES "public"."scholarship_program"("program_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_members"
    ADD CONSTRAINT "chat_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("room_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_members"
    ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_room_members"
    ADD CONSTRAINT "chat_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("room_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_room_members"
    ADD CONSTRAINT "chat_room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."criteria_year_levels"
    ADD CONSTRAINT "criteria_year_levels_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "public"."scholarship_criteria"("criteria_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ocr_extracted_documents"
    ADD CONSTRAINT "documents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academic_course"
    ADD CONSTRAINT "fk_academic_course_department" FOREIGN KEY ("department_id") REFERENCES "public"."academic_departments"("department_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "fk_appdoc_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("application_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_education"
    ADD CONSTRAINT "fk_education_student" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_family"
    ADD CONSTRAINT "fk_family_student" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_attachments"
    ADD CONSTRAINT "fk_payout_attachments_batch" FOREIGN KEY ("payout_batch_id") REFERENCES "public"."payout_batches"("payout_batch_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_attachments"
    ADD CONSTRAINT "fk_payout_attachments_entry" FOREIGN KEY ("payout_entry_id") REFERENCES "public"."payout_batch_scholars"("payout_entry_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_batch_scholars"
    ADD CONSTRAINT "fk_payout_batch_scholars_batch" FOREIGN KEY ("payout_batch_id") REFERENCES "public"."payout_batches"("payout_batch_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_batch_scholars"
    ADD CONSTRAINT "fk_payout_batch_scholars_scholar" FOREIGN KEY ("scholar_id") REFERENCES "public"."scholars"("scholar_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payout_batches"
    ADD CONSTRAINT "fk_payout_batches_opening" FOREIGN KEY ("opening_id") REFERENCES "public"."program_openings"("opening_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payout_batches"
    ADD CONSTRAINT "fk_payout_batches_program" FOREIGN KEY ("program_id") REFERENCES "public"."scholarship_program"("program_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payout_batch_scholars"
    ADD CONSTRAINT "fk_payout_entry_batch" FOREIGN KEY ("payout_batch_id") REFERENCES "public"."payout_batches"("payout_batch_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_batch_scholars"
    ADD CONSTRAINT "fk_payout_entry_scholar" FOREIGN KEY ("scholar_id") REFERENCES "public"."scholars"("scholar_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payout_history"
    ADD CONSTRAINT "fk_payout_history_batch" FOREIGN KEY ("payout_batch_id") REFERENCES "public"."payout_batches"("payout_batch_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payout_history"
    ADD CONSTRAINT "fk_payout_history_entry" FOREIGN KEY ("payout_entry_id") REFERENCES "public"."payout_batch_scholars"("payout_entry_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payout_history"
    ADD CONSTRAINT "fk_payout_history_scholar" FOREIGN KEY ("scholar_id") REFERENCES "public"."scholars"("scholar_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scholarship_program"
    ADD CONSTRAINT "fk_program_benefactor" FOREIGN KEY ("benefactor_id") REFERENCES "public"."benefactors"("benefactor_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."return_of_obligations"
    ADD CONSTRAINT "fk_ro_scholar" FOREIGN KEY ("scholar_id") REFERENCES "public"."scholars"("scholar_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."admin_profiles"("admin_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."academic_period"("period_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("application_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("room_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mobile_sessions"
    ADD CONSTRAINT "mobile_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_batches"
    ADD CONSTRAINT "payout_batches_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id");



ALTER TABLE ONLY "public"."payout_batches"
    ADD CONSTRAINT "payout_batches_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."academic_period"("period_id");



ALTER TABLE ONLY "public"."payout_history"
    ADD CONSTRAINT "payout_history_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payout_history"
    ADD CONSTRAINT "payout_history_scholar_id_fkey" FOREIGN KEY ("scholar_id") REFERENCES "public"."scholars"("scholar_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_openings"
    ADD CONSTRAINT "program_openings_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id");



ALTER TABLE ONLY "public"."program_openings"
    ADD CONSTRAINT "program_openings_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."scholarship_program"("program_id");



ALTER TABLE ONLY "public"."renewal_documents"
    ADD CONSTRAINT "renewal_documents_renewal_id_fkey" FOREIGN KEY ("renewal_id") REFERENCES "public"."renewals"("renewal_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."renewals"
    ADD CONSTRAINT "renewals_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."academic_period"("period_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."renewals"
    ADD CONSTRAINT "renewals_scholar_id_fkey" FOREIGN KEY ("scholar_id") REFERENCES "public"."scholars"("scholar_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scholar_activity_logs"
    ADD CONSTRAINT "scholar_activity_logs_scholar_id_fkey" FOREIGN KEY ("scholar_id") REFERENCES "public"."scholars"("scholar_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scholars"
    ADD CONSTRAINT "scholars_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("academic_year_id");



ALTER TABLE ONLY "public"."scholars"
    ADD CONSTRAINT "scholars_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("application_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."scholars"
    ADD CONSTRAINT "scholars_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."academic_period"("period_id");



ALTER TABLE ONLY "public"."scholars"
    ADD CONSTRAINT "scholars_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."scholarship_program"("program_id");



ALTER TABLE ONLY "public"."scholars"
    ADD CONSTRAINT "scholars_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sdo_records"
    ADD CONSTRAINT "sdo_records_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sdo_records"
    ADD CONSTRAINT "sdo_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id");



ALTER TABLE ONLY "public"."student_registry"
    ADD CONSTRAINT "student_registry_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."academic_course"("course_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."academic_course"("course_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "public"."admin_profiles"("admin_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_device_tokens"
    ADD CONSTRAINT "user_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE "public"."academic_course" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academic_course_admin_all" ON "public"."academic_course" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "academic_course_read" ON "public"."academic_course" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("is_archived" = false)));



ALTER TABLE "public"."academic_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academic_period" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academic_period_admin_all" ON "public"."academic_period" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "academic_period_read_active" ON "public"."academic_period" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("is_active" = true)));



ALTER TABLE "public"."admin_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_profiles_admin_all" ON "public"."admin_profiles" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "announcements_admin_all" ON "public"."announcements" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "announcements_authenticated_read" ON "public"."announcements" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("status")::"text" = 'Published'::"text")));



CREATE POLICY "announcements_benefactor_insert" ON "public"."announcements" FOR INSERT WITH CHECK (((("public"."get_my_role"())::"text" = 'Benefactor'::"text") AND ("author_id" = "auth"."uid"())));



CREATE POLICY "announcements_benefactor_update_own" ON "public"."announcements" FOR UPDATE USING (((("public"."get_my_role"())::"text" = 'Benefactor'::"text") AND ("author_id" = "auth"."uid"()) AND (("status")::"text" = 'Draft'::"text"))) WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."application_document_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "applications_admin_all" ON "public"."applications" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "applications_student_insert" ON "public"."applications" FOR INSERT WITH CHECK ((("student_id" = "public"."get_my_student_id"()) AND (("public"."get_my_role"())::"text" = 'Student'::"text")));



CREATE POLICY "applications_student_select" ON "public"."applications" FOR SELECT USING (("student_id" = "public"."get_my_student_id"()));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_admin_read" ON "public"."audit_logs" FOR SELECT USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "audit_logs_insert_all" ON "public"."audit_logs" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."benefactor_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."benefactors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."benefactors_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "benefactors_config_admin_all" ON "public"."benefactors_config" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "benefactors_config_self_all" ON "public"."benefactors_config" USING (("benefactor_id" = "public"."get_my_benefactor_id"()));



ALTER TABLE "public"."criteria_year_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "criteria_year_levels_admin_all" ON "public"."criteria_year_levels" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "criteria_year_levels_read" ON "public"."criteria_year_levels" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."faqs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "faqs_admin_all" ON "public"."faqs" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "faqs_public_read" ON "public"."faqs" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."generated_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "generated_reports_admin_all" ON "public"."generated_reports" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



ALTER TABLE "public"."interviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "interviews_admin_all" ON "public"."interviews" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "interviews_student_read" ON "public"."interviews" FOR SELECT USING (("application_id" IN ( SELECT "applications"."application_id"
   FROM "public"."applications"
  WHERE ("applications"."student_id" = "public"."get_my_student_id"()))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_admin_all" ON "public"."messages" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "messages_user_insert" ON "public"."messages" FOR INSERT WITH CHECK (("sender_id" = "auth"."uid"()));



CREATE POLICY "messages_user_select" ON "public"."messages" FOR SELECT USING ((("sender_id" = "auth"."uid"()) OR ("receiver_id" = "auth"."uid"()) OR ("receiver_id" IS NULL)));



CREATE POLICY "messages_user_update_read" ON "public"."messages" FOR UPDATE USING (("receiver_id" = "auth"."uid"())) WITH CHECK (("receiver_id" = "auth"."uid"()));



ALTER TABLE "public"."mobile_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mobile_sessions_admin_read" ON "public"."mobile_sessions" FOR SELECT USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "mobile_sessions_self_all" ON "public"."mobile_sessions" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_admin_all" ON "public"."notifications" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "notifications_user_select" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_user_update_read" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ocr_extracted_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payout_admin_all" ON "public"."payout_history" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



ALTER TABLE "public"."payout_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payout_student_read" ON "public"."payout_history" FOR SELECT USING (("scholar_id" IN ( SELECT "scholars"."scholar_id"
   FROM "public"."scholars"
  WHERE ("scholars"."student_id" = "public"."get_my_student_id"()))));



ALTER TABLE "public"."program_openings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "program_requirements_admin_all" ON "public"."program_requirements" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



ALTER TABLE "public"."renewal_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."renewals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "renewals_admin_all" ON "public"."renewals" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "renewals_student_read" ON "public"."renewals" FOR SELECT USING (("scholar_id" IN ( SELECT "scholars"."scholar_id"
   FROM "public"."scholars"
  WHERE ("scholars"."student_id" = "public"."get_my_student_id"()))));



ALTER TABLE "public"."return_of_obligations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ro_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scholar_activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scholars" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scholars_admin_all" ON "public"."scholars" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "scholars_student_read" ON "public"."scholars" FOR SELECT USING (("student_id" = "public"."get_my_student_id"()));



ALTER TABLE "public"."scholarship_criteria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scholarship_criteria_admin_all" ON "public"."scholarship_criteria" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "scholarship_criteria_public_read" ON "public"."scholarship_criteria" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("status")::"text" = 'Published'::"text") AND ("is_archived" = false)));



ALTER TABLE "public"."scholarship_program" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sdo_admin_all" ON "public"."sdo_records" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



ALTER TABLE "public"."sdo_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sdo_student_read" ON "public"."sdo_records" FOR SELECT USING (("student_id" = "public"."get_my_student_id"()));



ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "students_admin_all" ON "public"."students" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "students_benefactor_read" ON "public"."students" FOR SELECT USING (((("public"."get_my_role"())::"text" = 'Benefactor'::"text") AND (("account_status")::"text" = 'Verified'::"text") AND ("is_archived" = false)));



CREATE POLICY "students_self_select" ON "public"."students" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "students_self_update" ON "public"."students" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_tickets_admin_all" ON "public"."support_tickets" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "support_tickets_student_insert" ON "public"."support_tickets" FOR INSERT WITH CHECK ((("student_id" = "public"."get_my_student_id"()) AND (("public"."get_my_role"())::"text" = 'Student'::"text")));



CREATE POLICY "support_tickets_student_select" ON "public"."support_tickets" FOR SELECT USING (("student_id" = "public"."get_my_student_id"()));



CREATE POLICY "support_tickets_student_update" ON "public"."support_tickets" FOR UPDATE USING ((("student_id" = "public"."get_my_student_id"()) AND (("status")::"text" = 'Open'::"text"))) WITH CHECK (("student_id" = "public"."get_my_student_id"()));



ALTER TABLE "public"."trivia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trivia_admin_all" ON "public"."trivia" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "trivia_public_read" ON "public"."trivia" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_admin_all" ON "public"."users" USING ((("public"."get_my_role"())::"text" = 'Admin'::"text"));



CREATE POLICY "users_self_select" ON "public"."users" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_self_update" ON "public"."users" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."archive_applications_on_opening"() TO "anon";
GRANT ALL ON FUNCTION "public"."archive_applications_on_opening"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_applications_on_opening"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_single_active_period"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_single_active_period"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_single_active_period"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_admin_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_admin_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_admin_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_benefactor_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_benefactor_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_benefactor_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_student_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_student_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_student_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_null_per_scholar"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_null_per_scholar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_null_per_scholar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_student_active_scholar"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_student_active_scholar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_student_active_scholar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_student_sdo_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_student_sdo_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_student_sdo_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_period_matches_academic_year"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_period_matches_academic_year"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_period_matches_academic_year"() TO "service_role";


















GRANT ALL ON TABLE "public"."academic_course" TO "anon";
GRANT ALL ON TABLE "public"."academic_course" TO "authenticated";
GRANT ALL ON TABLE "public"."academic_course" TO "service_role";



GRANT ALL ON TABLE "public"."academic_departments" TO "anon";
GRANT ALL ON TABLE "public"."academic_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."academic_departments" TO "service_role";



GRANT ALL ON TABLE "public"."academic_period" TO "anon";
GRANT ALL ON TABLE "public"."academic_period" TO "authenticated";
GRANT ALL ON TABLE "public"."academic_period" TO "service_role";



GRANT ALL ON TABLE "public"."academic_years" TO "anon";
GRANT ALL ON TABLE "public"."academic_years" TO "authenticated";
GRANT ALL ON TABLE "public"."academic_years" TO "service_role";



GRANT ALL ON TABLE "public"."admin_profiles" TO "anon";
GRANT ALL ON TABLE "public"."admin_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."application_document_reviews" TO "anon";
GRANT ALL ON TABLE "public"."application_document_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."application_document_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."application_documents" TO "anon";
GRANT ALL ON TABLE "public"."application_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."application_documents" TO "service_role";



GRANT ALL ON TABLE "public"."application_form_drafts" TO "anon";
GRANT ALL ON TABLE "public"."application_form_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."application_form_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."benefactor_contacts" TO "anon";
GRANT ALL ON TABLE "public"."benefactor_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."benefactor_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."benefactors" TO "anon";
GRANT ALL ON TABLE "public"."benefactors" TO "authenticated";
GRANT ALL ON TABLE "public"."benefactors" TO "service_role";



GRANT ALL ON TABLE "public"."benefactors_config" TO "anon";
GRANT ALL ON TABLE "public"."benefactors_config" TO "authenticated";
GRANT ALL ON TABLE "public"."benefactors_config" TO "service_role";



GRANT ALL ON TABLE "public"."chat_members" TO "anon";
GRANT ALL ON TABLE "public"."chat_members" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_members" TO "service_role";



GRANT ALL ON TABLE "public"."chat_room_members" TO "anon";
GRANT ALL ON TABLE "public"."chat_room_members" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_room_members" TO "service_role";



GRANT ALL ON TABLE "public"."chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."criteria_year_levels" TO "anon";
GRANT ALL ON TABLE "public"."criteria_year_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."criteria_year_levels" TO "service_role";



GRANT ALL ON TABLE "public"."faqs" TO "anon";
GRANT ALL ON TABLE "public"."faqs" TO "authenticated";
GRANT ALL ON TABLE "public"."faqs" TO "service_role";



GRANT ALL ON TABLE "public"."generated_reports" TO "anon";
GRANT ALL ON TABLE "public"."generated_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_reports" TO "service_role";



GRANT ALL ON TABLE "public"."interviews" TO "anon";
GRANT ALL ON TABLE "public"."interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."interviews" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."mobile_sessions" TO "anon";
GRANT ALL ON TABLE "public"."mobile_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."mobile_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."ocr_extracted_documents" TO "anon";
GRANT ALL ON TABLE "public"."ocr_extracted_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."ocr_extracted_documents" TO "service_role";



GRANT ALL ON TABLE "public"."payout_attachments" TO "anon";
GRANT ALL ON TABLE "public"."payout_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."payout_batch_scholars" TO "anon";
GRANT ALL ON TABLE "public"."payout_batch_scholars" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_batch_scholars" TO "service_role";



GRANT ALL ON TABLE "public"."payout_batches" TO "anon";
GRANT ALL ON TABLE "public"."payout_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_batches" TO "service_role";



GRANT ALL ON TABLE "public"."payout_history" TO "anon";
GRANT ALL ON TABLE "public"."payout_history" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_history" TO "service_role";



GRANT ALL ON TABLE "public"."program_openings" TO "anon";
GRANT ALL ON TABLE "public"."program_openings" TO "authenticated";
GRANT ALL ON TABLE "public"."program_openings" TO "service_role";



GRANT ALL ON TABLE "public"."program_requirements" TO "anon";
GRANT ALL ON TABLE "public"."program_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."program_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."renewal_documents" TO "anon";
GRANT ALL ON TABLE "public"."renewal_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."renewal_documents" TO "service_role";



GRANT ALL ON TABLE "public"."renewals" TO "anon";
GRANT ALL ON TABLE "public"."renewals" TO "authenticated";
GRANT ALL ON TABLE "public"."renewals" TO "service_role";



GRANT ALL ON TABLE "public"."return_of_obligations" TO "anon";
GRANT ALL ON TABLE "public"."return_of_obligations" TO "authenticated";
GRANT ALL ON TABLE "public"."return_of_obligations" TO "service_role";



GRANT ALL ON TABLE "public"."ro_departments" TO "anon";
GRANT ALL ON TABLE "public"."ro_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."ro_departments" TO "service_role";



GRANT ALL ON TABLE "public"."scholar_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."scholar_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."scholar_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."scholars" TO "anon";
GRANT ALL ON TABLE "public"."scholars" TO "authenticated";
GRANT ALL ON TABLE "public"."scholars" TO "service_role";



GRANT ALL ON TABLE "public"."scholarship_criteria" TO "anon";
GRANT ALL ON TABLE "public"."scholarship_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."scholarship_criteria" TO "service_role";



GRANT ALL ON TABLE "public"."scholarship_program" TO "anon";
GRANT ALL ON TABLE "public"."scholarship_program" TO "authenticated";
GRANT ALL ON TABLE "public"."scholarship_program" TO "service_role";



GRANT ALL ON TABLE "public"."sdo_records" TO "anon";
GRANT ALL ON TABLE "public"."sdo_records" TO "authenticated";
GRANT ALL ON TABLE "public"."sdo_records" TO "service_role";



GRANT ALL ON TABLE "public"."student_education" TO "anon";
GRANT ALL ON TABLE "public"."student_education" TO "authenticated";
GRANT ALL ON TABLE "public"."student_education" TO "service_role";



GRANT ALL ON TABLE "public"."student_family" TO "anon";
GRANT ALL ON TABLE "public"."student_family" TO "authenticated";
GRANT ALL ON TABLE "public"."student_family" TO "service_role";



GRANT ALL ON TABLE "public"."student_profiles" TO "anon";
GRANT ALL ON TABLE "public"."student_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."student_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."student_registry" TO "anon";
GRANT ALL ON TABLE "public"."student_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."student_registry" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."trivia" TO "anon";
GRANT ALL ON TABLE "public"."trivia" TO "authenticated";
GRANT ALL ON TABLE "public"."trivia" TO "service_role";



GRANT ALL ON TABLE "public"."user_device_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_device_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_device_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































