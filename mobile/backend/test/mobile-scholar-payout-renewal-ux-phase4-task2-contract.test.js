const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const payout = fs.readFileSync(
  path.join(frontendRoot, 'lib', 'features', 'scholar', 'presentation', 'screens', 'payout_schedule_screen.dart'),
  'utf8'
);
const renewal = fs.readFileSync(
  path.join(frontendRoot, 'lib', 'features', 'applicant', 'presentation', 'screens', 'scholar_renewal_requirements_screen.dart'),
  'utf8'
);

test('Payout keeps proof workflow while using student-facing language', () => {
  assert.match(payout, /_pickAndUploadProof/);
  assert.match(payout, /_previewProof/);
  assert.match(payout, /OSFA Feedback:/);
  assert.match(payout, /New Proof Needed/);
  assert.match(payout, /Payment Method/);
  assert.match(payout, /Upload your proof so OSFA can review it/);
  assert.doesNotMatch(payout, /Admin feedback:/);
  assert.doesNotMatch(payout, /uploaded proof URL is invalid/);
});

test('Payout load and upload errors avoid raw exception text in the UI', () => {
  assert.match(payout, /PAYOUT LOAD ERROR/);
  assert.match(payout, /We could not load your payout details/);
  assert.match(payout, /PAYOUT PROOF UPLOAD ERROR/);
  assert.match(payout, /We could not upload your payout proof/);
});

test('Renewal keeps upload and submit workflows while simplifying labels', () => {
  assert.match(renewal, /_pickAndUploadDocument/);
  assert.match(renewal, /_submitRenewal/);
  assert.doesNotMatch(renewal, /'OSFA Feedback'/);
  assert.match(renewal, /Waiting for OSFA Review/);
  assert.match(renewal, /Renewal Needs Attention/);
  assert.match(renewal, /New File Needed/);
  assert.match(renewal, /renewal review/);
  assert.doesNotMatch(renewal, /Administrator feedback/);
  assert.doesNotMatch(renewal, /renewal validation/);
  assert.doesNotMatch(renewal, /Awaiting Admin Review/);
  assert.doesNotMatch(renewal, /Replace Re-upload Documents First/);
});

test('Renewal formats stored submission timestamps for students', () => {
  assert.match(renewal, /String _formatSubmittedDate/);
  assert.match(renewal, /DateTime\.tryParse\(raw\)\?\.toLocal\(\)/);
  assert.match(renewal, /_formatSubmittedDate\(document\.submittedAt\)/);
  assert.doesNotMatch(renewal, /Text\(\s*document\.submittedAt!/s);
});

test('Renewal errors are logged for debugging but shown simply to students', () => {
  assert.match(renewal, /RENEWAL LOAD ERROR/);
  assert.match(renewal, /RENEWAL DOCUMENT UPLOAD ERROR/);
  assert.match(renewal, /RENEWAL SUBMIT ERROR/);
  assert.match(renewal, /We could not load your renewal details/);
  assert.match(renewal, /We could not upload this document/);
  assert.match(renewal, /We could not submit your renewal/);
  assert.doesNotMatch(renewal, /uploaded file URL is invalid/);
});

test('Batch Status remains unchanged pending product decision', () => {
  assert.match(payout, /'Batch Status'/);
});
