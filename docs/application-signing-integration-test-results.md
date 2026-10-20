# Application signing integration test results

Audit date: 2026-10-20. The project owner confirmed
`twehxvixkfgtbaohnnon` as development/testing and reported results from a
manual, read-only SQL Editor preflight. No migration, DDL, Storage write,
production operation, or real-device operation was performed by this phase.

## Environment readiness

| Check | Status | Evidence |
| --- | --- | --- |
| Isolated Supabase project confirmed | PASS | Owner confirmed `twehxvixkfgtbaohnnon` as development/testing; protected `ngqwdetlpsqetbahjvto` was not accessed. |
| Credentials inspected or exposed | PASS | Environment audit reported variable names/presence only; no values were read into results. |
| Signing migration history | PASS (read-only) | No matching signing migration was recorded. |
| Migrations applied | NOT RUN | Explicit approval remains required. |
| Storage bucket/policies inspected live | PASS (read-only) | Private `documents` bucket exists; `storage.objects` returned zero policy rows. |
| Real Android device test | NOT RUN | No device was available. |

## Automated checks

| Check | Status | Evidence |
| --- | --- | --- |
| Mobile signing contract | PASS | Direct `node test\\application-signing-contract.test.js`: 5/5. |
| Mobile correction contract | PASS | Direct `node test\\application-signing-correction-contract.test.js`: 5/5. |
| Changed backend syntax | PASS | `node --check` completed for signing service, application service, controller, and routes. |
| Flutter signing and correction state | PASS | `flutter test test\\features\\forms\\presentation\\signing_state_test.dart test\\features\\applicant\\applicant_signing_correction_model_test.dart`: 12/12. |
| Admin backend signing contract | PASS | `node test\\application-signing-document-review-contract.test.js`: 4/4. |
| Admin frontend signing contract | PASS | `node test\\document-verification-signing-contract.test.mjs`: 4/4. |
| Admin frontend build | PASS | `npm run build` completed; pre-existing ExcelJS direct-`eval` and large-chunk warnings remain. |
| Targeted Dart analysis | FAIL (lint gate) | No errors, but six informational lints remain in `applicant_documents_screen.dart`; see prior Phase 4 results. |
| Node multi-file test runner | BLOCKED | `node --test` cannot spawn child processes in the sandbox (`EPERM`); direct execution above passed. |

## Phase 5.3 remediation checks

| Check | Status | Evidence |
| --- | --- | --- |
| Development signing table/RPC presence | BLOCKED | Read-only preflight reported no `application_signing_sessions` table and neither signing RPC. This is expected while the two unapplied signing migrations remain absent. |
| Document-version prerequisites | PARTIAL | `application_documents`, `application_document_versions`, and `application_document_reviews` exist. Column, unique-index, and trigger definitions still require captured metadata before migration execution. |
| Migration identity remediation | PASS (local) | Sessions/correction migrations renamed to `20261020000000`/`20261020000100`; reported history confirms neither original signing migration was recorded. |
| Storage boundary review | PASS (source/read-only metadata) | Mobile signing and correction services both resolve `SUPABASE_APPLICATION_DOCUMENT_BUCKET` with a `documents` fallback. The private `documents` bucket with zero object policies is default-deny for browser roles; backend service-role calls remain the only upload/remove/signed-URL path. |
| Submission transaction boundary | PASS (source contract) | Runtime submit path invokes `submit_application_with_signing` before legacy application writes can execute. The RPC encloses application mutation, slots, signing finalization, endorsement, student pointer, and edit-review reset. |
| Mobile signing contract | PASS | `node test\\application-signing-contract.test.js`: 5/5. |
| Mobile correction contract | PASS | `node test\\application-signing-correction-contract.test.js`: 5/5. |
| Admin signing-review contract | PASS | `node test\\application-signing-document-review-contract.test.js`: 4/4. |
| Admin signing UI contract | PASS | `node test\\document-verification-signing-contract.test.mjs`: 4/4. |
| Mobile backend syntax | PASS | `node --check` passed for signing service, application service, controller, and routes. |
| Atomic submission contract | PASS | `node test\\application-signing-atomic-submission-contract.test.js`: 4/4 source-contract checks for transaction scope, authorization/grants, retry/expiry guards, and advisory-lock concurrency serialization. |

The missing signing table and RPCs directly explain failed create-session,
final-submission, and signing-correction requests: the mobile backend queries
the table and invokes both functions. The admin application-detail projection
also queries the session table, so its deployed Phase 3 view can fail until the
session migration is applied.

Phase 5.4 replaces the runtime submit path with a prepared atomic RPC, but the
migration has not been applied. Therefore success, rollback, duplicate,
expired-session, and concurrent-request behavior is **NOT RUN** against
PostgreSQL and must not be inferred from the source-contract result.

## Phase 5.5 final development migration preflight

