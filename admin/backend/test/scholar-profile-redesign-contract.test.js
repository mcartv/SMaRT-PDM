const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('scholar profile endpoint exposes its read-only administrative summaries together', () => {
  const service = read('backend/services/scholarService.js');

  assert.match(service, /fetchScholarPayoutHistory\(studentId\)/);
  assert.match(service, /fetchScholarRenewalHistory\(studentId\)/);
  assert.match(service, /Promise\.all\(\[/);
  assert.match(service, /payout_history:\s*payoutHistory/);
  assert.match(service, /renewal_history:\s*renewalHistory/);
  assert.match(service, /endorsement_sdo_status/);
  assert.match(service, /guidance_status/);
  assert.match(service, /pd_status/);
  assert.match(service, /year_level/);
  assert.match(service, /AS section/);
});

test('admin scholar profile keeps a responsive two-column record and compact histories', () => {
  const page = read('frontend/src/pages/ScholarMonitoring.jsx');

  assert.match(page, /max-w-\[86rem\]/);
  assert.match(page, /lg:grid-cols-\[minmax\(0,0\.4fr\)_minmax\(0,0\.6fr\)\]/);
  assert.match(page, /function CurrentScholarshipPanel/);
  assert.match(page, /function PayoutHistoryPanel/);
  assert.match(page, /function RenewalHistoryPanel/);
  assert.match(page, /function ScholarStatusHistoryPanel/);
  assert.match(page, /Contact Information/);
  assert.match(page, /\[overflow-wrap:anywhere\]/);
  assert.match(page, /const \[expanded, setExpanded\] = useState\(false\)/);
  assert.match(page, /const \[sectionExpanded, setSectionExpanded\] = useState\(false\)/);
  assert.doesNotMatch(page, /RO Assigned Office:/);
});
