const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Remove Privilege preserves the student record and archives only the scholarship relationship', () => {
  const selection = read('admin/backend/services/selectionService.js');
  const start = selection.indexOf('async function releaseScholarSlotAndPromote');
  const end = selection.indexOf('\nmodule.exports', start);
  const releaseFlow = selection.slice(start, end);
  const routes = read('admin/backend/routes/scholarRoutes.js');
  const monitoring = read('admin/frontend/src/pages/ScholarMonitoring.jsx');

  assert.match(releaseFlow, /is_active_scholar\s*=\s*false/);
  assert.match(releaseFlow, /scholar_is_archived\s*=\s*true/);
  assert.match(releaseFlow, /scholar_removal_reason/);
  assert.match(releaseFlow, /const status = 'Removed'/);
  assert.doesNotMatch(releaseFlow, /\?\s*'Inactive'\s*:\s*'Removed'/);
  assert.doesNotMatch(releaseFlow, /SET\s+is_archived\s*=\s*true/i);
  assert.match(routes, /\/removed/);
  assert.match(monitoring, /Removed Scholars/);
  assert.doesNotMatch(monitoring, /Also archive student record/);
});

test('removed scholars have an explicit Mobile lifecycle and cannot silently start another application', () => {
  const application = read('mobile/backend/src/services/applicationService.js');
  const openings = read('mobile/backend/src/services/openingService.js');
  const dashboard = read('mobile/frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart');
  const profile = read('mobile/frontend/lib/features/profile/presentation/screens/profile_screen.dart');

  assert.match(application, /stage:\s*'scholar_privilege_removed'/);
  assert.match(application, /scholar_privilege_removed:\s*scholarPrivilegeRemoved/);
  assert.match(application, /Contact OSFA regarding eligibility before starting another application/);
  assert.match(application, /Contact OSFA regarding eligibility before submitting another application/);
  assert.match(openings, /!scholarPrivilegeRemoved/);
  assert.match(openings, /Eligibility Review Required/);
  assert.match(openings, /Contact OSFA for an eligibility review before applying again/);
  assert.match(dashboard, /scholarPrivilegeRemoved\s*==\s*true/);
  assert.match(dashboard, /Privilege Removed/);
  assert.match(profile, /Removed Scholar/);
});
