'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const service = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'applicationService.js'),
  'utf8'
);

test('immediate document re-upload action resolves the student user target', () => {
  assert.match(
    service,
    /saveApplicationDocumentReview[\s\S]*application_id, student_id, verification_status/
  );
  assert.match(
    service,
    /saveApplicationDocumentReview[\s\S]*\.from\('students'\)[\s\S]*\.select\('user_id'\)/
  );
});

test('immediate document re-upload action creates a mobile notification', () => {
  assert.match(
    service,
    /saveApplicationDocumentReview[\s\S]*reviewStatus === 'reupload_required'[\s\S]*deliverVerificationOutcomeNotification/
  );
});

test('re-upload notification identifies the reviewed document', () => {
  assert.match(service, /documentName.*Re-upload Required/s);
  assert.match(service, /OSFA requested a new upload/);
});
