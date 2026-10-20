# Application signing implementation plan

## Controlled engineering loop

- Trigger: developer-run, one P0 vertical-slice requirement at a time.
- Observation: targeted test plus an inspection of the changed route, schema,
  and authorization boundary.
- Success: all P0 signing requirements have passing deterministic tests; an
  integration run proves an owned session can be finalized exactly once.
- Hard exits: 20 iterations, 90 minutes per run, or three consecutive identical
  failures. On exit, update `application-signing-test-results.md` and escalate.
- No-progress rule: stop after three iterations with the same code/test
  fingerprint and no changed verifier output.
- Human gate: migrations, deployment, policy changes, and any production data
  correction require approval. Never merge, deploy, delete objects, or alter
  live data automatically.

## P0 architecture

`Signing screen -> authenticated signing session/upload APIs -> private Storage
prefix -> signing metadata -> final-submit RPC -> applications + immutable
document versions -> RBAC admin review`

The controller, not the agent, enforces the time/iteration budget. Test scripts
and migrations remain outside the autonomous edit set so a failed verifier
cannot be weakened to create a false success.

## Implementation order

1. Migration and server-side contract tests.
2. Mobile-backend signing session APIs and final-submit validation.
3. Flutter signing step and retry-safe uploads.
4. Admin document mapping and review display.
5. Address/guardian regression improvements only where the audit identifies a
   concrete incompatibility.

## Phase 1 implementation

Added the private pre-submission signing-session contract:

- Migration `20261020_add_application_signing_sessions.sql` creates one
  metadata row per signing session, with private Storage object paths and
  SHA-256 hashes for the student signature, guardian signature, and guardian
  ID. It does not store base64 or other file content in PostgreSQL.
- `finalize_application_signing_session` locks the session, verifies its owner,
  linked application ownership, expiration, consent, guardian details, form
  hash and required documents, then creates immutable application-document
  version records and marks the session finalized in one database transaction.
- The mobile backend supplies protected session creation/read/upload routes.
  Uploads validate magic bytes rather than trusting extension/MIME metadata,
  use server-generated paths, remove the object if metadata persistence fails,
  and treat same-content retries as idempotent.
- The existing submission path invokes finalization after creating the normal
  document slots and before endorsements or a success response. A retry with
  the same finalized session/application is idempotent at the RPC layer.

The migration has not been applied. Rollback must be run only after confirming
no signing session or application document version depends on it: revoke and
drop the RPC, then drop the session indexes/table. Storage objects are not
transactional and should be removed separately only after an inventory.

## Phase 2 Flutter implementation

- The applicant form now has six steps: Personal, Family, Academic, Essay,
  Signing, and Review & Submit. Signing is not placed in the submitted-form
  preview.
- `StepSigning` provides independent touch canvases, clear/retry controls and
  PNG export for student and guardian signatures. It never copies a signature
  between canvases.
- Guardian ID selection uses the existing `image_picker` camera/gallery flow,
  previews the selected image, and rejects empty or over-8 MB images before
  upload. Backend magic-byte validation remains authoritative.
- `ApplicationSigningService` uses the authenticated API client and the exact
  Phase 1 request/response fields. It creates a session from the full current
  submission payload and uploads the three required evidence files.
- Form changes invalidate the local signing-session reference; expiry errors
  move the applicant back to Signing. The existing provider continues to block
  duplicate final-submit requests.
