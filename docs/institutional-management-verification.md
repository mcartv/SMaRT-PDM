# Institutional Management handover

Implementation retains the existing Maintenance navigation, cards, theme, actions and modal styling. Institutional Management has Offices & Departments and Courses only. Community Service remains a separate Maintenance module with its existing settings, independent Add Area action and Personnel-In-Charge controls.

## Manual database execution

No migration was applied to Supabase. Review and execute these files in order:

1. `supabase/migrations/20261020145715_institutional_management.sql`
2. `supabase/migrations/20261020153228_institutional_office_reconciliation.sql`
3. `supabase/migrations/20261020155906_office_dean_applicability.sql`
4. `supabase/migrations/20261020160544_official_office_display_names.sql`
5. `supabase/migrations/20261020162255_official_office_account_catalog.sql`

The first adds office metadata, Dean eligibility/assignment relationships, a supplemental Dean role with **no default permissions or primary portal**, managed Dean-role grant tracking and optional links to existing Community Service Areas. New tables have RLS enabled and no access granted to anon/authenticated; permission-protected backend routes use the existing PostgreSQL connection.

The second adds missing official offices only. It recognizes existing office codes and known historical names. It neither renames nor deletes existing offices and aborts on ambiguous matches. It does not alter courses, student records, Program Director assignments, staff offices or Community Service Areas. The applicability migration marks only CHTM, CCS, Office Administration Program Head and Teacher Education Program Head as displaying Dean controls. It preserves existing personnel and assignment records. The fourth migration applies the exact ten office names requested, including (CCS)/(CHTM), while preserving office IDs and references. It aborts on duplicate/ambiguous matches, preserves independent RO Personnel area assignments and does not delete extra legacy records. The fifth migration limits the institutional catalog to the ten requested offices. Extra legacy locations remain in the database for existing references, but are excluded from the office module and new account/course selections. Existing Community Service Areas are untouched. All scripts were executed twice against an isolated embedded PostgreSQL fixture to check syntax, relationships and repeat execution.

## Read-only database review

The connected project was inspected without writes. Nine of the ten requested official offices matched existing records uniquely. Office for Research and Development was missing. Several retained names differ from the requested wording; explicitly rename them through Edit after reviewing their references.

`Educ Office` currently owns BECED and BTLED while the separate Teacher Education Program Head office also exists. BSOAD and BSEntrep have no supervising office. These are intentionally left for explicit review and reassignment, rather than guessing which office should own them.

Additional offices such as Clinic, Library and Accounting remain intact. Matching Community Service names do not prove duplicate institutional records. Review staff/course usage before archiving a record, and use Community Service → Office link to connect an existing area without copying or merging records.

## Account office selection

All ten approved names were confirmed to exist exactly once and be active in a read-only check of the connected project. Account creation/editing now uses the same active database office catalog for every role rather than role-specific office allowlists. Office selection does not grant role permissions. Office additions/changes refresh account choices on maintenance events.

For Community Service Personnel-In-Charge, Office and Community Service Area are separate form fields. The selected institutional office is stored in admin_profiles.office_id; the existing independent area assignment remains intact. Existing accounts with legacy offices are not automatically reassigned. Editing such an account shows its current assignment and requires an explicit official office selection before saving.

## Staff and course behavior

If the office-name migration reports ambiguous Teacher Education records, first review and manually run `admin/backend/sql/reconcile_teacher_education_office.sql`, then rerun the updated office-name migration. Read-only inspection found the EDUC office owning BECED/BTLED and the older Program Head office holding two staff accounts and the PD office mapping, with no leadership or Community Service link conflicts. The repair keeps the course-owning office ID, moves the older office's references, preserves accounts/course IDs/PD review assignments, and retains the old office as an archived legacy record. It records audit snapshots, stops on unexpected identities or conflicting leaders/area links, and was verified twice against the reproduced split in isolated PostgreSQL, including a missing supports_dean column. No live reconciliation was applied.

- Office and course editors write the same `academic_course.office_id` relationship. One course has one supervising office. Moving a course shows its existing owner, requires confirmation and rejects stale ownership. Both writers use the same transaction lock.
- Existing course IDs, students, scholarships and Program Director review assignments are preserved. The office's Program Director list derives from active course assignments and updates on reload or related maintenance events.
- Existing accounts can receive the Dean position through Update Account. Only active accounts with an active Dean position are eligible in the office editor. The existing portal role is preserved, including during archival, using internal primary-role metadata.
- One Dean relationship per office is enforced by the database. Changing/removing it requires confirmation and a stale assignment check. The service manages only the supplemental Dean role, with no administrator permission grants. Previously granted manual Dean membership is preserved when removing an office-managed assignment.
- Remove active Dean assignments before clearing that account's Dean position. Archiving disables account roles; restoring an assigned Dean reactivates the supplemental role. Archived accounts remain visible as historical office members.
- Office archival preserves relationships. Reassign active staff first. The OSFA office remains protected against archival to preserve the existing account workflow; its details can be edited.
- The Offices list has a Use as Service Area action that links an existing area or creates one using the office name. Repeating it does not create duplicates. Community Service retains independent Add/Edit Area actions.
- Community Service no longer configures, displays, submits or enforces course restrictions. Historical ro_department_courses rows remain intact but are unused; the old write endpoint returns HTTP 410 and the compatibility read endpoint returns empty mappings. Scholar existence and active-area validation remain enforced.
- Community Service links are optional and separate from academic ownership and PIC. An office can link to one existing area. Concurrent/stale edits and duplicate links are rejected.

## Actual verification results

- **57 backend regression tests passed**, covering office services, Dean role lifecycle, RBAC permissions, account boundaries, login contracts, PD archive/restore and Community Service transaction behavior.
- **Embedded PostgreSQL verification passed** using the real migration files and real office/course/Community Service service SQL: repeat migrations, preservation of legacy office records, missing office creation, Dean uniqueness/role changes and archived portal identity, course ownership/reassignment, derived PD lists, independent area links, archive/restore, transactional rollback on audit failure, and rejection of ambiguous reconciliation.
- **Browser checks passed** against an isolated local HTTP API and service fixture: office creation/details, Dean removal confirmation, course reassignment from both editors, independent Community Service office linking, and preservation of student/PD/PIC records.
- Office modal bounds and footer fit passed at **320, 375, 768, 1280 and 1920px**. Actual mouse-wheel scrolling passed in the mobile modal. Dark-theme text/background were inspected.
- **Frontend production build passed.** Existing ExcelJS eval and bundle-size warnings remain.
- Targeted ESLint passed for Institutional Management, Offices, Courses, Maintenance, Community Service and the new shared controls. AccountsPanel now passes targeted lint as well. The broader RBAC lint run reports **seven existing unused-variable/function findings in RBACPanel (reported as ESLint errors)**, outside the functionality added here.

The live application still needs validation after manual migration execution, particularly with actual eligible Dean accounts and current production permissions. Isolated verification does not replace that check.

## Reproduce the offline SQL check

The temporary PostgreSQL engine is intentionally not added to production dependencies. In PowerShell:

```powershell
$institutionalSqlCheck = Join-Path $env:TEMP 'smartpdm-institutional-sql-check'
npm install --prefix $institutionalSqlCheck --no-save --package-lock=false @electric-sql/pglite
$env:PGLITE_MODULE = Join-Path $institutionalSqlCheck 'node_modules/@electric-sql/pglite'
node admin/backend/scripts/verifyInstitutionalManagement.cjs
```

This script creates only an in-memory PostgreSQL database and never imports the application's database configuration or connects to Supabase.
