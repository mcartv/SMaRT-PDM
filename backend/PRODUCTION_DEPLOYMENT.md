# Production Connection and Deployment

## Architecture
- Flutter mobile calls the Node backend only.
- The Node backend is the only service that talks to Supabase with privileged credentials.
- The mobile app must never contain `SUPABASE_SERVICE_ROLE_KEY`.

## Backend env checklist
Create `backend/.env` locally from `backend/.env.example`.

Required variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `GMAIL_APP_PASSWORD`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_PHONE`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `RECAPTCHA_ANDROID_SITE_KEY`
- `PORT`

Optional variables:
- `JWT_EXPIRES_IN`
- `FCM_SERVER_KEY`
- `RECAPTCHA_MIN_SCORE`

Notes:
- `PORT` now falls back to `3000` when unset.
- In production, use the hosting platform's secret manager instead of committing `.env`.
- Rotate any secrets that were previously exposed.

## Database schema checklist
Run the SQL files in `backend/sql` against the target Supabase project before deploying backend changes that depend on them.

Relevant files for the applicant application flow:
- `application_form_schema.sql`
- `application_form_drafts_schema.sql`
- `account_recovery_schema.sql`

## Mobile config checklist
The mobile base URL is controlled in `mobile/smartpdm_mobileapp/lib/core/config/app_config.dart`.

Development:
- Default LAN URL can stay for local testing.
- Override when needed with `--dart-define=API_BASE_URL=http://<local-ip>:3000`.
- Override the Android reCAPTCHA site key when needed with `--dart-define=RECAPTCHA_ANDROID_SITE_KEY=<your-android-site-key>`.

Production:
- Always build with `--dart-define=API_BASE_URL=https://<your-backend-domain>`.
- Include `--dart-define=RECAPTCHA_ANDROID_SITE_KEY=<your-android-site-key>` in Android builds that use account recovery.
- Do not add Supabase secrets to Flutter config.

## Route -> Supabase mapping
### `POST /api/auth/register`
- Reads: `users`
- Writes: `users`
- Side effect: sends OTP email

### `POST /api/auth/verify-otp`
- Reads: `users`
- Writes: `users` (`is_otp_verified`)

### `POST /api/auth/resend-otp`
- No Supabase table write
- Side effect: sends OTP email

### `POST /api/auth/upload-avatar`
- Writes: Storage bucket `avatars`
- Writes: `users`

### `POST /api/auth/login`
- Reads: `users`
- Signs: JWT auth token

### `POST /api/auth/recovery/lookup`
- Reads: `users`
- Reads: `students`

### `POST /api/auth/recovery/start`
- Reads: `users`
- Reads: `students`
- Writes: `account_recovery_sessions`
- Side effects: creates a reCAPTCHA assessment and sends email or SMS

### `POST /api/auth/recovery/resend-code`
- Reads/Writes: `account_recovery_sessions`
- Side effects: sends email or SMS

### `POST /api/auth/recovery/verify-code`
- Reads/Writes: `account_recovery_sessions`
- Signs: short-lived password reset token

### `POST /api/auth/recovery/reset-password`
- Reads: `account_recovery_sessions`
- Writes: `users.password_hash`
- Updates: `account_recovery_sessions.consumed_at`

### `GET /api/notifications`
- Reads: `notifications`

### `GET /api/notifications/unread-count`
- Reads: `notifications`

### `GET /api/faqs`
- Reads: `faqs`

### `PATCH /api/notifications/:id/read`
- Updates: `notifications.is_read`

### `PATCH /api/notifications/read-all`
- Updates: `notifications.is_read`

### `DELETE /api/notifications/:id`
- Deletes: `notifications`

### `POST /api/notifications/device-token`
- Reads/Writes: `user_device_tokens`

### `GET /api/scholarship-programs`
- Reads: `scholarship_program`

### `GET /api/openings`
- Reads: `program_openings`
- Reads: `scholarship_program`
- Reads: `students`
- Reads: `scholars`
- Reads: `applications`
- Reads: `application_form_drafts`

### `GET /api/openings/latest`
- Reads: `program_openings`
- Reads: `scholarship_program`
- Reads: `students`
- Reads: `scholars`

### `GET /api/applications/me/form-data`
- Reads: `application_form_drafts`

### `PUT /api/applications/me/form-data`
- Reads: `program_openings`
- Reads/Writes: `application_form_drafts`

