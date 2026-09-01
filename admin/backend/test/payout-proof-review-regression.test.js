'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'payoutService.js'),
  'utf8'
);

test('payout proof review casts reused PostgreSQL parameters explicitly', () => {
  assert.match(source, /proof_status = \$2::varchar/);
  assert.match(source, /reviewed_by = \$3::uuid/);
  assert.match(source, /admin_comment = \$4::text/);
  assert.match(source, /WHEN \$2::varchar IN \('Rejected', 'Resubmission Required'\)/);
  assert.match(source, /payout_proof_id = \$1::uuid/);
});

test('verified proof still clears any previous rejection reason', () => {
  assert.match(source, /ELSE NULL[\s\S]*?END,[\s\S]*?updated_at = now\(\)/);
});
