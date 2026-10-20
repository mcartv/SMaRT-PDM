# Application signing production readiness

## Decision

**Not production-ready.** Development is confirmed, but its signing table and
both signing RPCs are absent because the signing migrations have not been
applied. Targeted source-level checks pass; live integration remains pending.

Phase 5.5 blocks migration execution until standalone read-only metadata checks
prove all required columns, conflict keys, document-version trigger, baseline
functions, private-bucket posture, and absence of duplicate legacy keys. These
checks are documented in `application-signing-integration-test-plan.md` and do
not authorize an apply operation by themselves.

## Phase 5.3 verified state and current blockers

- **P0 — Apply reviewed migrations to development only:** owner-reported
  read-only history contains no signing migration record. Apply
  `20261020000000_add_application_signing_sessions.sql`, verify it, then apply
  `20261020000100_add_application_signing_document_corrections.sql` after
  explicit approval. Do not use the protected-project CLI link.
- **P0 — Verify schema compatibility during approval:** required document,
  version, and review tables exist, but their columns, unique constraints, and
  trigger definitions were not retained in the reported result. Stop if the
  reviewed RPC prerequisites are absent or incompatible.
- **P0 — Preserve default-deny Storage:** the `documents` bucket is private and
  has no `storage.objects` policies. Keep browser access default-deny; backend
  service-role upload/remove plus backend-issued signed URLs is the intended
  access boundary.
- **P0 — Verify atomic application/signing finalization in development:**
  `20261020000200_add_atomic_application_signing_submission.sql` now prepares
  one `SECURITY DEFINER`, service-role-only RPC for application mutation,
  legacy slot creation, signing finalization, endorsement creation, student
  pointer update, and application-form review reset. It is unapplied and has
  only source-contract coverage. Apply and prove rollback/expiry/duplicate/
  concurrency behavior before considering the risk resolved.
- **P1 — Run live integration after migration verification:** absence of the
  signing table/RPCs currently explains create-session, finalization, and
  correction failures, as well as potential admin application-detail failures.

The legacy notes below remain applicable where they address post-migration
integration, device validation, and production rollout.

## Prioritized blockers

### P0 — Confirm and use an isolated Supabase project

The configured mobile and admin backend targets match and are non-local, but
there is no evidence that the target is an isolated test project. Do not use it
for this validation until an owner confirms isolation and grants explicit
migration/test authorization.

Remediation: provide the isolated project identity, approved test-account
procedure, and written authorization. Then run the plan in
`application-signing-integration-test-plan.md` without using production data.

### P0 — Correct the signing migration ordering before first rollout

The correction migration is now
`20261020000100_add_application_signing_document_corrections.sql`, which sorts
after `20261020000000_add_application_signing_sessions.sql`. Read-only history
confirmed neither original file was applied, so both files were normalized to
this lexically ordered sequence. The intended and reviewed order is sessions
first, corrections second.

Remediation: the filename conflict is resolved locally after read-only history
confirmed neither signing migration was applied. Obtain approval, then apply in
the reviewed order and verify after each migration.

### P0 — Verify private bucket and `storage.objects` policies

Read-only preflight reports a private `documents` bucket and no
`storage.objects` policies. Both backends use the service-role key for uploads
and signed URLs, which intentionally bypasses RLS; that is acceptable only if
every public endpoint performs its own authorization.

Remediation: retain the private/default-deny configuration; verify that only
the service-role backend can write/remove and that clients receive only
short-lived URLs. Capture this expected default-deny posture in a controlled
runbook before enabling any direct client Storage access.

### P0 — Verify database compatibility and RPC privileges live

The signing migrations assume existing review/version tables, unique keys, and
columns including `preview_path`, `preview_size_bytes`, and
`preview_created_at`; their definitions are not present in the tracked
Supabase migration history. The correction RPC also assumes the review-table
unique key for its upsert.

Remediation: run the read-only preflight queries in the test plan. Apply
migrations only after all assumptions hold. Confirm both RPCs have execute
revoked from `public`, `anon`, and `authenticated`, and granted only to
`service_role`.

### P1 — Complete an adversarial integration run