### `POST /api/applications`
- Compatibility alias for opening-bound submission
- Requires an `opening_id` in the request payload
- Uses the same tables as `POST /api/openings/:openingId/apply`

### `POST /api/openings/:openingId/apply`
- Reads: `program_openings`
- Reads: `scholarship_program`
- Reads: `users`
- Reads: `students`
- Reads: `scholars`
- Reads: `applications`
- Reads: `academic_course`
- Writes: `students`
- Writes: `users` contact fields
- Writes: `student_profiles`
- Writes: `student_family`
- Writes: `student_education`
- Writes: `applications`
- Writes: `application_documents`
- Deletes: `application_form_drafts`

### `GET /api/applications/me/documents`
- Reads: `students`
- Reads: `applications`
- Reads: `program_openings`
- Reads: `scholarship_program`
- Reads: `application_documents`
- Reads: `application_document_reviews`

### `POST /api/applications/me/documents/:documentKey/upload`
- Reads: `students`
- Reads: `applications`
- Writes: Storage bucket `application-documents`
- Writes: `application_documents`
- Updates: `applications.document_status`

### `GET /api/applications/:id`
- Reads: `applications`
- Reads: `users`
- Reads: `academic_course`
- Reads: `student_profiles`
- Reads: `student_family`
- Reads: `student_education`
- Reads: `application_documents`
- Reads: `application_document_reviews`

### `GET /api/messages/thread`
- Reads: `messages`

### `POST /api/messages/thread`
- Writes: `messages`

### `PATCH /api/messages/thread/read`
- Updates: `messages.is_read`

### `GET /api/messages/unread-count`
- Reads: `messages`

### `GET /api/messages/conversations`
- Reads: `messages`

### `GET /api/messages/conversations/:counterpartyId`
- Reads: `messages`

### `POST /api/messages/conversations/:counterpartyId`
- Writes: `messages`

### `PATCH /api/messages/conversations/:counterpartyId/read`
- Updates: `messages.is_read`

### Socket authenticated connect
- Reads: JWT auth token
- Emits: `notification:new`, `notification:updated`, `notification:deleted`
- Emits: `message:new`, `message:read`

## Render deployment
1. Push the repo to GitHub.
2. Create a new Render Web Service.
3. Point Render to the repo and set the root directory to `backend`.
4. Use:
   - Build command: `npm install`
   - Start command: `npm start`
5. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `GMAIL_APP_PASSWORD`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_PHONE`
   - `GOOGLE_CLOUD_PROJECT_ID`
   - `GOOGLE_APPLICATION_CREDENTIALS`
   - `RECAPTCHA_ANDROID_SITE_KEY`
   - `PORT` (optional if Render provides one)
6. Deploy and copy the public HTTPS URL.
7. Smoke test:
   - `POST /api/auth/register`
   - `POST /api/auth/login`
   - `POST /api/auth/recovery/lookup`
   - `POST /api/auth/recovery/start`
   - `POST /api/auth/recovery/verify-code`
   - `POST /api/auth/recovery/reset-password`
   - `GET /api/openings`
   - `PUT /api/applications/me/form-data`
   - `POST /api/openings/:openingId/apply`
   - `GET /api/applications/me/documents`

## Railway deployment
1. Create a new Railway project.
2. Add the `backend` service from the repo.
3. Use start command `npm start`.
4. Add the same environment variables as Render.
5. Deploy and copy the Railway public domain.
6. Run the same smoke tests.

## Mobile release commands
From `mobile/smartpdm_mobileapp`:

APK:
```bash
flutter build apk --dart-define=API_BASE_URL=https://<your-backend-domain>
```

App Bundle:
```bash
flutter build appbundle --dart-define=API_BASE_URL=https://<your-backend-domain>
```

## Production smoke checks
- Register a new user
- Verify OTP
- Login
- Load scholarship openings
- Save a draft payload
- Submit an opening-bound application payload
- Upload one document to the submitted application
- Open messages
- Upload avatar if enabled
- Confirm rows appear in the expected Supabase tables above

## Regression checks
- Admin flows still read `applications`, `students`, and related student tables correctly
- Draft autosave works only through `application_form_drafts` and does not create `applications` rows
- Direct messaging still persists to `messages`
- Mobile app no longer points to a LAN IP in production builds
