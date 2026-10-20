# Application signing integration environment audit

Audit date: 2026-10-20. Initial findings were repository-only; this document
also records owner-reported results from a manual read-only development
preflight. No Supabase CLI command, migration, DDL, Storage write, reset, or
credential value inspection was performed by this audit.

## Overall state: NEEDS EXECUTION APPROVAL

There is no explicit, repository-controlled development/test environment
selection. Two project references are locally derivable:

- `twehxvixkfgtbaohnnon`: mobile backend, admin backend, and local admin
  frontend `.env`.
- `ngqwdetlpsqetbahjvto`: Supabase CLI link metadata and the hard-coded
  admin-frontend Vercel target.

The repository itself does not encode a safe development selector. The owner
has identified `twehxvixkfgtbaohnnon` as development/testing and
`ngqwdetlpsqetbahjvto` as protected. This audit still does not authorize a
connection or query to either project.

## Component configuration audit

| Component | Configuration source | Expected variables / selector | Audit result |
| --- | --- | --- | --- |
| `mobile/backend` | `.env`, `src/config/supabase.js` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_APPLICATION_DOCUMENT_BUCKET`, `SUPABASE_ENDORSEMENT_SLIP_BUCKET`, `JWT_SECRET` | **Configured** to confirmed development `twehxvixkfgtbaohnnon`. No Supabase URL fallback in this component, but test traffic follows whichever environment file/process is loaded. |
| `mobile/frontend` | `AppConfig`, compile-time `--dart-define` | `API_BASE_URL` | **Configured** for API-only access; no direct Supabase ref is derivable. **NEEDS CONFIGURATION**: release has a hard-coded hosted backend fallback and debug has a hard-coded LAN fallback. Omitted/invalid `API_BASE_URL` can direct test traffic to those fallbacks. |
| `admin/backend` | `.env`, `config/supabase.js` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `JWT_SECRET` | **Configured** to confirmed development `twehxvixkfgtbaohnnon`. It logs the Supabase URL at startup; it does not log the service-role key. |
| `admin/frontend` | `.env`, `src/lib/supabase.js`, `vercel.json` | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Local `.env` is **configured** to development `twehxvixkfgtbaohnnon`, while `vercel.json` targets protected `ngqwdetlpsqetbahjvto`; **NEEDS CONFIGURATION** to make deployment selection explicit. The anon key is designed to be public, but should be environment-injected rather than duplicated in source. |
| Supabase CLI | `supabase/.temp/project-ref`, `linked-project.json` | linked project reference | **Configured** to protected `ngqwdetlpsqetbahjvto`; **DO NOT USE** for this preflight. No tracked development CLI selector or guardrail exists. |

The audit intentionally omits URL and credential values. Project references are
included because they are the required safe identifiers for environment
selection.

## Phase 5.2 target gate

**Target prepared, execution not authorized.** Before any future query, the
operator must manually verify the SQL Editor project selector or direct database
host resolves to `twehxvixkfgtbaohnnon`. A transaction running `READ ONLY` does
not establish project identity; it only prevents writes after the connection is
already made. If the exact reference cannot be verified in the target UI or
connection configuration, stop without executing SQL.

## Hard-coded routing and fallbacks

- The Flutter release and debug API base URLs are hard-coded fallbacks in
  `mobile/frontend/lib/core/config/app_config.dart`. Test builds must pass a
  validated `--dart-define=API_BASE_URL=...`; otherwise they use a hosted or
  LAN default.
- `admin/frontend/vercel.json` contains a hard-coded API target, Supabase URL,
  and anon credential. This couples deployment/browser traffic to one project
  rather than an explicitly selected environment.
- The admin frontend directly initializes a Supabase client with public
  `VITE_SUPABASE_*` values. Browser protection therefore depends on live RLS
  and Storage policies, which have not been inspected.
- Both Node backends use service-role clients. This is acceptable only because
  the route/service/RPC layers enforce identity and ownership; service role is
  not evidence of applicant authorization.

## Signing migration audit

### Required logical order

1. Existing schema/versioning prerequisites, especially
   `20260808083734_add_mobile_onboarding_preferences.sql` and
   `20260808085245_support_legacy_application_document_uploads.sql`.
2. `20261020000000_add_application_signing_sessions.sql`.
3. `20261020000100_add_application_signing_document_corrections.sql`.
4. `20261020000200_add_atomic_application_signing_submission.sql`.

After the development preflight confirmed that neither signing migration is
recorded, the session and correction migrations were renamed locally to the
unambiguous sequence `20261020000000` and `20261020000100`. This supplies
unique, lexically ordered versions without altering an applied migration. They
must still be applied only after separate approval.

### Prerequisites requiring live read-only confirmation

- `users`, `students`, `applications`, `application_documents`,
  `application_document_versions`, and `application_document_reviews` exist.
- `application_documents` has the current-version, review, preview, source,
  owner, and submission columns referenced by the two RPCs.
- `application_document_versions` has version, path, hash, size, and creator
  columns; `application_document_reviews` has the unique key
  `(application_id, document_key)` required by the correction upsert.
- The legacy document-version trigger exists and does not conflict with manual
  signing-version insertion.
- The configured documents bucket exists and is private. No signing bucket,
  `storage.buckets` insert, or `storage.objects` policy is tracked in this
  repository.

### RPC/RLS assessment

- `application_signing_sessions` enables RLS, revokes table privileges from
  client roles, and grants service-role access only. No RLS policy is needed
  for intended client access because clients use the backend.
- Both signing RPCs are `SECURITY DEFINER`, set `search_path = public`, revoke
  execute from `public`, `anon`, and `authenticated`, and grant execute to
  `service_role` only.
- The RPCs accept a claimed user ID but compare it with the
  application/student/document ownership graph. This must be verified live by
  calling backend routes with separate applicant tokens; never test it using a
  service-role request as a stand-in for an applicant.
- Session finalization locks the session and target document rows. Correction
  locks the document row, inserts the next version, changes its current pointer,
  and resets the review row atomically. Storage is intentionally completed
  before database finalization and must be audited for failed-upload cleanup.

## Migration and compatibility blockers

1. **P0:** The existing Supabase CLI link targets protected
   `ngqwdetlpsqetbahjvto`; it cannot be used for development preflight or any
   test action. Dashboard project selection or a separately verified read-only
   connection is required.
2. **Resolved locally; deployment pending:** The correction migration now has
   the unique later version `20261020000100`; it remains unapplied.
3. **P0:** Live schema, grants, RLS, bucket privacy, and Storage policies are
   unverified and not fully represented in tracked migrations.
4. **P1:** Admin detail queries the signing-session table; deploy schema before
   admin/backend code to avoid detail-page failures.
5. **P1:** Initial Flutter guardian-ID UI is image-only while the backend also
   accepts PDF; decide and document one coherent contract.

## Exact safe next steps

1. Retain the owner's confirmation that `twehxvixkfgtbaohnnon` is the isolated
   development/testing project and `ngqwdetlpsqetbahjvto` is protected.
2. Before any approved execution, compare the target selected in the dashboard
   or direct-connection configuration against `twehxvixkfgtbaohnnon` without
   printing credentials. The existing CLI link must not be used because it
   points to the protected project.
3. Run the prepared read-only schema, grant, policy, and bucket preflight only
   after a separate execution approval.
4. Request a separate explicit approval before applying migrations. Do not run
   `supabase db reset`; use synthetic accounts and scoped cleanup only.
5. Execute the signed integration test matrix only after preflight passes.

## Read-only development preflight queries

Run these only after separate execution approval. The development reference is
already owner-confirmed; the existing CLI link is known to point to the
protected project and must not be used. Record results without credentials,
applicant data, document contents, or object paths.

### Safe execution method

1. In the Supabase Dashboard, manually open SQL Editor for
   `twehxvixkfgtbaohnnon`; verify the project reference in the selector/URL
   before pasting anything. Do not open or select
   `ngqwdetlpsqetbahjvto`.
2. If a direct connection is used instead, confirm its host contains the exact
   development reference and use a dedicated read-only database role where
   available. Begin a read-only transaction before every query batch.
3. Execute only the statements below. End with `ROLLBACK`, even though no DML
   or DDL is included. Do not use Supabase CLI linking, push, reset, repair, or
   migration commands.

```sql
begin transaction read only;

