# Application signing integration test plan

Status values in this plan are evidence-based: a contract or unit test is not a
live Supabase or real-device result.

## Safety gate

No write operation or integration test that creates test data may begin until
all of the following are supplied in writing:

1. The Supabase project is explicitly identified as isolated/non-production.
2. Test applicant and reviewer accounts are supplied or created through an
   approved test-data procedure.
3. The project owner approves applying the listed migrations to that isolated
   project.
4. The private Storage bucket name and intended policies are confirmed.

The project owner has confirmed `twehxvixkfgtbaohnnon` as the isolated
development/testing project and `ngqwdetlpsqetbahjvto` as protected. Read-only
preflight still requires separate execution approval; migrations, Storage
operations, and any test-data creation require further approval.

## Phase 5.1 environment gate

Current state: **NEEDS EXECUTION APPROVAL**. Backend and local admin frontend
configuration use the confirmed development reference
`twehxvixkfgtbaohnnon`. The linked CLI and Vercel frontend configuration use
the protected reference `ngqwdetlpsqetbahjvto`; do not use the CLI link, and do
not open that project. Before any approved live command, manually compare the
Dashboard selector or direct database host to the confirmed reference. No
service-role credential may be used to simulate applicant authorization, and
`supabase db reset` is prohibited.

## Required migration order

1. All existing baseline migrations, including
   `20260808083734_add_mobile_onboarding_preferences.sql` and
   `20260808085245_support_legacy_application_document_uploads.sql`, which
   provide/use immutable document-version support.
2. `20261020000000_add_application_signing_sessions.sql`.
3. `20261020000100_add_application_signing_document_corrections.sql`.

Development migration history confirms neither signing migration was recorded.
The correction migration was therefore renamed locally to the unique, later
version `20261020000100`. Apply it only after the session migration; do not
apply them out of logical order merely because the correction function does not
query the session table.

## Isolated-environment preflight

Run read-only checks as a migration-capable administrator and retain output in
the isolated test run record (never include keys):

- Required tables and columns: `users`, `students`, `applications`,
  `application_documents`, `application_document_versions`, and
  `application_document_reviews`, including the current-version, preview, and
  review metadata columns used by the signing migrations.
- Unique constraints: `application_documents(application_id, document_type)`
  and `application_document_reviews(application_id, document_key)`.
- Signing table RLS enabled and grants restricted to `service_role`.
- Both signing RPCs exist only after their migrations, are `SECURITY DEFINER`,
  have fixed `search_path`, and have execute revoked from `public`, `anon`, and
  `authenticated`.
- The configured `SUPABASE_APPLICATION_DOCUMENT_BUCKET` exists, is private,
  and does not give anon/authenticated users broad `storage.objects` read,
  insert, update, or delete access.
- Backend service-role access can upload/remove objects and issue signed URLs;
  browser/mobile clients can use only backend-issued signed URLs.

## Reviewed development-only migration execution plan

Status: **WAITING FOR EXPLICIT APPROVAL.** The existing Supabase CLI link
targets protected `ngqwdetlpsqetbahjvto` and must not be used.

1. In the Dashboard SQL Editor, manually verify project reference
   `twehxvixkfgtbaohnnon`.
2. Retain the read-only preflight record: document tables exist, `documents` is
   private with no object policies, and no signing migration/table/RPC exists.
3. Apply `20261020000000_add_application_signing_sessions.sql` only.
4. Run the read-only table/RPC/RLS/grant checks. Stop if the table/RPCs or their
   service-role-only grants differ from the reviewed migration.
5. Apply `20261020000100_add_application_signing_document_corrections.sql`.
6. Apply `20261020000200_add_atomic_application_signing_submission.sql`.
7. Re-run function/grant and document-version/review-constraint checks, then
   execute the integration matrix with synthetic accounts only.

Do not use `supabase db push`, `supabase db reset`, migration repair, or the
protected project. The plan is deliberately stopped before step 3 pending
explicit approval.

## Submission atomicity remediation gate

**BLOCKED before end-to-end integration.** Source review found that the mobile
backend creates or updates the application and its required-document slots in
separate requests before it calls `finalize_application_signing_session`. This
does not meet the required atomic submission boundary. Before considering the
workflow integration-ready, design an additive RPC/transaction that performs
the existing application creation/update rules and signing finalization in one
database transaction, then add a rollback test proving no application or
document slots remain after signing finalization fails.

