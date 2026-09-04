const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('endorsement queue and detail derive section from the immutable application payload', () => {
  const service = read('backend/services/endorsementSlipService.js');
  assert.match(service, /function deriveApplicationSection/);
  assert.match(service, /academic\.current_section \|\| academic\.section/);
  assert.match(service, /section: deriveApplicationSection\(row\.application_payload\)/);
  assert.match(service, /section: studentSection/);
  assert.match(service, /\|\| 'Not provided'/);
});

test('endorsement admin surfaces display and search section', () => {
  const queue = read('frontend/src/pages/EndorsementQueue.jsx');
  const detail = read('frontend/src/pages/EndorsementSlipDetail.jsx');
  const tracker = read('frontend/src/pages/AllEndorsementsTracker.jsx');
  assert.match(queue, /row\.section/);
  assert.match(detail, /label="Section"/);
  assert.match(tracker, /row\.section/);
});
