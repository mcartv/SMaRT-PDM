const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../src/services/applicationAvailabilityService');

test('global deadline is a strict inclusive date-only value', () => {
  assert.equal(policy.normalizeDateOnly('2026-09-04'), '2026-09-04');
  assert.equal(policy.normalizeDateOnly('2026-02-29'), null);
  assert.equal(policy.normalizeDateOnly('09/04/2026'), null);
  assert.equal(policy.normalizeDateOnly(''), null);
});

test('Manila date key observes the local calendar date', () => {
  assert.equal(
    policy.getManilaDateKey(new Date('2026-05-31T16:00:00.000Z')),
    '2026-06-01'
  );
});

test('opening period assertion rejects stale openings with a stable code', () => {
  assert.throws(
    () => policy.assertOpeningInActivePeriod(
      { period_id: 'old-period' },
      { activePeriod: { period_id: 'current-period' } }
    ),
    (error) => error.statusCode === 400 && error.code === 'OPENING_OUTSIDE_ACTIVE_PERIOD'
  );
});
