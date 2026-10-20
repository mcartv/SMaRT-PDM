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
