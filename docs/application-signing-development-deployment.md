# Application signing development deployment automation

The PowerShell workflow is deliberately independent of the repository's
Supabase CLI link. It accepts only a direct PostgreSQL URI from the process
environment and refuses every host except
`db.twehxvixkfgtbaohnnon.supabase.co`.

## Required local configuration

Set these only in the PowerShell process that will run the workflow; do not add
them to tracked files or paste their values into logs:

- `SMART_PDM_SIGNING_DEV_DATABASE_URL`: direct PostgreSQL URI for the confirmed
  development project. The URI host must be exactly
  `db.twehxvixkfgtbaohnnon.supabase.co`, with `sslmode=verify-full`.
- `SMART_PDM_SIGNING_DEV_BACKUP_EVIDENCE`: readable development-only backup or
  tested-recovery JSON evidence. It must identify the exact development
  `project_ref`, include `backup_status: "PASS"` and `restore_status: "PASS"`,
  and contain backup/restore timestamps no older than 24 hours/seven days.
- `SMART_PDM_SIGNING_SYNTHETIC_APPROVED=true`: set only after the synthetic
  account/fixture review is complete.
- `SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_PATH`: a reviewed fixture-only PowerShell
  adapter beneath `scripts\\adapters`.
- `SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_SHA256`: the approved SHA-256 of that
  adapter. The runner refuses adapter substitution.

The adapter may use only pre-provisioned development test accounts whose names
and fixtures are explicitly marked `DEV-SIGNING-*`. It must not discover,
create, modify, or delete real applicants. It must never print tokens, service
keys, database URIs, or private Storage paths.

## Safe local static dry run

This checks migration files and safety wiring only. It does not load a database
connection, resolve DNS, connect to Supabase, or use the Supabase CLI:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-ApplicationSigningDevelopmentDeployment.ps1 -NoRemote
```

## Read-only development preflight

After manually setting the development-only URI in the current process, omit
`-Apply`. The script validates the exact direct endpoint, requires `psql`, and
runs catalog-only checks. It makes no database write:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-ApplicationSigningDevelopmentDeployment.ps1
```

## Approved development deployment

This is the only write mode. It checks backup evidence, requires the exact
interactive phrase, then uses only Supabase CLI `db push` from a separate
development-only work directory. This is the only workflow that records
successful migrations in `supabase_migrations.schema_migrations`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-ApplicationSigningDevelopmentDeployment.ps1 -Apply -SupabaseWorkDirectory <development-only-work-directory>
```

The confirmation phrase is:

```text
APPLY-DEVELOPMENT-SIGNING-MIGRATIONS
```

The workflow never uses the repository's existing CLI link, `db reset`, or
migration repair. The separate work directory must contain `project_id =
"twehxvixkfgtbaohnnon"` and byte-identical reviewed migration files. Any
unexpected history, partial signing object, CLI/SQL failure, or metadata mismatch
stops execution without retry, reset, repair, rollback, or deployment action.

## Required synthetic adapter results

The generated JSON array must contain one `PASS` record for each test name:

- `successful_submission`
- `requested_correction`
- `expired_session`
- `duplicate_submission`
- `cross_account_authorization`
- `atomic_rollback`
- `concurrent_submission`

The orchestrator writes `report.json` and `report.md` under
`artifacts/application-signing-deployment/<timestamp>/`. A successful script
run is still development integration evidence only; it is not production
approval.
