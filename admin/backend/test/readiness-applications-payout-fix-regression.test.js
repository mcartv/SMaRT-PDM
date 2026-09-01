'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) =>
  fs.readFileSync(path.join(root, relative), 'utf8');

test('Applications opening cards wrap metrics instead of forcing seven cramped columns', () => {
  const source = read('frontend/src/pages/ApplicationReview.jsx');

  assert.match(source, /2xl:grid-cols-2/);
  assert.match(source, /grid grid-cols-2 gap-2 sm:grid-cols-4/);
  assert.doesNotMatch(source, /xl:grid-cols-7/);
});

test('Readiness cards and activation approval use responsive compact padding', () => {
  const source = read('frontend/src/pages/ApplicationReview.jsx');

  assert.match(source, /grid grid-cols-1 gap-4 2xl:grid-cols-2/);
  assert.match(source, /w-\[calc\(100vw-1\.5rem\)\] max-w-xl max-h-\[calc\(100dvh-1\.5rem\)\]/);
  assert.match(source, /max-h-\[calc\(100dvh-13rem\)\] space-y-2\.5 overflow-y-auto px-5 py-4 sm:px-6/);
  assert.match(source, /flex-col gap-2 border-t border-stone-100 px-5 py-3 sm:flex-row sm:px-6/);
  assert.match(source, /disabled=\{!activationCandidate \|\| Boolean\(approvalLoadingId\)\}/);
});

test('Payout archive uses an in-app modal and explanatory blocked-state handling', () => {
  const source = read('frontend/src/pages/PayoutManagement.jsx');

  assert.match(source, /function ArchiveBatchModal/);
  assert.match(source, /Archive payout batch\?/);
  assert.match(source, /setArchiveCandidate\(selectedBatch\)/);
  assert.match(source, /Resolve every Pending or On Hold scholar first/);
});

test('Payout archive backend requires terminal scholar statuses', () => {
  const source = read('backend/services/payoutService.js');

  assert.match(
    source,
    /terminalStatuses = new Set\(\['released', 'absent', 'cancelled'\]\)/
  );
  assert.match(source, /unfinishedEntries/);
  assert.match(source, /is_archived = TRUE/);
});

test('Payout restore service is implemented and exported', () => {
  const source = read('backend/services/payoutService.js');

  assert.match(source, /async function restorePayoutBatch/);
  assert.match(source, /is_archived = FALSE/);
  assert.match(source, /restorePayoutBatch,/);
});
