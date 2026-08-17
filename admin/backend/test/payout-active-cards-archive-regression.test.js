const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const page = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/PayoutManagement.jsx'),
  'utf8'
);
const routes = fs.readFileSync(
  path.resolve(__dirname, '../routes/payoutRoutes.js'),
  'utf8'
);
const controller = fs.readFileSync(
  path.resolve(__dirname, '../controllers/payoutController.js'),
  'utf8'
);
const service = fs.readFileSync(
  path.resolve(__dirname, '../services/payoutService.js'),
  'utf8'
);

test('active payout batches are rendered as responsive cards with required summary fields', () => {
  assert.match(page, /Active Payout Batches/);
  assert.match(page, /xl:grid-cols-2/);
  assert.doesNotMatch(page, /2xl:grid-cols-3/);
  assert.match(page, /program_name/);
  assert.match(page, /benefactor_name/);
  assert.match(page, /academic_year/);
  assert.match(page, /semester/);
  assert.match(page, /Payout Date/);
  assert.match(page, /Scholars/);
  assert.match(page, /Amount \/ Scholar/);
  assert.match(page, /Batch Total/);
  assert.match(page, /getBatchDisplayStatus/);
  assert.match(page, /Open Batch/);
  assert.match(page, /borderLeft: '4px solid var\(--portal-base\)'/);
  assert.match(page, /brownMid: 'var\(--portal-base\)'/);
  assert.match(page, /No active payout batches/);
});

test('archive uses an in-app confirmation modal and never window.confirm', () => {
  assert.match(page, /function ArchiveBatchModal/);
  assert.match(page, /Archive payout batch\?/);
  assert.match(page, /This does not delete payout records/);
  assert.doesNotMatch(page, /window\.confirm/);
});

test('archive action is admin-only at the route layer', () => {
  assert.match(routes, /const adminOnly = \[protect, authorizeRoles\('admin'\)\]/);
  assert.match(
    routes,
    /\/:payoutBatchId\/archive[\s\S]*?\.\.\.adminOnly[\s\S]*?archivePayoutBatch/
  );
});

test('archive service performs a soft archive and does not delete payout records', () => {
  assert.match(service, /UPDATE payout_batches/);
  assert.match(service, /is_archived = TRUE/);
  assert.match(service, /batch_status = 'Archived'/);
  assert.doesNotMatch(
    service,
    /DELETE\s+FROM\s+(payout_batches|payout_batch_students)/i
  );
});

test('archived batches remain queryable and separate from active batches', () => {
  assert.match(page, /batches\.filter\(\(batch\) => batch\?\.is_archived === true\)/);
  assert.match(page, /Archived Payout Batches/);
  assert.match(page, /Archived batch is read-only/);
});

test('archive controller writes audit log and broadcasts realtime refresh', () => {
  assert.match(controller, /ARCHIVE_PAYOUT_BATCH/);
  assert.match(controller, /writePayoutAudit/);
  assert.match(controller, /emitPayoutBatchRealtime\(req,[\s\S]*?'archived'\)/);
  assert.match(page, /useSocketEvent\('payout:archived'/);
});

test('active lists exclude archived batches immediately', () => {
  assert.match(
    page,
    /activeBatches[\s\S]*?filter\(\(batch\) => batch\?\.is_archived !== true\)/
  );
  assert.match(page, /setBatches\(\(previous\)/);
  assert.match(page, /is_archived: true/);
});
