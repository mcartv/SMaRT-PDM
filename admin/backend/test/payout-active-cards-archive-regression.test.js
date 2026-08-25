'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const page = read('frontend/src/pages/PayoutManagement.jsx');
const routes = read('backend/routes/payoutRoutes.js');
const service = read('backend/services/payoutService.js');
const controller = read('backend/controllers/payoutController.js');

test('current payout page separates active, completed, and archived batches', () => {
  assert.match(page, /Active Payout Batches/);
  assert.match(page, /Completed Payouts/);
  assert.match(page, /Archived Payout Batches/);
  assert.match(page, /const activeBatches = useMemo/);
  assert.match(page, /batches\.filter\(\(b\) => !b\.is_archived\)/);
  assert.match(page, /const archivedBatches = useMemo/);
  assert.match(page, /batches\.filter\(\(b\) => b\.is_archived\)/);
});

test('current archive action is guarded and calls the archive endpoint', () => {
  assert.match(page, /const handleArchiveBatch = async/);
  assert.match(page, /isBatchFinished\(batch\)/);
  assert.match(page, /\/archive/);
  assert.match(page, /setActiveSection\('archived'\)/);
});

test('archive remains admin-only and soft-deletes no payout records', () => {
  assert.match(routes, /archivePayoutBatch/);
  assert.match(service, /is_archived\s*=\s*TRUE/i);
  assert.doesNotMatch(
    service,
    /DELETE\s+FROM\s+(payout_batches|payout_batch_students)/i
  );
});

test('archive broadcasts realtime refresh and the page listens for it', () => {
  assert.match(controller, /ARCHIVE_PAYOUT_BATCH/);
  assert.match(page, /useSocketEvent\('payout:archived'/);
  assert.match(page, /useSocketEvent\('payout:restored'/);
});
