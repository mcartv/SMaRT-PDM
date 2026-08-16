const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/RenewalDocumentVerification.jsx'),
  'utf8'
);

test('renewal review uses one unified review panel', () => {
  assert.match(source, /Review selected requirement/i);
  assert.doesNotMatch(source, /Document Feedback/);
  assert.doesNotMatch(source, /Final Decision/);
});

test('renewal review provides application-style actions', () => {
  assert.match(source, />\s*Verify\s*</);
  assert.match(source, /Request Re-upload/);
  assert.match(source, /Reject Renewal/);
  assert.match(source, /Save Renewal Review/);
});

test('re-upload and rejection require a useful reason', () => {
  assert.match(source, /MIN_REASON_LENGTH\s*=\s*10/);
  assert.match(source, /at least \$\{MIN_REASON_LENGTH\} characters/);
});

test('final action is derived from document decisions', () => {
  assert.match(source, /if \(rejectEntireRenewal\) return 'reject'/);
  assert.match(source, /return 'reupload'/);
  assert.match(source, /return 'approve'/);
  assert.match(source, /return 'under_review'/);
});

test('document preview is constrained to a compact card', () => {
  assert.match(source, /h-\[420px\]/);
  assert.doesNotMatch(source, /min-h-\[360px\][\s\S]*?lg:min-h-0/);
});

test('renewal review keeps realtime refresh', () => {
  assert.match(source, /useSocketEvent/);
  assert.match(source, /renewal:updated/);
  assert.match(source, /renewal:approved/);
});
