# Flutter Backend Workflow

This mobile app already uses a Node.js API in [backend/server.js](/c:/Users/Admin/OneDrive/Documents/GitHub/SMaRT-PDM/backend/server.js) with Supabase as the data store. The goal of this workflow is to keep Flutter UI code thin and make backend integration predictable.

## Request Flow

1. Screens call feature services instead of calling `http` directly.
2. Feature services use the shared API client.
3. The API client reads the base URL from `--dart-define=API_BASE_URL=...`, with a local-network fallback for development.
4. Auth responses are persisted in shared preferences through the session service.
5. Backend endpoints remain responsible for validation, normalization, and Supabase writes.

## Current Mobile Service Layers

- Config: [app_config.dart](/c:/Users/Admin/OneDrive/Documents/GitHub/SMaRT-PDM/mobile/smartpdm_mobileapp/lib/config/app_config.dart)
- Shared transport: [api_client.dart](/c:/Users/Admin/OneDrive/Documents/GitHub/SMaRT-PDM/mobile/smartpdm_mobileapp/lib/services/api_client.dart)
- Session persistence: [session_service.dart](/c:/Users/Admin/OneDrive/Documents/GitHub/SMaRT-PDM/mobile/smartpdm_mobileapp/lib/services/session_service.dart)
- Auth workflow: [auth_service.dart](/c:/Users/Admin/OneDrive/Documents/GitHub/SMaRT-PDM/mobile/smartpdm_mobileapp/lib/services/auth_service.dart)
- Application submission: [application_service.dart](/c:/Users/Admin/OneDrive/Documents/GitHub/SMaRT-PDM/mobile/smartpdm_mobileapp/lib/services/application_service.dart)
- Profile media upload: [profile_service.dart](/c:/Users/Admin/OneDrive/Documents/GitHub/SMaRT-PDM/mobile/smartpdm_mobileapp/lib/services/profile_service.dart)

## End-to-End Flows

### Registration

1. Flutter sends `email`, `password`, and `student_id` to `POST /api/auth/register`.
2. Backend validates format and uniqueness, hashes the password, saves the user, creates an OTP, and sends email.
3. Flutter routes to OTP verification with `user_id` and `student_id`.

### OTP Verification and Login

1. Flutter sends `email` and `otp` to `POST /api/auth/verify-otp`.
2. Backend verifies the OTP and marks the user as verified.
3. Flutter stores the returned session payload locally.
4. Login uses `POST /api/auth/login` and reuses the same local session storage.

### Application Submission

1. Flutter builds a normalized payload from `ApplicationData`.
2. Flutter submits it to `POST /api/applications`.
3. Backend validates program and course IDs, upserts student profile data, creates or updates the application, then writes related form tables.
4. Backend returns a normalized application payload for future detail screens.

### Profile Image Upload

1. Flutter uploads multipart form data to `POST /api/auth/upload-avatar`.
2. Backend stores the image in Supabase Storage and saves the public URL.
3. Flutter stores the returned image URL locally for immediate rendering.

## Recommended Next Backend Steps

- Add a real password-reset flow on the backend because the Flutter screen already calls `POST /api/auth/forgot-password`.
- Split [server.js](/c:/Users/Admin/OneDrive/Documents/GitHub/SMaRT-PDM/backend/server.js) into routes, controllers, and services before adding more scholar features.
- Replace the mock login token with signed JWTs and attach auth middleware to protected routes.
- Add document upload and profile update endpoints so the app stops relying on local-only edits for some profile fields.
