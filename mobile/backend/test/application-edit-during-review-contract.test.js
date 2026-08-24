'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const service = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'applicationService.js'),
  'utf8'
);

test('application form editing requires an explicit saved correction request', () => {
  assert.match(service, /application_document_reviews/);
  assert.match(
    service,
    /applicationFormCorrectionRequested[\s\S]*applicationFormReviewStatus\s*===\s*'reupload_required'/
  );
  assert.match(
    service,
    /const canEdit\s*=\s*applicationFormCorrectionRequested\s*&&\s*!terminalApplicationStatus\s*&&\s*!selectionStarted\s*&&\s*!activated\s*;/
  );
});

test('ordinary review or OCR does not itself grant edit permission', () => {
  assert.doesNotMatch(
    service,
    /const canEdit\s*=\s*pendingReview\s*&&/
  );
  assert.doesNotMatch(
    service,
    /const canEdit\s*=[\s\S]{0,120}!reviewStarted/
  );
});

test('submitting a corrected form locks it for re-review', () => {
  assert.match(service, /resetApplicationFormReviewError/);
  assert.match(service, /document_key',\s*'application_form'/);
  assert.match(service, /review_status:\s*'pending'/);
  assert.match(service, /requirements_verified_at:\s*null/);
});

test('editing an existing application may proceed after the opening closes', () => {
  assert.match(
    service,
    /if\s*\(\s*!editExistingApplication\s*&&\s*\(\s*opening\.is_archived\s*===\s*true\s*\|\|\s*opening\.posting_status\s*!==\s*'open'/
  );
});
