# Operational pagination implementation

Implemented against main commit `6aaeebb9` after verifying the remote main branch and fast-forwarding the clean local checkout.

## Endpoints and strategies

All converted screens send `page` and `limit`. List responses provide `items`, `pagination`, and, where needed, global `summary` and `filters` metadata. Pagination includes the filtered total, total pages, and previous/next flags. Invalid page/limit values return a validation error; limits are capped at 100. Out-of-range pages clamp to the last available page, with empty results represented as page 1 of 1.

| Screen | Endpoint | Page size | Database strategy |
|---|---|---:|---|
| Scholar Monitoring | `GET /api/scholars` | 10 | SQL filters, deterministic ordering, LIMIT/OFFSET; avatars resolved for page rows only |
| Removed scholars | `GET /api/scholars/removed` | 10 | Same paging contract with existing archive eligibility |
| SDO Scholar List | `GET /api/scholars?view=sdo` | 10 | Shared scholar pagination; global disciplinary counters |
| Renewals | `GET /api/renewals` | 10 | Current-period and source-opening eligibility applied in SQL; enrichment constrained to page IDs |
| Payout batches | `GET /api/payouts` | 6 | Select filtered batch IDs first, then aggregate nested scholars for those batches only |
| Opening Applications | `GET /api/program-openings/:openingId/applications` | 10 | Canonical student/opening selection and global FCFS ordering/ranks before LIMIT/OFFSET |
| Endorsement queues | `GET /api/endorsement-slips/sdo`, `/guidance`, `/pd` | 10 | Verified-application gate, office visibility, and PD course authorization before count/paging |
| All Endorsements Tracker | `GET /api/endorsement-slips?scope=all` | 10 | Shared endorsement service; independent active and office-processed pages |
| Announcements | `GET /api/announcements`, `/api/announcements/archived` | 10 | SQL archive scope, search/status filters, deterministic ordering and LIMIT/OFFSET |
| Profile Photo Review | `GET /api/admin/profile-photos` | 10 | SQL status/search, student visibility and ownership before paging; aggregate global status counts |

Opening details (`GET /api/program-openings/:openingId`) now calculate their counters using SQL aggregates. They no longer materialize every application alongside each applicant page. The applicant list separately returns global current/approved/FCFS counts and the next FCFS applicant.

## Filters and behavior

- Scholars: name and student-number search, program, academic year, semester, scholarship status and sorting. SDO search also covers program, academic year and course, with disciplinary standing filtering and program/batch sorting.
- Renewals: name/student-number search, program, academic year, normalized renewal status and sorting. Existing current-period and different-source-period eligibility are preserved.
- Payouts: search and active/status/completed/archive tabs. Program, academic year, semester and batch-status query filters are supported.
- Opening applications: search and current/approved/final-selection views, with application/selection status query filters. Canonical application selection, FCFS queue positions, fallback ranks and next-in-line metadata are global, rather than page-local.
- Endorsements: search, office decision status, result, program, course, year, sorting, tracker workflow status and tabs. Counts and filter options retain authorized-source scope.
- Announcements: search, status, active/archive scope, audience and program query filters. Scheduled publication, scheduler gating, unique views and the existing 60-second reconciliation remain intact.
- Photo reviews: lifecycle status and student identity search. Counters preserve archive and student/review ownership rules across all statuses.

Filter, sort and tab changes synchronously request page 1. Shared request guards prevent old pages, overlapping realtime refreshes, and queued callbacks from replacing current results. Realtime events and existing fallback intervals refresh the requested page. Existing cards, tables, dialogs and actions remain in place; pagination controls were added where absent.

## Compatibility and intentionally complete queries

The ordinary list endpoints retain raw-array behavior when neither `page` nor `limit` is supplied. This preserves existing dashboard consumers such as Admin Dashboard and Office Dashboard. Converted operational screens always request pagination. Photo review already returned an object and now additionally returns pagination metadata.

Mobile backend/app consumers were searched. Their announcement, payout and renewal APIs use separate mobile services/routes and were not changed. Actions, reports/exports, existing optimized registries, audit logs, notifications, messaging and small reference/configuration datasets were not modified.