Phase 5.4 prepares that additive transaction as
`submit_application_with_signing`. It serializes one applicant/opening with an
advisory transaction lock; owns/locks the active application; creates missing
legacy document slots with conflict-safe inserts; invokes the existing signing
finalizer; inserts/reuses the endorsement; updates the student pointer; and,
for edits, resets the application-form review in the same transaction. Any
exception rolls back all of those database writes. Signing Storage uploads stay
outside the transaction and must complete before submission. Live rollback and
concurrency verification remains required.

## Phase 5.5 standalone development preflight queries

Run each statement independently in the SQL Editor only after manually
confirming `twehxvixkfgtbaohnnon`. Every statement is metadata-only or returns
a boolean aggregate; none selects applicant rows, document contents, paths, or
credentials. Do not run the conditional migration-history query until the
history-column query confirms the requested columns exist.

```sql
-- 1. Required relation existence and RLS state.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'users', 'students', 'applications', 'application_documents',
  'application_document_versions', 'application_document_reviews',
  'endorsement_slips'
)
order by c.relname;

-- 2. Required baseline column names/types/nullability only.
select table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in (
  'students', 'applications', 'application_documents',
  'application_document_versions', 'application_document_reviews',
  'endorsement_slips'
)
order by table_name, ordinal_position;

-- 3. Constraint definitions, including the two required ON CONFLICT keys.
select c.relname as table_name, pc.conname, pc.contype,
       pg_get_constraintdef(pc.oid) as definition
from pg_constraint pc
join pg_class c on c.oid = pc.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'applications', 'application_documents', 'application_document_versions',
  'application_document_reviews', 'endorsement_slips'
)
order by c.relname, pc.conname;

-- 4. Index definitions. Require unique application_documents(application_id,
-- document_type) and application_document_reviews(application_id, document_key).
select c.relname as table_name, i.indexrelid::regclass as index_name,
       i.indisunique, pg_get_indexdef(i.indexrelid) as definition
from pg_index i
join pg_class c on c.oid = i.indrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'applications', 'application_documents', 'application_document_versions',
  'application_document_reviews', 'endorsement_slips'
)
order by c.relname, index_name::text;

-- 5. Existing document-version trigger metadata.
select c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'application_documents'
  and not t.tgisinternal
order by t.tgname;

-- 6. Required baseline helper functions and PostgreSQL primitives.
select to_regprocedure('public.finalize_application_document_upload(uuid,uuid,uuid,text,text,text,text,bigint)') as finalize_document_upload,
       to_regprocedure('public.ensure_submitted_document_has_version()') as document_version_trigger,
       to_regprocedure('gen_random_uuid()') as uuid_generator,
       to_regprocedure('hashtextextended(text,bigint)') as advisory_hash,
       to_regprocedure('pg_advisory_xact_lock(bigint)') as advisory_lock;

-- 7. Storage metadata and policies only; no objects or paths.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'documents';

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 8. Boolean-only duplicate checks for conflict keys and version safety.
select exists (
  select 1 from public.applications
  where coalesce(is_archived, false) = false
  group by student_id, opening_id having count(*) > 1
) as duplicate_active_application;

select exists (
  select 1 from public.application_documents
  group by application_id, document_type having count(*) > 1
) as duplicate_application_document_key;

select exists (
  select 1 from public.application_document_reviews
  group by application_id, document_key having count(*) > 1
) as duplicate_review_key;

select exists (
  select 1 from public.application_document_versions
  group by document_id, version_number having count(*) > 1
) as duplicate_document_version;

-- 9. Learn migration-history shape before querying its values.
select column_name, data_type
from information_schema.columns
where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
order by ordinal_position;
```

If `schema_migrations` exposes `version` and `name`, run this separately:

```sql
select version, name
from supabase_migrations.schema_migrations
where version in ('20261020000000', '20261020000100', '20261020000200')
   or name like '%application_signing%'
order by version;
```

Expected preflight result: all required base tables/columns/functions and both
unique conflict keys exist; duplicate booleans are false; `documents` is private
with no broad browser policy; and none of the three signing migrations is
recorded. A missing column/key/function, duplicate boolean true, public bucket,
or unexpected Storage policy is a blocker. Catalog, Storage, and migration
history queries can require the Dashboard administrative SQL role; permission
errors are BLOCKED, never a reason to grant browser roles more access.