Source checks show owner/application scoping and row locking, but they do not
prove deployed behavior or cleanup of concurrent Storage uploads.

Remediation: execute every positive/negative/concurrency case in the test plan
against the isolated project. Verify exactly one extra version after concurrent
requests and inventory Storage to confirm failed uploads are removed.

### P1 — Resolve documented frontend/backend capability and rollout gaps

The backend accepts PDF/JPG/JPEG/PNG guardian IDs, but the initial Flutter
Signing step currently uses `image_picker` camera/gallery and describes JPG/PNG
only. The later correction screen supports file selection including PDF. This
is not an authorization weakness, but it is an inconsistent user contract.
Also, the admin detail projection queries the signing-session table; deploying
the admin/backend changes before the session migration can make document-detail
requests fail.

Remediation: either expose PDF selection in the initial signing step or reduce
the backend contract deliberately and document it; test both paths. Roll out
database migrations before backend services, then deploy applicant/admin
clients. Roll back application code before dropping signing schema only after
an explicit data-retention review.

### P1 — Resolve the Flutter lint gate and run device validation

Targeted analysis has six informational lints in the applicant document screen,
and no Android device test has occurred.

Remediation: triage/fix the lints without weakening checks; run the documented
Android canvas, camera/gallery, retry, expiry, correction, preview, and
duplicate-submit scenarios on a physical device.

## Security review summary

- **Authentication/RBAC:** Mobile correction/session routes use JWT `protect`;
  admin preview/review routes require admin role plus document permissions.
  Server-side services and RPCs repeat applicant/application ownership checks.
- **Service role:** The service role is confined to backend configuration in
  the inspected Flutter/admin client source. It bypasses RLS by design, so
  endpoint authentication and parameter ownership validation are critical and
  must be exercised live.
- **RPCs:** Both new signing RPCs are `SECURITY DEFINER`, fixed to
  `search_path = public`, and revoke execute from client roles. They accept a
  claimed user ID, but verify it against the document/application/student rows;
  direct client execution remains revoked.
- **Versioning:** The correction RPC locks the current document row, increments
  version number, inserts a new version, changes the current pointer, and does
  not delete historical version rows. The live unique/version schema still
  requires verification.
- **Sensitive data:** Applicant responses are intended to remove Storage paths
  and issue signed URLs. The admin service role config currently logs the
  Supabase URL at startup; it does not log the key, but production logging
  should avoid unnecessary infrastructure identifiers. Mobile auth has a
  development fallback JWT secret; production startup should fail when
  `JWT_SECRET` is absent rather than use that fallback.
- **Dependencies:** The required Flutter `image_picker` and `file_picker`
  packages and backend `multer`, `jsonwebtoken`, and Supabase SDK dependencies
  are declared. Their presence does not establish Android permission setup,
  runtime camera behavior, or a private bucket policy; those remain integration
  checks.

## Deployment sequence after blockers clear

1. Snapshot/approve the isolated target and run preflight.
2. Apply baseline/versioning migrations, signing-session migration, then the
   corrected-order signing-correction migration.
3. Verify bucket privacy/RLS/RPC grants.
4. Run the complete integration matrix, including concurrency and cleanup.
5. Run Flutter Android validation and admin review validation.
6. Obtain security/release approval before considering production rollout.

## Phase 5.6 release gates

### P0 — Complete the catalog compatibility gate

The reported checks establish relation presence and high-level prerequisites,
not the exact column types, index definitions, foreign keys, and Storage RLS
posture required by the three signing migrations. The atomic endorsement insert
also needs a known uniqueness definition for idempotency.

Remediation: run the single read-only Phase 5.6 preflight only after confirming
project `twehxvixkfgtbaohnnon` in the SQL Editor. Resolve every `FAIL` and
document every `REVIEW` before applying any migration. A metadata permission
failure is a blocker, not permission to broaden application/browser access.

### P1 — Remove unreachable legacy submission writes

The mobile submission service returns after its atomic RPC, so its old direct
application/document/finalization/endorsement path cannot execute. That avoids
a current split transaction but creates a future maintenance hazard.

Remediation: remove the unreachable block in a reviewed follow-up, then rerun
source contracts and the live isolated-development integration matrix.
