# Global notification creation policy review

The current working tree was inspected before editing. The existing Mobile bridge INSERT-only policy guard, its four local tests, and the single policy check in `insertNotificationFallback()` were preserved. No UI, Flutter, scheduler, announcement publication API, or old migration files were changed.

## Findings and changes

Read-only inspection of the configured `smart_pdm_test` database confirmed:

| Database path | Creation route | Fix |
| --- | --- | --- |
| Application submission/status triggers | Staff/student helpers → `create_notification()` | Shared helper returns NULL while OFF, before flood-guard work |
| Endorsement and scholarship status triggers | Staff/student helpers → `create_notification()` | Inherit shared guard; original functions/triggers unchanged |
| Announcement trigger | Direct set-based INSERT after existing-card cleanup/update | Guard only fanout; preserve updates, deletes, read state, metadata and dedupe |
| Direct Node INSERTs and repository RO timeout RPC | Bypass shared helper | INSERT-only table guard suppresses creation; UPDATE/DELETE remain allowed |

The new migration copies the inspected definitions of `create_notification()` and `notify_announcement_published()` and changes only their creation guards. It preserves signatures, return types, SECURITY DEFINER, search_path, existing ACLs, enum values, flood limits, source metadata, unique indexes and existing triggers. A new `trg_notifications_creation_policy` BEFORE INSERT trigger provides the final database guard. No production tables or existing notification rows are created, dropped, deleted or reset by the migration.

The Mobile `/notification-batch` endpoint now validates its existing event whitelist before gating only `notification:new`/`notification:created`. `notification:updated` is allowed while OFF. Internal authentication and existing batch/recipient validation remain enforced; DELETE was not added.

Admin announcement synchronization now updates/deletes existing cards while OFF and checks policy only for missing-recipient INSERTs. Notification services and the application fallback accept an INSERT suppressed by PostgreSQL without treating an empty result as an error. Mobile skips realtime relay and push when no notification was created.

Policy caches still share concurrent reads, cache OFF, retain the last known value on failure, and reject stale reads after a settings event. Their retry cooldown now begins at read completion, so a slow failure cannot cause immediate repeated reads/logs.

The audit also found a malformed `createUserNotificationOnce()` INSERT: ten columns had nine values, and untyped parameters conflicted with varchar/text inference. The targeted fix supplies NULL for `read_at`, the missing `push_sent` value, and explicit parameter casts. Its actual SQL was executed against local PostgreSQL and verified for creation, dedupe and database suppression.

Existing Node creation paths, Admin socket delivery gating, Mobile push gating, settings relay/cache invalidation, and Flutter OFF→ON refresh/revision checks were inspected. Flutter UPDATE/DELETE handlers remain active while OFF. Realtime aliases deduplicate notification IDs on the clients. No new recurring REST polling, logging loop or delivery channel was introduced.

## Scheduler

The optimized scheduler is unchanged: five-second timer, local cached due-time checks, 60-second reconciliation, realtime invalidation, read/publication backoff, and PostgreSQL advisory leader lock. Existing regression tests prove one idle reconciliation read per minute and publication eligibility on the next five-second tick after a known scheduled time. A database test also proves Scheduled→Published still succeeds with notifications OFF and creates no notification cards. Timing remains subject to normal service/database availability and existing failure backoff.

## Exact files

