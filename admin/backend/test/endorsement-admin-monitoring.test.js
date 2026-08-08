const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '../../frontend/src');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('Phase 4 adds an OSFA endorsement monitoring route and navigation item', () => {
  const app = read('App.jsx');
  const layout = read('components/layout/AdminLayout.jsx');

  assert.match(app, /path="endorsements"[\s\S]*tokenStorageKey="adminToken"[\s\S]*Endorsement Monitoring/);
  assert.match(layout, /path: '\/admin\/endorsements'[\s\S]*label: 'Endorsements'/);
});

test('OSFA tracker is monitoring-only and exposes stage-focused views', () => {
  const tracker = read('pages/AllEndorsementsTracker.jsx');

  assert.match(tracker, /OSFA monitoring is read-only for office decisions/);
  assert.match(tracker, /\['sdo', 'At SDO'\]/);
  assert.match(tracker, /\['guidance', 'At Guidance'\]/);
  assert.match(tracker, /\['pd', 'At PD'\]/);
  assert.match(tracker, /\['completed', 'Completed'\]/);
  assert.match(tracker, /\['stopped', 'Stopped'\]/);
});

test('public endorsement verification no longer renders deprecated SDO offense-detail fields', () => {
  const verification = read('pages/EndorsementVerification.jsx');
  assert.doesNotMatch(verification, /sdo_offense_detail|Offense Type:|Date of Incident:|Case Note \/ Ref No\.:/);
  assert.match(verification, /SDO Disciplinary Standing/);
  assert.match(verification, /Guidance Moral Standing/);
  assert.match(verification, /Program Director Scholastic Standing/);
});

test('OSFA detail explicitly states separation of duties', () => {
  const detail = read('pages/EndorsementSlipDetail.jsx');
  assert.match(detail, /Read-only office monitoring/);
  assert.match(detail, /SDO, Guidance, and Program Director decisions must be recorded by those offices/);
});
