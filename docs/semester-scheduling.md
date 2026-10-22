# Semester scheduling

In Maintenance → Academic Years, open **Semester Schedule** on an unarchived year. Set First and Second Semester start/end dates and optionally enable automatic switching. Dates are inclusive and interpreted in Philippine time. Saving dates does not itself activate a semester; the backend checks enabled schedules every minute.

Validation rejects invalid dates, reversed terms, dates outside the academic-year range, overlapping semesters, and conflicts with enabled schedules in other unarchived years. Both terms save in one transaction. Existing dates cannot be pushed outside the year by shrinking its calendar.

Automatic switching uses the existing academic-period activation transaction and normal rollover workflow. It does not run Reset Test Cycle. Completed windows and semester breaks retain the existing current cycle. The scheduler refuses to move backward to a historical semester. A manual **Set Current** pauses automation for that academic year; re-enable it through Semester Schedule when needed.

Existing schedules and automation flags are preserved. Deploying the scheduler starts honoring any schedules that are already enabled. The inspected Supabase project already has `academic_semester_schedules`, so this change requires no new migration and no live database writes were performed during implementation. Other environments must have the existing `20261011190000_academic_semester_auto_schedule.sql` migration applied manually.

Verification:

- Offline PostgreSQL script: `admin/backend/scripts/verifySemesterSchedule.cjs` (supply `PGLITE_MODULE` for a temporary PGlite installation). Covers saved dates, atomic rollback, overlaps, year bounds, Philippine-midnight switching, repeated checks, failure/retry, disabled schedules, ended windows and breaks.
- Unit tests: `admin/backend/test/academic-semester-auto-validation.test.js`, including manual override and date status boundaries.
- Browser checks against simulated API responses at 320, 375, 768 and 1366px: existing dates load, invalid overlaps do not send requests, successful saves refresh statuses and retain new dates, and the modal has no horizontal overflow. No real accounts or academic records were mutated.

Restart/deploy the backend and refresh the frontend to use the new endpoints and minute-based scheduler. The backend must remain running for automatic activation.
