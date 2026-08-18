'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('renewal review uses the shared re-upload and major-rejection reason catalogs', () => {
  const page = read('frontend/src/pages/RenewalDocumentVerification.jsx');

  assert.match(page, /MINOR_REUPLOAD_OPTIONS/);
  assert.match(page, /MAJOR_REJECTION_OPTIONS/);
  assert.match(page, /reviewIssueMode/);
});

test('renewal final actions include reupload, reject, approve, and under_review', () => {
  const page = read('frontend/src/pages/RenewalDocumentVerification.jsx');

  for (const action of ['reupload', 'reject', 'approve', 'under_review']) {
    assert.match(page, new RegExp(`finalAction:\\s*'${action}'`));
  }
});

test('historical renewal remains read-only', () => {
  const page = read('frontend/src/pages/RenewalDocumentVerification.jsx');

  assert.match(page, /historical semester and is read-only/i);
});
