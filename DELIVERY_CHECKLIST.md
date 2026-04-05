# Delivery Checklist and Next Build Order

This document tracks what is already available in the SMaRT-PDM repo, what is partially implemented, what is still missing, and the recommended order for completing the platform before deployment.

## Summary

The current foundation is strong enough to keep building on:
- mobile auth and OTP flows exist
- the mobile intake form already saves into `students`, `student_profiles`, `student_family`, and `student_education`
- admin application review, announcements, RO admin, scholar monitoring, and messaging already have working foundations

The recommended priority is:
1. finish the application form and document flow
2. harden mobile/backend auth
3. close the remaining admin/mobile operational gaps

## Delivery Checklist

### Implemented

- Create / publish / archive announcements
- Target audience filter for announcements (`all students / scholars / applicants`)
- Create / assign RO endpoint (admin-side)
- RO status update handling (`pending / verified / overdue`) on the admin side
- Admin scholar read endpoints:
  - `GET /api/scholars`
  - `GET /api/scholars/stats`
  - `GET /api/scholars/:id`
- Admin JWT middleware in `admin/backend/middleware/authMiddleware.js`
- Avatar upload to Supabase Storage
- Socket-based messaging persistence
- Profile-first mobile intake save through `POST /api/applications` into:
  - `students`
  - `student_profiles`
  - `student_family`
  - `student_education`

### Partial

- JWT token auth middleware
  - Admin backend uses real JWT middleware
  - Mobile/backend API still returns mock auth tokens and does not fully protect routes yet
- `POST /apply` equivalent
  - Current route is `POST /api/applications`
  - Supports intake save and conditional `applications` creation
  - Full upload-backed application filing is not complete yet
- `GET /applications` for admin
  - Admin list exists
  - Backend pagination and filters are not implemented yet
- `PATCH /applications/:id/status`
  - Related status endpoints exist
  - One normalized approve/reject/flag endpoint does not exist yet
- File upload to storage (`PDF`, `JPG`)
  - Avatar storage is working
  - Application document upload flow is still missing
- Scholar profile CRUD endpoints
  - Read endpoints exist
  - Full create/update/delete does not
- SDO offense integration
  - `sdo_status` is already read and reflected
  - No formal integration/sync/update workflow yet
- Scholar status update logic (`active / at-risk / probation`)
  - Some views infer status from current data
  - No formal backend rules engine/workflow yet
- In-app notifications panel
  - Mobile UI exists
  - It still uses mock data instead of backend notification APIs

### Missing

- Grade submission endpoint + GWA calculation
- Registrar enrollment verification endpoint
- Scholar submits completion proof
- SMS notification trigger on scholar approval
- Alpha testing for the full applicant-to-scholar flow
- Mobile smoke tests (`login -> apply -> upload -> track`)
- Formal bug triage / documented known issues deliverable

## Recommended Build Order

### 1) Finalize the application form

Keep the current profile-first flow stable and polish the UX.

Focus on:
- inline validation consistency across steps
- accurate success and error states
- backend response consistency
- safe normalization of constrained values
- verifying Supabase writes for:
  - `students`
  - `student_profiles`
  - `student_family`
  - `student_education`

### 2) Add real application document upload

Extend the current mobile intake so users can upload required documents.

Required outcomes:
- upload documents to Supabase Storage
- write file URLs into `application_documents`
- use this flow as the basis for true application filing later

### 3) Reintroduce scholarship-program selection

Bring `program_id` back into the mobile flow from a clear selection point.

When selected:
- `POST /api/applications` should create or update `applications`
- `application_documents` should be linked to the real application row
- success copy should say `application submitted` only when that is true

### 4) Normalize admin application operations

Improve admin-side API behavior:
- add backend pagination and filters for `GET /api/applications`
- add one normalized status endpoint for `approve / reject / flag / reviewed`
- keep old endpoints temporarily if the frontend still depends on them

### 5) Replace mock mobile auth with real JWT flow

Harden the mobile/backend boundary:
- sign real JWTs in `backend/server.js`
- add auth middleware to protected mobile/backend routes
- update the mobile API client to attach bearer tokens automatically
- keep admin JWT separate unless intentionally unified later

### 6) Wire real mobile notifications

Replace mock notification data with backend-driven data.

Recommended scope:
- add mobile list/read notification endpoints
- connect the mobile notifications screen to `notifications`
- optionally wire announcements after notifications are stable

### 7) Finish scholar operations

After applicant and auth flows are stable:
- add scholar-side RO completion submission endpoint
- decide whether scholar profile CRUD is mobile-facing, admin-facing, or both
- add scholar status rules once the supporting data flows are trustworthy

### 8) Add QA and release safety

Before deployment:
- create smoke tests for:
  - register
  - OTP verify
  - login
  - save profile
  - submit application with documents
  - review application
- add a tracked `KNOWN_ISSUES.md` or equivalent release checklist

## Immediate Next Checklist to Finalize the Form

- Verify the current form saves successfully without `program_id`
- Verify inline errors show for:
  - personal required fields
  - DOB / age mismatch
  - mobile too short / too long / wrong prefix
  - academic required fields
  - submit checkboxes
- Verify `student_family` no longer violates `highest_educational_attainment` constraints
- Verify the success screen says profile details were saved, not that a full application was submitted
- Verify no legacy sidecar application tables are touched during submission

## Assumptions

- The mobile flow remains profile-first until document upload and program selection are restored
- Application-form completion comes before production deployment and before mobile/backend JWT hardening
- The next high-value milestone after form stabilization is true application submission with document upload, not scholar/RO feature expansion
