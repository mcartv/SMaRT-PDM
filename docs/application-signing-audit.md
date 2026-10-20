# Application signing audit

Audit date: 2026-10-20. This audit is based on the repository checkout only; no
live Supabase project, Storage bucket configuration, or deployed RLS policies
were inspected.

## Confirmed submission flow

1. `mobile/frontend/lib/features/applicant/presentation/screens/new_applicant_screen.dart`
   owns the five-step intake form: Personal, Family, Academic, Essay, Submit.
2. Its `_submitApplication` validates with `ApplicationSubmissionValidator`,
   fills blank optional family mobile fields with `N/A`, then calls
   `NewScholarProvider.submitApplication`.
3. `mobile/frontend/lib/features/forms/data/services/application_service.dart`
   sends `POST /api/applications/me/submit` with the JSON application payload.
4. `mobile/backend/src/services/applicationService.js` validates and persists
   profiles, family rows, education rows and the application. Only *after* the
   application insert/update does it create the five normal document slots and
   endorsement workflow.
5. The success route tells the applicant to upload documents after submission.
   `ApplicationFormPreviewScreen` is therefore a submitted-form review screen,
   not a pre-submission review screen.

## Existing reusable infrastructure

| Area | Confirmed implementation |
| --- | --- |
| Mobile multipart upload | `ApiClient.uploadFile` and `uploadBytes` support authenticated multipart requests. |
| File upload API | `POST /api/applications/me/documents/:documentId/upload`, protected by the mobile backend auth middleware. |
| Storage | The backend uses the service role only server-side, writes to the configured `documents` bucket, and produces signed URLs. Flutter does not contain a service-role credential. |
| Ownership/lifecycle checks | `uploadMyDocument` resolves the authenticated student, confirms application ownership, and applies `getApplicationDocumentUploadLock`. |
| Immutable history | `application_document_versions` and `finalize_application_document_upload` create a new version rather than overwriting the previous object. |
| Admin review | `admin/backend/routes/applicationRoutes.js` exposes RBAC-protected document list, signed-view URL, upload, and review endpoints. `DocumentVerification.jsx` consumes these. |
| Existing data entry | Family intake already has guardian-only state, same-address handling, Philippine mobile formatting, and server/client validation. |

## Schema and compatibility findings

Confirmed from migrations and code:

- `application_documents` has an application id, document type, submitted flag,
  private storage path, review fields, timestamps and `current_version_id`.
- `application_document_versions` retains upload versions. Existing migration
  `20260808083734_add_mobile_onboarding_preferences.sql` provides the server-only
  `finalize_application_document_upload` RPC.
- The current mobile slot set is limited to Birth Certificate/PSA, Certificate
  of Registration, Grade Report, Certificate of Indigency, and Letter of
  Request. The admin document alias/name maps have the same limitation.
- Current application edits are locked once review/selection conditions apply;
  these rules live in `getMySubmittedFormData` and upload locking in
  `getApplicationDocumentUploadLock`.

Not confirmed:

- The originating `CREATE TABLE` definitions, constraints and live RLS policies
  for `applications`, `application_documents`, and Storage are not present in
  the inspected migration set.
- Bucket privacy and deployed policies cannot be asserted without live Supabase
  access.

## Critical design constraint

The requested signing evidence must be uploaded and server-validated **before
the final application submission**, but the existing document slots are created
only by that final submission. Adding signature slots to the current documents
screen would be an after-submission workflow and would not satisfy the
requirement.

The minimum safe design is a pre-submission signing session associated with the
authenticated applicant and the application-form draft. It must store only
metadata in Postgres and private object paths in Storage. The final-submit
service must validate that session and atomically bind or copy its immutable
documents to the newly created application before reporting success. It must
also invalidate/re-confirm signing when signed form fields change.

## Recommended minimal vertical slice

1. Add versioned migration for a signing-session metadata table plus a
   server-only finalization RPC. Do not store image/base64 data in Postgres.
2. Add authenticated mobile-backend endpoints to create/read a session, upload
   allowed signing files under a server-generated private prefix, and return
   only authorized signed preview URLs.
3. Add a Signing step before Submit. It collects both drawings, guardian ID,
   name/relationship and consent; it uploads them to the session before the
   Submit button is enabled.
4. Make `submitMyApplicationForm` require a complete, owned, unexpired signing
   session and bind it to the application in the same database transaction/RPC.
   Do not create endorsements or report success until that operation succeeds.
5. Extend the existing admin document definition/review mapping and UI with the
   three signing documents and guardian metadata. Restrict correction to a
   reviewed `reupload_required` state.

## Risks

- Splitting creation and document binding across ordinary REST calls can leave a
  submitted application without required signing evidence. A database RPC is
  required for the final bind.
- The current generic document upload accepts extension/Multer MIME metadata;
  signing endpoints need magic-byte/type checks and smaller per-type limits.
- A signed URL cache must never bypass ownership/RBAC checks. Cache only after
  authorization, and keep the signing files in a private bucket.
- Application edits must invalidate a signing-session content hash and require
  a fresh consent/signature instead of silently retaining the old signature.
