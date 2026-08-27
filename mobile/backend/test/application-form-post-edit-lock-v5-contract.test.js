const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const service = fs.readFileSync(
  path.join(backendRoot, 'src', 'services', 'applicationService.js'),
  'utf8'
);

const preview = fs.readFileSync(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'application_form_preview_screen.dart'
  ),
  'utf8'
);

test('resubmitting a corrected Application Form always persists an awaiting-verification review row', () => {
  assert.match(service, /SMART_PDM_APPLICATION_FORM_REVIEW_ROW_ENSURE_V4/);
  assert.match(service, /select\('review_id'\)/);
  assert.match(service, /existingApplicationFormReview\?\.review_id/);
  assert.match(service, /document_key: 'application_form'/);
  assert.match(service, /document_name: 'Application Form'/);
  assert.match(service, /reason_code: 'APPLICATION_FORM_RESUBMITTED'/);
});

test('backend locks Edit Form while corrected form is awaiting verification', () => {
  assert.match(
    service,
    /applicationFormAwaitingVerification =\s*applicationFormReviewStatus === 'pending'[\s\S]*APPLICATION_FORM_RESUBMITTED/
  );
  assert.match(
    service,
    /const canEdit =\s*lifecycleCanEdit &&\s*!applicationFormAwaitingVerification &&\s*applicationFormReviewStatus !== 'verified';/
  );
});

test('backend exposes awaiting_verification to Preview Form', () => {
  assert.match(service, /awaiting_verification:\s*applicationFormAwaitingVerification/);
});

test('Preview Form disables Edit Form immediately after returning from editor', () => {
  assert.match(preview, /SMART_PDM_APPLICATION_FORM_IMMEDIATE_DISABLE_V4/);
  assert.match(preview, /_canEdit = false;/);
  assert.match(preview, /_awaitingVerification = true;/);
  assert.match(preview, /await _load\(\);/);
});

test('Edit Form button is actually disabled when canEdit is false', () => {
  assert.match(preview, /final canEdit = _data != null && _canEdit;/);
  assert.match(preview, /onPressed: canEdit \? _openEditor : null/);
});

test('Preview shows Awaiting verification rather than Editing available after resubmission', () => {
  assert.match(preview, /'Awaiting verification'/);
  assert.match(preview, /Icons\.hourglass_top_rounded/);
  assert.match(
    preview,
    /Edit Form is temporarily disabled until OSFA\/Admin completes/
  );
  assert.match(
    preview,
    /the review or requests another correction/
  );
});

test('another correction request can unlock editing again', () => {
  assert.match(
    service,
    /applicationFormCorrectionRequested =\s*applicationFormReviewStatus === 'reupload_required'/
  );
  assert.match(
    service,
    /applicationFormAwaitingVerification =\s*applicationFormReviewStatus === 'pending'/
  );
});
