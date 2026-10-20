# Application signing test results

Audit baseline, 2026-10-20:

- Not run: Flutter analysis/tests.
- Blocked: mobile backend contract-test attempt:
  `node --test test/application-form-pre-submit-confirmation-contract.test.js test/application-field-limits.test.js test/application-form-required-fields.test.js`
  failed before test execution because the sandbox denied Node's child-process
  spawn (`EPERM`). Result: 0 passed / 3 failed-to-start. The backend package
  also maps `npm test` to a placeholder failure command; individual Node
  contract tests exist under `mobile/backend/test` but no test-runner script is
  configured.
- Not run: admin frontend checks.
- Not run: live database/storage/RLS validation (no live credentials or
  migration execution authorization were provided).

No test is reported as passing until it has been executed successfully.

## Phase 1 implementation verification

- Passed: `node test\\application-signing-contract.test.js` from
  `mobile/backend` — 5/5 targeted contract checks. Coverage includes session
  ownership/expiration/consent metadata, private signing document references,
  form-hash and incomplete/finalized rejection paths, magic-byte and retry-hash
  upload guards, authenticated route ordering, and finalization before
  endorsement creation.
- Passed: `node --check` for the signing service, application service,
  controller, and routes.
- Not run: a live Supabase integration test. It requires an isolated Supabase
  project with the migration applied and private bucket policy verification.

## Phase 2 Flutter verification

- Passed: targeted `dart analyze` across the signing UI/service, modified
  submission flow, and signing-state test — no issues found.
- Added: `test/features/forms/presentation/signing_state_test.dart`, covering
  empty signatures, missing ID, consent, ready/uploaded state, retry evidence
  preservation, form-change invalidation, expiry recovery, and the existing
  duplicate-submit provider guard.
- Blocked: `flutter test test/features/forms/presentation/signing_state_test.dart`
  did not reach test execution because Flutter could not delete the existing
  `mobile/frontend/build/unit_test_assets` directory. This is a local
  filesystem-permission issue; no test outcome is reported as passing.
- Manual Android checks: draw and clear both signatures; take/select a clear
  guardian ID; upload once, retry with airplane mode toggled, edit a form field
  and verify Signing is required again, wait/use an expired session response,
  then submit once and confirm navigation occurs only after backend success.

## Phase 3 admin verification

- Passed: `node test/application-signing-document-review-contract.test.js` —
  4/4 backend contract tests for labels, reviewability, guardian metadata,
  version projection, and RBAC signed-preview routing.
- Passed: `node test/document-verification-signing-contract.test.mjs` — 4/4
  frontend contract tests for signing discovery, labels, guardian metadata,
  limitation notice, signed preview route, and version display.
- Passed: `npm run build` in `admin/frontend` after allowing the build's native
  dependency/process requirements. Vite completed successfully; pre-existing
  large-chunk and ExcelJS `eval` warnings remain.
- Not run: live authorization, signed URL, and replacement-version integration
  tests require the Phase 1 migration in an isolated Supabase project. The
  applicant-side signing-document correction entry point remains a documented
  follow-up and was not represented as production-ready.

## Phase 4 applicant signing correction verification

- Passed: direct Node execution from `mobile/backend`:
  `node test\application-signing-contract.test.js` — 5/5 existing signing
  contract checks passed.
- Passed: direct Node execution from `mobile/backend`:
  `node test\application-signing-correction-contract.test.js` — 5/5 checks
  passed for authorized replacement, status rejection, immutable version
  creation, pending review reset, server-side path handling, byte validation,
  and review-queue transition.
- Passed: `node --check` for the changed mobile backend signing service,
  application service, controller, and routes.
- Passed: `flutter test
  test\features\applicant\applicant_signing_correction_model_test.dart` — 4/4
  tests covering requested correction visibility/reason, verified/pending
  rejection, non-signing isolation, and duplicate-correction prevention after
  the returned pending state.
- Completed with informational findings: targeted `dart analyze` for the
  changed applicant model/service/screen and correction test reported no errors
  but six existing informational lints in `applicant_documents_screen.dart`
  (two `control_flow_in_finally`, two `deprecated_member_use`, two
  `use_null_aware_elements`). They were not altered because they are unrelated
  to the correction boundary.
- Passed: `node test\application-signing-document-review-contract.test.js` in
  `admin/backend` — 4/4 existing signing review/RBAC checks.
- Passed: `node test\document-verification-signing-contract.test.mjs` in
  `admin/frontend` — 4/4 existing signing display/signed-preview checks.
- Passed: `npm run build` in `admin/frontend` when run outside the sandbox.
  Vite completed with the pre-existing ExcelJS direct-`eval` and large-chunk
  warnings.
- Blocked (launcher only): `node --test` could not spawn child processes in the
  sandbox (`EPERM`), although direct execution of both Node contract files
  passed. The initial sandboxed Dart analyzer and admin build were likewise
  blocked by child-process/native-module access and were rerun successfully
  outside the sandbox.
- Not run: live Supabase integration/RLS/Storage test. It requires an isolated
  project with both signing migrations applied, a private bucket, and test
  credentials. No migration was applied and no deployment was performed.
