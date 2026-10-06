# Pagination test records

These are manual SQL scripts for the test Supabase database used by localhost.
They are separate from migrations and will not run during deployment or `db reset`.

1. Open the SQL Editor in the Supabase project that your localhost backend uses.
2. Paste all of `pagination-seed.sql` and run it. It finishes with record counts.
3. Refresh localhost and use your existing admin/SDO/Guidance/PD accounts.
4. After testing, paste all of `pagination-cleanup.sql` and run it. Remaining test students should be **0**.

The scripts use transactions: an error rolls the changes back. If your SQL client
keeps an aborted transaction open, run `ROLLBACK;` before trying again.
Seeding twice is blocked; cleanup can be repeated and you can seed again afterward.

The insert/cleanup cycle was verified against the configured database in a
transaction that was rolled back. Checks cover record counts, FCFS eligibility,
office stages, duplicate-seed protection, repeat cleanup, and both creation and
reuse of an active period. No fixtures were left in the database by verification.

To repeat that verification from PowerShell:

```powershell
$env:PAGINATION_SEED_DB_TESTS = 'true'
node --test admin/backend/test/pagination-seed-db.test.js
```

## What to open

| Page | Fictional records |
| --- | --- |
| Scholar Monitoring / SDO scholars | 45 visible scholars; 15 removed scholars |
| Renewals | 45 records in the active period, with eight statuses |
| Opening Applications | Open **PAGINATION TEST Current Opening**: 144 applicants, including 24 approved and 24 completed endorsements eligible for FCFS |
| Endorsement queues | 24 pending at each office, plus completed and stopped records |
| All Endorsements | All application slips, including previous-opening history |
| Payouts | 12 active/status batches, 9 completed, 9 archived; 3 students each |
| Announcements | 45 active and 45 archived; Draft, Scheduled and Published |
| Profile Photo Review | 30 pending, 20 approved, 20 rejected, 20 superseded |

Search for `Pagination`, `PGTEST-`, or `PAGINATION TEST` as appropriate. Check page
2 and the last page, then change search/status/program/sort and check page resets
to 1. Verify the displayed total covers every matching record. Test realtime in
two browser tabs by changing a fictional record.

Pending endorsement applicants use the first active course assigned to a PD.
Use the PD responsible for that course. Existing assignments are not changed.
If no course is assigned, use the app to assign the chosen course before testing
the PD queue. SDO and Guidance queues retain their usual authorization rules.

## Scope and cleanup

- Every fictional student has a `PGTEST-` number and reserved IDs beginning with
  `e6d2e778`. Cleanup checks the markers before deleting parent records. Keep those
  identifying markers when editing test data.
- Cleanup deletes these students and their dependent test workflow records. It
  does not truncate tables. Existing staff, students, assigned courses, programs,
  and the existing current academic period are preserved.
- If no academic period is active, the seed creates and activates a fictional
  2098–2099 period. Cleanup removes it, returning to having no active period.
  If that reserved year already exists, insertion fails rather than replacing it.
- Notification creation is muted inside the seed transaction and restored before
  commit. No office notification fanout is committed by the seed itself. Normal
  browser actions afterward can generate notifications; cleanup removes the test cards.
- Programs are Draft and openings Closed, so this dataset is for staff list
  testing. It does not expose a new applicant signup flow.
- The fictional student accounts have disabled password hashes and `.invalid`
  emails. No Supabase Auth users are created and students cannot sign in.
- Photo reviews use a local SVG placeholder at
  `http://localhost:5173/pagination-test-avatar.svg`. If Vite uses another port,
  change that URL in the seed before running. No photo files are uploaded; use
  these records for list/status testing rather than the photo approval workflow.
- Applications are marked verified to populate office queues, but have no actual
  document uploads. Real approval/document-validation workflows still require
  valid documents. Do not use fictional payout records to generate real payments.
- If you upload files during testing, SQL cleanup does not remove Storage objects.
  Delete those uploads separately. Audit logs may remain as historical evidence.
- A foreign-key error during cleanup rolls the entire cleanup back. Inspect the
  reported dependent table rather than disabling constraints or deleting broadly.

Supabase recommends keeping seed data separate from schema migrations:
[database seeding documentation](https://supabase.com/docs/guides/local-development/seeding-your-database).
