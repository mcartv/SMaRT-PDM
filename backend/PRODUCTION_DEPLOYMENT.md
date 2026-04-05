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
- `GMAIL_APP_PASSWORD`
- `PORT`

Notes:
- `PORT` now falls back to `3000` when unset.
- In production, use the hosting platform's secret manager instead of committing `.env`.
- Rotate any secrets that were previously exposed.

## Mobile config checklist
The mobile base URL is controlled in `mobile/smartpdm_mobileapp/lib/config/app_config.dart`.

Development:
- Default LAN URL can stay for local testing.
- Override when needed with `--dart-define=API_BASE_URL=http://<local-ip>:3000`.

Production:
- Always build with `--dart-define=API_BASE_URL=https://<your-backend-domain>`.
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

### `GET /api/scholarship-programs`
- Reads: `scholarship_programs`

### `POST /api/applications`
- Reads: `scholarship_programs` when `program_id` is present
- Reads: `academic_course`
- Reads/Writes: `students`
- Writes: `users` contact fields
- Reads/Writes: `applications` when `program_id` is present
- Writes: `student_profiles`
- Reads/Writes: `student_family`
- Writes: `student_education`
- Writes: `application_documents` when an application row exists
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

### `GET /api/messages/:room`
- Reads: `messages`

### Socket `send_message`
- Writes: `messages`

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
   - `GMAIL_APP_PASSWORD`
   - `PORT` (optional if Render provides one)
6. Deploy and copy the public HTTPS URL.
7. Smoke test:
   - `POST /api/auth/register`
   - `POST /api/auth/login`
   - `GET /api/scholarship-programs`
   - `POST /api/applications`

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
- Submit application/profile payload
- Open messages
- Upload avatar if enabled
- Confirm rows appear in the expected Supabase tables above

## Regression checks
- Admin flows still read `applications`, `students`, and related student tables correctly
- Socket messaging still persists to `messages`
- Mobile app no longer points to a LAN IP in production builds
