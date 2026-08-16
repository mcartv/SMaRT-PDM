const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/RenewalDocumentVerification.jsx'),
  'utf8'
);

test('renewal review reuses application document review reason policies', () => {
  assert.match(source, /MINOR_REUPLOAD_OPTIONS/);
  assert.match(source, /MAJOR_REJECTION_OPTIONS/);
  assert.match(source, /@\/utils\/documentReviewPolicy/);
});

test('re-upload uses a required reason dropdown', () => {
  assert.match(source, /Reason for re-upload/);
  assert.match(source, /Select re-upload reason/);
  assert.match(source, /reviewIssueMode === 'reupload'/);
  assert.match(source, /finalAction:\s*'reupload'/);
});

test('renewal rejection uses a required major-reason dropdown', () => {
  assert.match(source, /Major rejection reason/);
  assert.match(source, /Select rejection reason/);
  assert.match(source, /reviewIssueMode === 'reject'/);
  assert.match(source, /finalAction:\s*'reject'/);
});

test('reason and optional remarks are formatted like application document review comments', () => {
  assert.match(source, /`Reason: \$\{selectedReviewReason\.label\}`/);
  assert.match(source, /`Remarks: \$\{comment\.trim\(\)\}`/);
});

test('issue confirmation is disabled until a reason is selected', () => {
  assert.match(source, /!selectedReviewReason/);
});