## Test matrix

| Area | Test | Expected evidence | Current status |
| --- | --- | --- | --- |
| Session | Create as applicant A | Owned draft/ready session, 24-hour expiry | BLOCKED live |
| Session | Upload student/guardian PNG and guardian ID | Magic bytes, type limits, generated private path | BLOCKED live; contract coverage exists |
| Submission | Finalize with exact form hash | One application binding and three pending document versions | BLOCKED live |
| Preview | Applicant/admin preview | Short-lived signed URL; no path in API/browser payload | BLOCKED live; source/contract coverage exists |
| Review | Admin requests re-upload with reason | Target row becomes `reupload_required`; reason visible only to owner/admin | BLOCKED live |
| Correction | Applicant A replaces requested document | New version, old version retained, current row/review become `pending` | BLOCKED live |
| Review | Admin verifies corrected latest version | Admin sees current version and can set verified | BLOCKED live |
| Negative | Applicant B reads/replaces A's session/document | 403/404 and no URL/object disclosure | BLOCKED live |
| Negative | Invalid bytes/oversize/wrong type | 400/413, no persisted document version | BLOCKED live |
| Negative | Correction without request/for verified document | 409, no new version/object retained | BLOCKED live |
| Negative | Expired/reused/hash-mismatched session | 409, no duplicate application/documents | BLOCKED live |
| Concurrency | Two correction submissions for one document | Exactly one new version; losing request fails and uploads are cleaned up | BLOCKED live |
| Flutter | Canvas PNG, camera/gallery, retry/expiry UI | Tested on Android device plus backend confirmation | NOT RUN; no device available |
| Admin | Reviewer RBAC and latest-version preview | Admin role/permission checks and signed URL route | BLOCKED live; contract coverage exists |
| Regression | Five legacy requirements | Counts and verification gate unchanged with signing docs present | BLOCKED live; source/contract coverage exists |

## Executable integration sequence after approval

Each numbered operation uses a new synthetic applicant/session/document record
and records only generated test identifiers in the test report.

1. Authenticate applicant A through the mobile backend; create a signing
   session with a deterministic valid form payload and guardian metadata.
2. Upload minimal valid PNG fixtures for student and guardian signatures and a
   valid image/PDF fixture for guardian ID. Assert the session becomes complete
   and returned payloads contain signed URLs but no object paths.
3. Submit the form using that exact session. Query as an authorized reviewer to
   confirm three signing rows and version 1 for each.
4. As an authorized document reviewer, set one signing document to
   `reupload_required` with a non-empty reason. Assert applicant A sees only
   that correction task and reason.
5. As applicant A, replace the requested evidence. Assert version 2 is current,
   version 1 remains, and both document/review states are `pending`.
6. As the reviewer, preview and verify version 2. Assert the admin view reports
   the current version and applicant correction action is no longer available.
7. Repeat negative cases with applicant B, malformed bytes, oversized files,
   verified/non-requested documents, expired/mismatched/reused sessions, direct
   object access, and two concurrent correction attempts.
8. Verify the five legacy document counters and review gate before and after
   signing corrections. Perform scoped cleanup only after recorded evidence is
   complete.

## Test data and cleanup

Use unique, non-real applicant/guardian information and synthetic ID images.
Record application/session/document/version UUIDs in the isolated test report.
After approval, remove only those explicit test rows and objects through a
reviewed cleanup script; never run a broad Storage or database reset.

## Phase 5.6 consolidated outstanding compatibility preflight

Run this one **read-only** batch only after visually confirming the SQL Editor
is set to development project `twehxvixkfgtbaohnnon`. It reads catalogs and
the bucket definition only; it does not return applicant rows, Storage object
paths, object contents, or credentials. `READ ONLY` prevents writes but does
not itself prove the dashboard project selection.

