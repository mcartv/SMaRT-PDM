# Admin Approval Workflow for Profile Pictures

## Summary
Add a moderation workflow where student avatar uploads no longer become active immediately. A new upload is stored as a pending submission, visible to admins in a dedicated review queue, and only becomes the active profile picture after explicit admin approval. If rejected, the student’s visible avatar is cleared. Moderation is restricted to `admin` accounts that resolve through `admin_profiles`.

## Implementation Changes
- **Data model**
  - Add a new table for avatar review records, e.g. `profile_photo_reviews`, instead of overloading `students.profile_photo_url`.
  - Store one row per upload attempt with: `review_id`, `student_id`, `user_id`, `storage_path`, `status` (`pending`, `approved`, `rejected`, `superseded`), `submitted_at`, `reviewed_at`, `reviewed_by_admin_id`, `rejection_reason`, and `remarks`.
  - Keep `students.profile_photo_url` as the currently active approved avatar only.
  - Preserve full history; do not delete rejected or superseded records.
  - Enforce at most one `pending` review per student in service logic. Because the chosen behavior is “block new upload while pending,” a second upload attempt should return `409`.

- **Student upload and profile read behavior**
  - Change `POST /api/auth/upload-avatar` so it:
    - uploads the image to storage,
    - creates a `pending` review row,
    - does **not** update `students.profile_photo_url`,
    - rejects upload with `409` if the student already has a pending review.
  - Extend `GET /api/profile/me` to return moderation state alongside the current profile, for example:
    - `avatar_url`: current approved avatar only,
    - `avatar_review_status`,
    - `avatar_pending_url` for preview if desired,
    - `avatar_rejection_reason`,
    - `avatar_reviewed_at`.
  - On rejection, clear `students.profile_photo_url` to `null` and mark the review row as `rejected`.
  - On approval, copy the approved review’s storage path into `students.profile_photo_url`, mark the review row as `approved`, and supersede any older non-final rows if they exist.

- **Admin backend endpoints**
  - Add a dedicated admin route group such as `/api/admin/profile-photos`.
  - Add endpoints:
    - `GET /api/admin/profile-photos?status=pending|approved|rejected`
    - `GET /api/admin/profile-photos/:reviewId`
    - `PATCH /api/admin/profile-photos/:reviewId/approve`
    - `PATCH /api/admin/profile-photos/:reviewId/reject`
  - Reuse the existing controller/service split used by admin application review.
  - Authorization rule:
    - require authenticated user,
    - require a matching `admin_profiles.admin_id`,
    - reject non-admin users with `403`.
  - Approval action should set `reviewed_by_admin_id`, `reviewed_at`, optional `remarks`, and update `students.profile_photo_url`.
  - Rejection action should require `rejection_reason`, set `reviewed_by_admin_id`, `reviewed_at`, optional `remarks`, clear `students.profile_photo_url`, and keep the rejected record in history.

- **Admin UI**
  - Add a new admin navigation item, e.g. `Profile Photos`.
  - Build a queue page modeled after the existing application/document review pages:
    - default filter = `pending`,
    - list columns: student name, PDM/student ID, submitted date, current status,
    - quick actions to open detail.
  - Build a detail/review page with:
    - full-size submitted image preview,
    - current approved avatar preview if one exists,
    - student identity summary,
    - approve button,
    - reject modal requiring rejection reason and optional remarks,
    - review history panel for prior approved/rejected/superseded uploads.
  - Admin UI should call the new admin endpoints only; do not piggyback on application review routes.

- **Student/mobile UX**
  - Profile screen should stop assuming a successful upload means the avatar is live.
  - After upload, show a pending state message instead of replacing the visible avatar immediately.
  - If the backend returns `409`, show a clear “You already have a profile picture pending review” message.
  - If a review is rejected, show the rejection reason from profile data and show no active avatar until a new submission is allowed.

- **Notifications**
  - Insert a notification for the student when an avatar is approved.
  - Insert a notification for the student when an avatar is rejected, including the rejection reason.
  - Notification reference type should be distinct from applications, e.g. `profile_photo_review`.

## Public API / Interface Changes
- `POST /api/auth/upload-avatar`
  - current behavior: activates avatar immediately
  - new behavior: creates pending moderation record and returns review metadata
- `GET /api/profile/me`
  - add avatar moderation fields so the mobile app can render pending/rejected states
- New admin endpoints under `/api/admin/profile-photos`
  - queue, detail, approve, reject
- New DB object
  - `profile_photo_reviews` table for workflow state and audit history

## Test Plan
- Student uploads first avatar with no existing approved photo:
  - upload succeeds,
  - review row is `pending`,
  - `students.profile_photo_url` remains unchanged,
  - profile response shows pending status.
- Student uploads while another review is pending:
  - backend returns `409`,
  - no second pending row is created.
- Admin lists pending reviews:
  - pending item appears with correct student metadata.
- Admin approves a pending review:
  - review becomes `approved`,
  - `students.profile_photo_url` is updated,
  - profile response shows active `avatar_url`,
  - approval notification is created.
- Admin rejects a pending review:
  - review becomes `rejected`,
  - `students.profile_photo_url` becomes `null`,
  - profile response shows rejection metadata,
  - rejection notification is created.
- Non-admin user calls admin profile-photo endpoints:
  - receives `403`.
- History view:
  - approved, rejected, and superseded records remain queryable and ordered by submission/review timestamps.

## Assumptions
- “Admin only” means users that resolve through `admin_profiles`, not general staff roles like SDO or Guidance.
- Full workflow UI is in scope for the admin frontend in the same pass as the backend endpoints.
- Rejection clears the active avatar even if the student previously had an approved one.
- Rejection reason is required; remarks remain optional.
