# Reviewed synthetic integration adapters

Do not place tokens, connection strings, service-role keys, or real applicant
identifiers in this directory. An adapter may use only pre-provisioned isolated
development fixtures named `DEV-SIGNING-*` and must write its JSON result to
`SMART_PDM_SIGNING_SYNTHETIC_REPORT_PATH`.

The deployment runner executes an adapter only when its resolved path remains
under this directory and its SHA-256 equals the separately approved
`SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_SHA256` process variable.

The JSON array must contain exactly one `PASS` record for each required case:
`successful_submission`, `requested_correction`, `expired_session`,
`duplicate_submission`, `cross_account_authorization`, `atomic_rollback`, and
`concurrent_submission`.

Before adding an adapter, review its fixture provisioning, cleanup plan, HTTP
contracts, assertion logic, and redaction rules. It must clean up only explicit
test UUIDs/paths recorded during that run, never scan or delete broadly, and
must fail if an expected test fixture is missing.