```sql
begin read only;

with expected_columns(table_name, column_name, allowed_types) as (
  values
    ('students','student_id',array['uuid']::text[]),
    ('students','user_id',array['uuid']::text[]),
    ('students','is_archived',array['bool']::text[]),
    ('students','is_profile_complete',array['bool']::text[]),
    ('students','current_application_id',array['uuid']::text[]),
    ('students','current_program_id',array['uuid']::text[]),
    ('students','gwa',array['numeric']::text[]),
    ('students','updated_at',array['timestamptz']::text[]),
    ('applications','application_id',array['uuid']::text[]),
    ('applications','student_id',array['uuid']::text[]),
    ('applications','opening_id',array['uuid']::text[]),
    ('applications','program_id',array['uuid']::text[]),
    ('applications','application_payload',array['jsonb']::text[]),
    ('applications','application_status',array['text','varchar']::text[]),
    ('applications','document_status',array['text','varchar']::text[]),
    ('applications','verification_status',array['text','varchar']::text[]),
    ('applications','is_archived',array['bool']::text[]),
    ('applications','is_disqualified',array['bool']::text[]),
    ('applications','rejection_reason',array['text','varchar']::text[]),
    ('applications','requirements_verified_at',array['timestamptz']::text[]),
    ('applications','updated_at',array['timestamptz']::text[]),
    ('application_documents','document_id',array['uuid']::text[]),
    ('application_documents','application_id',array['uuid']::text[]),
    ('application_documents','uploaded_by',array['uuid']::text[]),
    ('application_documents','document_type',array['text','varchar']::text[]),
    ('application_documents','is_submitted',array['bool']::text[]),
    ('application_documents','file_path',array['text','varchar']::text[]),
    ('application_documents','file_url',array['text','varchar']::text[]),
    ('application_documents','file_name',array['text','varchar']::text[]),
    ('application_documents','source_type',array['text','varchar']::text[]),
    ('application_documents','ocr',array['jsonb']::text[]),
    ('application_documents','current_version_id',array['uuid']::text[]),
    ('application_documents','review_status',array['text','varchar']::text[]),
    ('application_documents','reviewed_by',array['uuid']::text[]),
    ('application_documents','reviewed_at',array['timestamptz']::text[]),
    ('application_documents','submitted_at',array['timestamptz']::text[]),
    ('application_documents','preview_path',array['text','varchar']::text[]),
    ('application_documents','preview_size_bytes',array['int8']::text[]),
    ('application_documents','preview_created_at',array['timestamptz']::text[]),
    ('application_documents','updated_at',array['timestamptz']::text[]),
    ('application_document_versions','version_id',array['uuid']::text[]),
    ('application_document_versions','document_id',array['uuid']::text[]),
    ('application_document_versions','application_id',array['uuid']::text[]),
    ('application_document_versions','document_type',array['text','varchar']::text[]),
    ('application_document_versions','version_number',array['int4']::text[]),
    ('application_document_versions','file_path',array['text','varchar']::text[]),
    ('application_document_versions','file_url',array['text','varchar']::text[]),
    ('application_document_versions','file_name',array['text','varchar']::text[]),
    ('application_document_versions','content_sha256',array['text','varchar']::text[]),
    ('application_document_versions','file_size_bytes',array['int8']::text[]),
    ('application_document_versions','legacy_unhashed',array['bool']::text[]),
    ('application_document_versions','created_by',array['uuid']::text[]),
    ('application_document_reviews','application_id',array['uuid']::text[]),
    ('application_document_reviews','document_key',array['text','varchar']::text[]),
    ('application_document_reviews','document_name',array['text','varchar']::text[]),
    ('application_document_reviews','review_status',array['text','varchar']::text[]),
    ('application_document_reviews','admin_comment',array['text','varchar']::text[]),
    ('application_document_reviews','issue_severity',array['text','varchar']::text[]),
    ('application_document_reviews','reason_code',array['text','varchar']::text[]),
    ('application_document_reviews','reviewed_by',array['uuid']::text[]),
    ('application_document_reviews','reviewed_at',array['timestamptz']::text[]),
    ('application_document_reviews','updated_at',array['timestamptz']::text[]),
    ('endorsement_slips','slip_id',array['uuid']::text[]),
    ('endorsement_slips','application_id',array['uuid']::text[]),
    ('endorsement_slips','student_id',array['uuid']::text[]),
    ('endorsement_slips','opening_id',array['uuid']::text[]),
    ('endorsement_slips','current_stage',array['text','varchar']::text[]),
    ('endorsement_slips','overall_status',array['text','varchar']::text[])
),
column_result as (
  select e.table_name, count(*) expected_count,
    count(c.column_name) filter (where c.udt_name = any(e.allowed_types)) matching_count,
    array_agg(e.column_name order by e.column_name)
      filter (where c.column_name is null or not (c.udt_name = any(e.allowed_types))) mismatches
  from expected_columns e
  left join information_schema.columns c on c.table_schema='public'
    and c.table_name=e.table_name and c.column_name=e.column_name
  group by e.table_name
),
index_result as (
  select
    exists (select 1 from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='application_documents' and i.indisunique and regexp_replace(pg_get_indexdef(i.indexrelid),'\\s+','','g') like '%(application_id,document_type)%') document_key,
    exists (select 1 from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='application_document_reviews' and i.indisunique and regexp_replace(pg_get_indexdef(i.indexrelid),'\\s+','','g') like '%(application_id,document_key)%') review_key,
    exists (select 1 from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='application_document_versions' and i.indisunique and regexp_replace(pg_get_indexdef(i.indexrelid),'\\s+','','g') like '%(document_id,version_number)%') version_key,
    exists (select 1 from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='endorsement_slips' and i.indisunique and regexp_replace(pg_get_indexdef(i.indexrelid),'\\s+','','g') like '%(application_id)%') endorsement_key
),
fk_result as (
  select
    exists(select 1 from pg_constraint where contype='f' and conrelid='public.applications'::regclass and confrelid='public.students'::regclass) application_student_fk,
    exists(select 1 from pg_constraint where contype='f' and conrelid='public.application_documents'::regclass and confrelid='public.applications'::regclass) document_application_fk,
    exists(select 1 from pg_constraint where contype='f' and conrelid='public.application_document_versions'::regclass and confrelid='public.application_documents'::regclass) version_document_fk
),
posture as (
  select
    coalesce((select relrowsecurity from pg_class where oid=to_regclass('storage.objects')),false) storage_rls,
    (select coalesce(bool_and(not public),false) from storage.buckets where id='documents') documents_private,
    (select count(*) from pg_policies where schemaname='storage' and tablename='objects') storage_policy_count,
    to_regprocedure('gen_random_uuid()') is not null uuid_fn,
    to_regprocedure('hashtextextended(text,bigint)') is not null hash_fn,
    to_regprocedure('pg_advisory_xact_lock(bigint)') is not null lock_fn
)
select 'columns:' || table_name requirement,
  case when matching_count=expected_count then 'PASS' else 'FAIL' end status,
  jsonb_build_object('expected',expected_count,'matching',matching_count,'mismatches',mismatches) evidence
from column_result
union all select 'unique:application_documents(application_id,document_type)',case when document_key then 'PASS' else 'FAIL' end,null from index_result
union all select 'unique:application_document_reviews(application_id,document_key)',case when review_key then 'PASS' else 'FAIL' end,null from index_result
union all select 'unique:application_document_versions(document_id,version_number)',case when version_key then 'PASS' else 'FAIL' end,null from index_result
union all select 'unique:endorsement_slips(application_id)',case when endorsement_key then 'PASS' else 'REVIEW' end,null from index_result
union all select 'fk:applications->students',case when application_student_fk then 'PASS' else 'REVIEW' end,null from fk_result
union all select 'fk:application_documents->applications',case when document_application_fk then 'PASS' else 'REVIEW' end,null from fk_result
union all select 'fk:application_document_versions->application_documents',case when version_document_fk then 'PASS' else 'REVIEW' end,null from fk_result
union all select 'function:gen_random_uuid()',case when uuid_fn then 'PASS' else 'FAIL' end,null from posture
union all select 'function:hashtextextended(text,bigint)',case when hash_fn then 'PASS' else 'FAIL' end,null from posture
union all select 'function:pg_advisory_xact_lock(bigint)',case when lock_fn then 'PASS' else 'FAIL' end,null from posture
union all select 'storage:documents private',case when documents_private then 'PASS' else 'FAIL' end,null from posture
union all select 'storage.objects RLS enabled',case when storage_rls then 'PASS' else 'FAIL' end,null from posture
union all select 'storage.objects policy count (default deny expected)',case when storage_policy_count=0 then 'PASS' else 'REVIEW' end,jsonb_build_object('policy_count',storage_policy_count) from posture
order by 1;

commit;
```

