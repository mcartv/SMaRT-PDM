const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const adminController = fs.readFileSync(
  path.resolve(__dirname, '../controllers/renewalController.js'),
  'utf8'
);
const mobileController = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/src/controllers/renewalController.js'),
  'utf8'
);
const reviewPage = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/RenewalDocumentVerification.jsx'),
  'utf8'
);
const renewalService = fs.readFileSync(
  path.resolve(__dirname, '../services/renewalService.js'),
  'utf8'
);

test('renewal queue only returns the current academic period', () => {
  assert.match(
    adminController,
    /\.filter\(\(renewal\)\s*=>\s*renewal\?\.is_current_period\s*===\s*true\)/
  );
});

test('renewal service retains current-versus-historical period metadata', () => {
  assert.match(renewalService, /is_current_period:\s*period\.is_active\s*===\s*true/);
  assert.match(renewalService, /period_status:\s*period\.is_active\s*===\s*true\s*\?\s*'Current'\s*:\s*'Historical'/);
});

test('renewal document preview is a compact fixed-height card', () => {
  assert.match(reviewPage, /h-\[390px\]/);
  assert.match(reviewPage, /Document Preview|activeDoc\?\.name/);
  assert.doesNotMatch(reviewPage, /lg:h-\[calc\(100vh-118px\)\]/);
});

test('document feedback and final decision are merged into one review panel', () => {
  assert.match(reviewPage, /Review Selected Document/);
  assert.match(reviewPage, /Save Renewal Review/);
  assert.doesNotMatch(reviewPage, /Final Decision/);
  assert.doesNotMatch(reviewPage, /Optional final remarks/);
});

test('re-upload requires a useful reason and uses renewal reupload action', () => {
  assert.match(reviewPage, /reason\.length < 10/);
  assert.match(reviewPage, /finalAction:\s*'reupload'/);
  assert.match(reviewPage, /Request Re-upload/);
});

test('reject renewal remains a distinct final action', () => {
  assert.match(reviewPage, /Reject Renewal/);
  assert.match(reviewPage, /finalAction:\s*'reject'/);
  assert.match(reviewPage, /Reject this renewal entirely/);
});

test('admin renewal decisions continue writing System Logs entries', () => {
  assert.match(adminController, /auditLogService\.logAudit/);
  assert.match(adminController, /module:\s*'Renewals'/);
  assert.match(adminController, /RENEWAL_/);
});

test('scholar renewal uploads are written to the same audit_logs table', () => {
  assert.match(mobileController, /\.from\('audit_logs'\)/);
  assert.match(mobileController, /RENEWAL_DOCUMENT_UPLOADED/);
  assert.match(mobileController, /module:\s*'Renewals'/);
});

test('scholar renewal submission is written to System Logs', () => {
  assert.match(mobileController, /RENEWAL_SUBMITTED/);
  assert.match(mobileController, /Scholar submitted renewal requirements for review/);
});

test('realtime renewal reflection remains enabled for both admin and scholar actions', () => {
  assert.match(adminController, /renewal:updated/);
  assert.match(mobileController, /renewal:updated/);
  assert.match(reviewPage, /useSocketEvent/);
});