| Check | Status | Evidence |
| --- | --- | --- |
| Development target identity | PASS | Owner confirmed `twehxvixkfgtbaohnnon`; protected `ngqwdetlpsqetbahjvto` was not accessed. |
| Signing migration history absent | PASS (reported read-only) | No matching signing migration record was reported. |
| Core document tables present | PASS (reported read-only) | `application_documents`, `application_document_versions`, and `application_document_reviews` were reported present. |
| Private Storage baseline | PASS (reported read-only) | Private `documents` bucket exists and `storage.objects` returned zero policy rows. |
| Baseline columns/constraints/indexes/triggers/functions | NOT RUN | Full metadata results were not supplied; standalone Phase 5.5 queries are prepared in the integration test plan. |
| Signing/atomic migrations applied | NOT RUN | Explicit approval has not been given. |
| Atomic PostgreSQL rollback/retry/concurrency | NOT RUN | Requires the migrations in development and synthetic-account integration execution. |
| Signing source contracts | PASS | Session 5/5, correction 5/5, atomic submission 4/4. |
| Changed backend JavaScript syntax | PASS | `node --check` passed for `applicationSigningService.js` and `applicationService.js`. |
| Protected-project access | PASS | No protected-project CLI, SQL, or network operation was performed. |

## Live integration matrix

All are BLOCKED, not failed or passed, pending the safety gate in the test plan:

- Signing session lifecycle and expiry.
- Student/guardian signature and guardian ID uploads.
- Form-hash-bound application finalization and duplicate submission.
- Applicant and admin signed-preview authorization.
- Reviewer re-upload request with reason.
- Authorized correction, version history, pending transition, and re-verification.
- Cross-account, malformed MIME, oversize, unauthorized-status, overwrite,
  concurrent-correction, and RPC privilege negative cases.
- Private Storage/RLS policy behavior and browser payload inspection.
- Legacy five-document regression against a real database.

Contract/unit results demonstrate source-level intent only. They do not prove
the live schema, Storage policy, RLS configuration, or deployed API behavior.

## Phase 5.6 final compatibility review

| Check | Status | Evidence |
| --- | --- | --- |
| Required migration order | PASS (local) | `20261020000000_add_application_signing_sessions.sql` → `20261020000100_add_application_signing_document_corrections.sql` → `20261020000200_add_atomic_application_signing_submission.sql`. |
| Session-finalization RPC | PASS (source) | Locks session/document rows; checks ownership, expiry, form hash, consent, and all evidence before immutable-version insertion. |
| Correction RPC | PASS (source) | Locks the current signing document; permits only applicant-owned `reupload_required` evidence; inserts a version and resets review state to `pending`. |
| Atomic-submission RPC | PASS (source) | One function handles application mutation, legacy slots, finalization, endorsement, student pointer, and edit review; an exception rolls back its database writes. Storage upload is intentionally pre-transaction. |
| RPC security posture | PASS (source) | All signing RPCs use `SECURITY DEFINER`, fixed `search_path = public`, revoke browser/public roles, and grant only `service_role`. Live ACL metadata remains NOT RUN. |
| Backend/RPC parameter compatibility | PASS (source) | `submitApplicationWithSigning` supplies all twelve named atomic-RPC arguments; finalization/correction calls match their declared signatures. |
| Exact baseline columns, types, FKs, index definitions, and Storage RLS | BLOCKED | The reported 23 PASS checks did not include detailed catalog output. A consolidated read-only query is prepared in the test plan. |
| Endorsement idempotency constraint | REVIEW | Generic `ON CONFLICT DO NOTHING` followed by lookup must be paired with a confirmed `endorsement_slips(application_id)` uniqueness definition. |
| Expired-session state | REVIEW | The finalizer marks an expired session then raises; inside the outer atomic transaction that status update rolls back. Expiry is still enforced on every retry, but persistence needs an intentional decision. |
| Unreachable legacy submission path | REVIEW | `applicationService.js` returns after the atomic RPC, leaving former direct database writes unreachable. Runtime is protected, but remove that block before production maintenance can reactivate it. |
| Local source contracts | PASS | Direct session 5/5, correction 5/5, atomic 4/4; these are not integration proof. |
| Remote migration/integration execution | NOT RUN | No remote SQL, CLI, Storage, or protected-project access occurred. |

**Development migration deployment: BLOCKED.** Run the consolidated read-only
preflight in the confirmed development SQL Editor, resolve all `FAIL` results
and disposition all `REVIEW` results, then obtain explicit authorization for a
development-only migration execution step.

## Phase 5 automated development deployment preparation

| Check | Status | Evidence |
| --- | --- | --- |
| Fail-closed PowerShell orchestrator | PASS (local) | `scripts/Invoke-ApplicationSigningDevelopmentDeployment.ps1` validates only the direct `db.twehxvixkfgtbaohnnon.supabase.co` endpoint, never invokes Supabase CLI, defaults to no apply, requires backup evidence and an exact interactive approval phrase. |
| Local static dry run | PASS | `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\Invoke-ApplicationSigningDevelopmentDeployment.ps1 -NoRemote` generated machine-readable JSON and Markdown reports without reading connection configuration, resolving DNS, or contacting Supabase. |
| PowerShell parser | PASS | Both deployment and synthetic-runner scripts parsed successfully using the PowerShell AST parser. |
| Deployment safety contract | PASS | `node test\\application-signing-deployment-contract.test.js`: 3/3. |
| Existing signing source contracts | PASS | Direct session 5/5, correction 5/5, atomic submission 4/4. |
| Remote read-only preflight | NOT RUN | No remote connection was authorized or made. |
| Migration application | NOT RUN | `-Apply` was not used; no database modification occurred. |
| Synthetic development integration suite | BLOCKED | Requires reviewed pre-provisioned `DEV-SIGNING-*` fixtures and a fixture-only adapter command. The runner refuses to create/discover real applicants. |