Every `columns:*`, required unique key, required function, and Storage
privacy/RLS result must be `PASS`. The endorsement uniqueness and foreign-key
rows are `REVIEW` rather than automatically failing because existing baseline
schemas can enforce the equivalent invariant differently; capture definitions
before proceeding. A permissions error is `BLOCKED`, never a reason to broaden
application/browser access.

## Phase 5.6 development-only migration checklist

1. Visually confirm SQL Editor project `twehxvixkfgtbaohnnon`; abort if it is
   absent or different. Do not use the repository CLI link.
2. Run the consolidated query and resolve every `FAIL`; document every `REVIEW`.
3. Reconfirm migration history contains none of `20261020000000`,
   `20261020000100`, and `20261020000200`. Stop for reconciliation if it does.
4. Take an approved development-only snapshot; apply exactly one migration at a
   time in the required order. Never target the protected project.
5. After each migration, verify only its catalog metadata: relation/function
   presence, function signature, `prosecdef`, `proconfig` search path, ACLs,
   table RLS, indexes, and constraints. Confirm `PUBLIC`, `anon`, and
   `authenticated` lack RPC execute while `service_role` has it.
6. After all three, confirm the private bucket/default-deny posture remains and
   run the synthetic positive, negative, rollback, and concurrency matrix.