select current_database() as database_name,
       current_user as database_role,
       current_setting('transaction_read_only') as transaction_read_only;

-- Table existence and RLS only; no application rows.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('users', 'students', 'applications',
                    'application_documents', 'application_document_versions',
                    'application_document_reviews', 'application_signing_sessions')
order by c.relname;

-- Required columns only; no record values.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('application_documents', 'application_document_versions',
                     'application_document_reviews', 'application_signing_sessions')
order by table_name, ordinal_position;

-- Constraints/indexes needed for immutable document versions and review upsert.
-- This join is safe even when a required table is absent.
select pc.conrelid::regclass as table_name,
       pc.conname,
       pc.contype,
       pg_get_constraintdef(pc.oid) as definition
from pg_constraint pc
join pg_class c on c.oid = pc.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('application_documents', 'application_document_versions',
                    'application_document_reviews')
order by table_name::text, conname;

select pi.indexrelid::regclass as index_name,
       pg_get_indexdef(pi.indexrelid) as definition
from pg_index pi
join pg_class c on c.oid = pi.indrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('application_documents', 'application_document_versions',
                    'application_document_reviews')
order by index_name::text;

-- Trigger metadata validates the legacy automatic-version trigger.
select pt.tgrelid::regclass as table_name,
       pt.tgname,
       pg_get_triggerdef(pt.oid) as definition
