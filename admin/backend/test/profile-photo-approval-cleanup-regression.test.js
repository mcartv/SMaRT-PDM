const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const queueSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/ProfilePhotoQueue.jsx'),
  'utf8'
);
const serviceSource = fs.readFileSync(
  path.resolve(__dirname, '../services/adminProfilePhotoService.js'),
  'utf8'
);
const controllerSource = fs.readFileSync(
  path.resolve(__dirname, '../controllers/adminProfilePhotoController.js'),
  'utf8'
);
const routeSource = fs.readFileSync(
  path.resolve(__dirname, '../routes/adminProfilePhotoRoutes.js'),
  'utf8'
);
const validationSource = fs.readFileSync(
  path.resolve(__dirname, '../middleware/profilePhotoReviewValidationMiddleware.js'),
  'utf8'
);
const studentProfileSource = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/src/services/profileService.js'),
  'utf8'
);

test('profile-photo approval queue is focused and exposes clear scholar identity', () => {
  assert.match(queueSource, /Profile Photos/);
  assert.match(queueSource, /student\.display_name/);
  assert.match(queueSource, /getStudentCode\(student\)/);
  assert.match(queueSource, /student\.course_code/);
  assert.match(queueSource, /Search student/);
});

test('detail review clearly compares submitted and current approved photos', () => {
  assert.match(queueSource, /label="Submitted Photo"/);
  assert.match(queueSource, /label="Current Approved Photo"/);
  assert.match(queueSource, /submitted_url/);
  assert.match(queueSource, /current_avatar_url/);
});

test('approve and reject actions only appear for pending review records', () => {
  assert.match(queueSource, /const canReview = detail\?\.status === 'pending'/);
  assert.match(queueSource, /onClick=\{handleApprove\}/);
  assert.match(queueSource, /setShowRejectModal\(true\)/);
  assert.match(serviceSource, /Only pending profile photo reviews can be approved/);
  assert.match(serviceSource, /Only pending profile photo reviews can be rejected/);
});

test('review page has proper loading and empty states', () => {
  assert.match(queueSource, /Loading profile photo review/);
  assert.match(queueSource, /Loading profile photo reviews/);
  assert.match(queueSource, /No profile photo reviews found/);
});

test('rejection uses a custom modal and never browser prompt', () => {
  assert.match(queueSource, /function RejectModal/);
  assert.match(queueSource, /Reject Profile Photo/);
  assert.doesNotMatch(queueSource, /window\.prompt|prompt\(/);
});

test('rejection reason is required and must be useful', () => {
  assert.match(queueSource, /Rejection reason/);
  assert.match(queueSource, /required/);
  assert.match(validationSource, /reason\.length < 10/);
  assert.match(validationSource, /at least 10 characters/i);
  assert.match(routeSource, /validateProfilePhotoRejection/);
});

test('rejection keeps a separate optional remarks field', () => {
  assert.match(queueSource, />\s*Remarks\s*</);
  assert.match(serviceSource, /remarks:\s*safeText\(remarks\) \|\| null/);
});

test('rejection reason is persisted and exposed to the student', () => {
  assert.match(serviceSource, /rejection_reason:\s*reason/);
  assert.match(
    serviceSource,
    /message:\s*`Your profile photo was not approved\. Reason: \$\{reason\}`/
  );
  assert.match(studentProfileSource, /avatar_rejection_reason/);
  assert.match(studentProfileSource, /review\.rejection_reason/);
});

test('approval and rejection notify the student', () => {
  assert.match(serviceSource, /Profile Photo Approved/);
  assert.match(serviceSource, /Profile Photo Rejected/);
  assert.match(serviceSource, /\.from\('notifications'\)/);
});

test('profile-photo decisions are audit logged', () => {
  assert.match(controllerSource, /auditLogService/);
  assert.match(controllerSource, /logAudit/);
  assert.match(controllerSource, /APPROVED_PROFILE_PHOTO_REVIEW|APPROVED_PROFILE_PHOTO|APPROVED_PROFILE_PHOTO_REVIEW|actionTaken/);
});

test('queue refreshes in realtime after approval or rejection', () => {
  assert.match(queueSource, /profile-photo-review:approved/);
  assert.match(queueSource, /profile-photo-review:rejected/);
  assert.match(queueSource, /loadQueue\(status,\s*\{\s*quiet:\s*true\s*\}\)/);
  assert.match(controllerSource, /profile-photo-review/);
  assert.match(controllerSource, /socketEvents\.emitEvent/);
});