7. On any error, stop. Capture the error and applied history; do not retry,
   repair, reset, or manually roll back without an approved isolated-dev plan.

### Post-migration catalog-only verification

After all three migrations have been applied to the confirmed development
project, run this separate batch before any synthetic applicant test. It is
also read-only and returns no applicant or object data.

```sql
begin read only;

with required_functions(name, identity_args) as (
  values
    ('finalize_application_signing_session', 'p_signing_session_id uuid, p_user_id uuid, p_application_id uuid, p_application_form_hash text, p_uploaded_by uuid, p_created_by uuid'),
    ('replace_application_signing_document', 'p_document_id uuid, p_user_id uuid, p_uploaded_by uuid, p_file_path text, p_file_name text, p_content_sha256 text, p_file_size_bytes bigint'),
    ('submit_application_with_signing', 'p_user_id uuid, p_student_id uuid, p_opening_id uuid, p_program_id uuid, p_application_payload jsonb, p_application_form_hash text, p_signing_session_id uuid, p_edit_existing boolean, p_application_status text, p_document_status text, p_verification_status text, p_gwa numeric')
),
function_rows as (
  select r.name, p.oid, p.prosecdef, p.proconfig,
    exists (
      select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) public_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE') anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') service_role_execute
  from required_functions r
  left join pg_proc p on p.pronamespace = 'public'::regnamespace
    and p.proname = r.name
    and pg_get_function_identity_arguments(p.oid) = r.identity_args
)
select 'function:' || name requirement,
  case when oid is null then 'FAIL'
       when prosecdef
        and coalesce(array_to_string(proconfig, ','), '') like '%search_path=public%'
        and not public_execute and not anon_execute and not authenticated_execute
        and service_role_execute then 'PASS'
       else 'FAIL' end status,
  jsonb_build_object('security_definer',prosecdef,'config',proconfig,
    'public_execute',public_execute,'anon_execute',anon_execute,
    'authenticated_execute',authenticated_execute,'service_role_execute',service_role_execute) evidence
from function_rows
union all
select 'table:application_signing_sessions RLS',
  case when coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.application_signing_sessions')),false) then 'PASS' else 'FAIL' end,
  jsonb_build_object('rls_enabled',coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.application_signing_sessions')),false))
union all
select 'index:open signing session owner/hash',
  case when exists(select 1 from pg_indexes where schemaname='public' and indexname='application_signing_sessions_open_user_hash_idx') then 'PASS' else 'FAIL' end,
  null
union all
select 'index:single application/session binding',
  case when exists(select 1 from pg_indexes where schemaname='public' and indexname='application_signing_sessions_application_idx') then 'PASS' else 'FAIL' end,
  null
union all
select 'storage:documents remains private',
  case when exists(select 1 from storage.buckets where id='documents' and public=false) then 'PASS' else 'FAIL' end,
  null;

commit;
```
