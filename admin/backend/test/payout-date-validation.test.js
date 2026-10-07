'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read } = require('./_current-system-test-utils');

const service = read('backend/services/payoutService.js');
const page = read('frontend/src/pages/PayoutManagement.jsx');

function validatorAt(now) {
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
  }
  const context = vm.createContext({ Date: FixedDate });
  const errorFunction = service.match(/function payoutError\([^]*?\n\}/)[0];
  const dateFunction = service.match(/function validatePayoutDate\([^]*?\n\}/)[0];
  vm.runInContext(`${errorFunction}\n${dateFunction}`, context);
  return context.validatePayoutDate;
}

test('payout dates reject yesterday and accept today and tomorrow in Manila', () => {
  // UTC still says October 7, but Manila has reached October 8.
  const validate = validatorAt('2026-10-07T16:30:00.000Z');
  assert.throws(() => validate('2026-10-07'), {
    statusCode: 400,
    message: 'Payout date cannot be in the past. Please select today or a future date.',
  });
  assert.equal(validate('2026-10-08'), '2026-10-08');
  assert.equal(validate('2026-10-09'), '2026-10-09');
});

test('payout minimum date advances at Manila midnight', () => {
  assert.equal(validatorAt('2026-10-07T15:59:59Z')('2026-10-07'), '2026-10-07');
  assert.throws(() => validatorAt('2026-10-07T16:00:00Z')('2026-10-07'), { statusCode: 400 });
});

test('payout dates still reject missing, malformed and impossible dates', () => {
  const validate = validatorAt('2026-10-07T16:30:00Z');
  for (const value of ['', null, '10/08/2026', '2026-02-30']) {
    assert.throws(() => validate(value), { statusCode: 400 });
  }
});

test('create payout form limits the calendar and validates before sending', () => {
  assert.match(page, /min=\{getManilaDateInputValue\(\)\}/);
  assert.match(page, /form\.payout_date < getManilaDateInputValue\(\)/);
  assert.match(page, /resetCreateForm\(\);\s*setShowCreateModal\(true\)/);
});
