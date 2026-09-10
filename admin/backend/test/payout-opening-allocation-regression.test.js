'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const page = read('frontend/src/pages/PayoutManagement.jsx');
const service = read('backend/services/payoutService.js');
const reportService = read('backend/services/reportService.js');
const openingService = read('backend/services/programOpeningService.js');

test('payout amount remains read-only and is not submitted by the client', () => {
  assert.match(page, /<ReadOnlyField[\s\S]*label="Amount per Scholar"/);
  assert.doesNotMatch(page, /amount_per_scholar: amountPerScholar/);
  assert.doesNotMatch(page, /const amountPerScholar = Number\(form\.amount_per_scholar\)/);
});

test('payout service derives a missing per-scholar amount from opening allocation', () => {
  assert.match(
    service,
    /po\.financial_allocation::numeric[\s\S]*NULLIF\(po\.allocated_slots, 0\)::numeric/
  );
  assert.match(service, /validateMoney\(opening\.amount_per_scholar, 'Amount per scholar'\)/);
  assert.doesNotMatch(service, /const requestedAmount/);
});

test('opening create and update persist the calculated allocation per scholar', () => {
  assert.match(openingService, /function calculatePerScholarAmount/);
  assert.match(
    openingService,
    /per_scholar_amount: calculatePerScholarAmount\([\s\S]*financial_allocation,[\s\S]*allocated_slots/
  );
  assert.match(
    openingService,
    /per_scholar_amount: calculatePerScholarAmount\([\s\S]*merged\.financial_allocation,[\s\S]*merged\.allocated_slots/
  );
});

test('payout payment modes match the database constraint and are validated server-side', () => {
  assert.match(page, /<option value="Cash">Cash<\/option>/);
  assert.match(page, /<option value="Other">Other<\/option>/);
  assert.doesNotMatch(page, /<option value="Bank">Bank<\/option>/);
  assert.doesNotMatch(page, /<option value="Cheque">Cheque<\/option>/);
  assert.match(page, /form\.payment_mode === 'Other'[\s\S]*Specify Payment Type/);
  assert.match(page, /payment_mode_other: form\.payment_mode_other/);
  assert.match(service, /const PAYOUT_PAYMENT_MODES = Object\.freeze\(\[\s*'Cash',\s*'Other'/);
  assert.match(service, /const normalizedPaymentMode = validatePaymentMode\(payment_mode\)/);
  assert.match(service, /validateOtherPaymentMode\([\s\S]*normalizedPaymentMode,[\s\S]*payment_mode_other/);
  assert.match(reportService, /CONCAT\('Other - ', TRIM\(pb\.payment_mode_other\)\)/);

  const migration = read('../supabase/migrations/20260910022625_support_custom_payout_payment_mode.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payment_mode_other varchar\(60\)/i);
  assert.match(migration, /payment_mode IN \('Cash', 'Other'\)/);
  assert.match(migration, /payment_mode = 'Other'[\s\S]*char_length\(trim\(payment_mode_other\)\)/);
});

test('RO completion proof type is included in the database constraint', () => {
  const migration = read('../supabase/migrations/20260909001724_allow_ro_completion_proofs.sql');
  const mobileRoService = read('../mobile/backend/src/services/roService.js');

  assert.match(migration, /proof_type IN \([\s\S]*'completion'/);
  assert.match(migration, /VALIDATE CONSTRAINT ro_time_log_proofs_proof_type_check/);
  assert.match(mobileRoService, /const RO_PROOF_TYPES = new Set\(\[[\s\S]*'completion'/);
  assert.match(mobileRoService, /RO_PROOF_TYPES\.has\(proofType\)/);
});
