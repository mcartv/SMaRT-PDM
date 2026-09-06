'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const page = read('frontend/src/pages/PayoutManagement.jsx');
const service = read('backend/services/payoutService.js');
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