from pg_trigger pt
join pg_class c on c.oid = pt.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'application_documents'
  and not tgisinternal
order by tgname;

-- Signing RPC identity, security-definer setting, search path, and execute grants.
select p.oid::regprocedure as function_signature,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       case
         when e.grantee is null then null
         when e.grantee = 0 then 'PUBLIC'
         else r.rolname
       end as grantee,
       e.privilege_type,
       e.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) e
  on e.privilege_type = 'EXECUTE'
left join pg_roles r on r.oid = e.grantee
where n.nspname = 'public'
  and p.proname in ('finalize_application_signing_session',
                    'replace_application_signing_document')
order by function_signature::text, grantee;

-- Public-table and Storage policy metadata, never objects or document paths.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename = 'application_signing_sessions')
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- Bucket metadata only. Inspect approved bucket inventory before choosing one.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

-- First learn migration-history columns; this does not read migration SQL text.
select column_name, data_type
from information_schema.columns
where table_schema = 'supabase_migrations'
  and table_name = 'schema_migrations'
order by ordinal_position;

rollback;
```

If the last metadata query confirms both `version` and `name` columns, run this
separate read-only transaction to inspect only signing-related migration
identifiers and filenames:

```sql
begin transaction read only;
select version, name
from supabase_migrations.schema_migrations
where version like '20261020%'
   or name in ('add_application_signing_sessions.sql',
               'add_application_signing_document_corrections.sql')
order by version;
rollback;
```

If only `version` exists, omit `name` from that query and use the version result
as evidence of a conflict requiring reconciliation, not proof of which of the
two duplicate-prefix files was applied.

The table/index/trigger and function metadata queries can require a database
owner or an approved metadata-read role. They do not require service-role HTTP
access and must not be replaced by a service-role applicant test. Interpret a
missing relation/function as a failed prerequisite. The RPC query preserves a
function row even if it has no `EXECUTE` ACL item; a null `grantee` and null
privilege fields means the function needs explicit grant inspection. For each
RPC, the execute-grant result must show `service_role` and must not show
`PUBLIC`, `anon`, or `authenticated`. The migration-history query must be run
only after its first metadata query proves that the expected history table and
`version` column are present. The owner-reported development preflight found no
matching signing migration record, so the session/correction migrations were
safely renamed locally to `20261020000000`/`20261020000100`. No migration has
been applied by this audit.

## Prepared P0 migration work

No Storage/RLS migration has been created in this audit. Creating one safely
requires the confirmed bucket ID and its existing policies: the shared
application-document bucket may contain legacy documents, so forcing it private
or dropping policies without inventory could break unrelated flows. Once the
development preflight proves the intended bucket and baseline, prepare one
later-timestamped, additive migration that:

1. creates the approved bucket only if absent and sets `public = false`;
2. adds no broad `anon`/`authenticated` `storage.objects` access for signing
   paths—backend service role and signed URLs remain the access path;
3. validates/creates the document and review unique indexes required by the
   RPCs, after duplicate checks;
4. records/revokes RPC execute grants exactly as the signing migrations do;
5. fails loudly if incompatible bucket policy or duplicate-version data exists.

Do not create a migration that changes the shared bucket, drops unknown policies,
or adds direct authenticated access before that evidence is available.