Complete datasets remain intentional for legacy dashboard list consumers, report/export paths, business operations such as FCFS queue synchronization and eligible-scholar selection, and existing opening-summary aggregation outside the converted opening-detail read. Exact totals and global filter/counter aggregates still examine the authorized dataset in PostgreSQL. Broad substring search and deep OFFSET pages remain potential costs at substantially larger volumes. A payout page still includes every scholar in its six selected batches to preserve the existing cards and actions; lazy detail loading would be a separate optimization.

## Index migration

`supabase/migrations/20261006121112_operational_list_pagination_indexes.sql` was created using the Supabase CLI after checking both existing migrations and the configured test database's `pg_indexes`.

It adds:

- Active announcement ordering by `created_at, announcement_id`.
- Archived announcement ordering by `updated_at, announcement_id`.
- Payout ordering by `coalesce(is_archived, false), created_at, payout_batch_id`.

Existing scholar lookup, renewal-period, payout-entry, FCFS, endorsement-stage and photo-review status indexes were retained. **The migration is local and has not been applied to the database.**

## Files changed

- Backend helper: `admin/backend/utils/listPagination.js`.
- Backend services: `scholarService.js`, `renewalService.js`, `payoutService.js`, `programOpeningService.js`, `endorsementSlipService.js`, `announcementService.js`, `adminProfilePhotoService.js` under `admin/backend/services/`.
- Backend controllers: `scholarController.js`, `renewalController.js`, `payoutController.js`, `programOpeningController.js`, `endorsementSlipController.js`, `announcementController.js` under `admin/backend/controllers/`.
- Frontend shared files: `admin/frontend/src/hooks/useListPage.js`, `admin/frontend/src/components/ServerPagination.jsx`.
- Frontend pages: `ScholarMonitoring.jsx`, `SDOScholarList.jsx`, `PayoutManagement.jsx`, `OpeningApplications.jsx`, `EndorsementQueue.jsx`, `AllEndorsementsTracker.jsx`, `AnnouncementsManagement.jsx`, `ProfilePhotoQueue.jsx` under `admin/frontend/src/pages/`.
- Added tests: `admin/backend/test/_operational-pagination-test-utils.js`, `operational-list-pagination.test.js`, `operational-list-pagination-db.test.js`, and `admin/frontend/test/operational-pagination.test.mjs`.
- Updated contracts: `admin/backend/test/announcement-schedule-gate.test.js`, `payout-active-cards-archive-regression.test.js`, `profile-photo-pending-superseded-contract.test.js`.
- The migration above and this report.

## Verification actually run

| Check | Result |
|---|---|
| Focused pagination tests, including read-only PostgreSQL fixtures | **38 passed**: 22 backend regression checks, 2 database checks, 14 frontend checks |
| PostgreSQL EXPLAIN checks on generated queries against configured test database | **22 query plans accepted** |
| `npm --prefix admin/frontend run build` | **Passed**; existing dependency/bundle-size warnings remain |
| ESLint on all changed frontend pages and shared files | **Passed** |
| `npm --prefix admin/frontend run lint` | 4 errors in unchanged `AdminMessages.jsx`, plus 2 existing hook warnings in unchanged preview/verification files |
| `npm --prefix admin/backend test` | 526 passed, 9 failed, 2 database tests skipped by default |
| `node --test` across `admin/frontend/test/*.mjs` | 58 passed, 17 failed |
| Unchanged-main backend baseline | 503 passed, the same 9 failure titles |
| Unchanged-main frontend baseline | 44 passed, the same 17 failure titles |
| `git diff --check` | **Passed** |

The baseline used a read-only Git file overlay with checkout line-ending filters; it did not reset or modify the working tree. The full-suite failures match unchanged main. The database fixture tests were explicitly enabled and passed separately; they execute SELECTs in read-only sessions and do not create or modify database records.

To rerun the focused tests in PowerShell:

```powershell
$env:PAGINATION_DB_TESTS = 'true'
node --test admin/backend/test/operational-list-pagination.test.js admin/backend/test/operational-list-pagination-db.test.js admin/frontend/test/operational-pagination.test.mjs
```

Database checks require the existing backend `DATABASE_URL`. No authenticated browser walkthrough or live release/approval actions were executed. No deployment or database migration application was performed.