| File | Work |
| --- | --- |
| `admin/backend/config/notificationPolicy.js` | Full cooldown after slow reads |
| `mobile/backend/src/config/notificationPolicy.js` | Same cache correction |
| `admin/backend/services/applicationService.js` | Preserve existing single guard; accept suppressed fallback INSERT |
| `admin/backend/services/notificationService.js` | OFF announcement synchronization, suppressed INSERT handling, valid once-only SQL |
| `mobile/backend/src/services/notificationService.js` | Suppressed INSERT returns NULL before relay/push |
| `mobile/backend/src/routes/internalRealtimeRoutes.js` | Batch creation-only policy gating |
| `mobile/backend/src/services/realtimeBridgeService.js` | Existing local INSERT-only guard preserved without further edits |
| `admin/backend/test/global-notification-switch.test.js` | Slow-read cooldown, ON push and revised synchronization validation |
| `admin/backend/test/notification-creation-policy-regression.test.js` | New synchronization, suppression, fallback and exact function-preservation tests |
| `mobile/backend/test/notification-batch-policy.test.js` | New ON/OFF endpoint, authentication, whitelist and validation tests |
| `mobile/backend/test/notification-switch-realtime.test.js` | Existing four local tests preserved unchanged |
| `supabase/migrations/20261004171730_enforce_global_notification_creation_policy.sql` | New migration generated with Supabase CLI; not applied remotely |
| `supabase/tests/fixtures/notification_policy_baseline.sql` | Inspected function definitions and synthetic isolated schema; refuses existing notification tables |
| `supabase/tests/notification_creation_policy.sql` | 36 executable PostgreSQL assertions, including reapplication and original trigger/function preservation |
| `supabase/tests/notification_node_sql.cjs` | Actual Node SQL helper test against fixed disposable localhost database |
| `docs/notification-policy-review.md` | This review and validation report |

## Validation

- Targeted Admin tests: **32 passed**, including notification policy, creation regression, schedule gate and announcement timing tests.
- Targeted Mobile tests: **12 passed**, including all four existing local realtime tests and eight batch tests.
- Local PostgreSQL: **36 assertions passed** against synthetic data and inspected function definitions; the migration was applied twice to verify idempotence.
- Actual Node SQL helper: passed creation, dedupe, NULL `read_at`, and database OFF enforcement with deliberately stale Node ON.
- Syntax checks passed for every modified/new backend JavaScript file and the standalone SQL test runner. `git diff --check` passed.
- Full backend suites: Admin **501/509 passed**, Mobile **364/365 passed**. The same **9 pre-existing unrelated failures** remain: account management copy; Mobile system-message test extraction; web removal-message presentation; two OCR presentation expectations; payout proof copy; removed-scholar profile copy; renewal availability copy; privacy personnel wording. No new notification/scheduler failures were introduced.

Run the focused JavaScript tests from their backend directories:

```text
node --test test/global-notification-switch.test.js test/notification-creation-policy-regression.test.js test/announcement-schedule-gate.test.js test/scheduled-announcement-timing-regression.test.js
node --test test/notification-switch-realtime.test.js test/notification-batch-policy.test.js
```

Run the database tests only on a fresh disposable local PostgreSQL database named `smart_pdm_notification_policy_test`, then the Node SQL test from the repository root. The test runner defaults to localhost port 55439; `SMART_PDM_NOTIFICATION_TEST_PORT` can change the local port.

```text
psql -X -h 127.0.0.1 -p 55439 -U postgres -d smart_pdm_notification_policy_test -v ON_ERROR_STOP=1 -f supabase/tests/notification_creation_policy.sql
node supabase/tests/notification_node_sql.cjs
```

## Deployment status and limits

All changes remain local: no commit, push, deployment or hosted database mutation was performed. PostgreSQL enforcement becomes active only after applying the new migration. Node/realtime changes require backend deployment.

The table guard adds an indexed local settings lookup for each attempted notification INSERT. It adds no Supabase REST polling. Settings delivery/push caches still retain their existing 60-second TTL when a settings relay is missed; database creation uses the database setting directly. In-flight database statements follow PostgreSQL transaction snapshot visibility.

The migration was built from the configured database's inspected definitions. Verify those definitions still match before applying to another environment; the source-preservation contract and snapshot fixture document the expected baseline. Firebase sending was mocked; no real push was sent. The nine unrelated full-suite failures and previously reported frontend lint issues are outside this notification-only change.

Function security/search-path handling was checked against the [official Supabase function documentation](https://supabase.com/docs/guides/database/functions).
