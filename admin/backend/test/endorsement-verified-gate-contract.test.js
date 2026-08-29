'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');

function source(rel) {
  return fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\r\n/g, '\n');
}

test('endorsement requires verified Admin documents', () => {
  const service = source(
    'admin/backend/services/endorsementSlipService.js'
  );
  const dashboard = source(
    'admin/frontend/src/components/endorsement/OfficeDashboard.jsx'
  );

  assert.ok(
    service.includes('SMART-PDM_ENDORSEMENT_VERIFIED_GATE_V1')
  );

  assert.ok(
    service.includes(
      "lower(trim(coalesce(a.verification_status, ''))) = 'verified'"
    )
  );

  assert.ok(
    service.includes('a.requirements_verified_at is not null')
  );

  assert.ok(
    service.includes('coalesce(a.is_archived, false) = false')
  );

  assert.ok(
    service.includes('coalesce(a.is_disqualified, false) = false')
  );

  assert.ok(
    service.includes(
      'assertVerifiedApplicationForEndorsement(currentSlip);'
    )
  );

  assert.ok(
    service.includes(
      'Endorsement is not available until Admin verifies all required application documents.'
    )
  );

  assert.ok(dashboard.includes("'application:updated'"));
  assert.ok(dashboard.includes("loadRows({ soft: true });"));
});
