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
  const controller = read('admin/backend/controllers/scholarController.js');
  const monitoring = read('admin/frontend/src/pages/ScholarMonitoring.jsx');

  assert.match(releaseFlow, /is_active_scholar\s*=\s*false/);
  assert.match(releaseFlow, /scholar_is_archived\s*=\s*true/);
  assert.match(releaseFlow, /scholar_removal_reason/);
  assert.match(releaseFlow, /const status = 'Removed'/);
  assert.match(releaseFlow, /hasActivePrivilege/);
  assert.match(releaseFlow, /already removed or has no occupied opening slot/);
  assert.match(releaseFlow, /const occupiedBefore = await countOccupiedSlots/);
  assert.match(releaseFlow, /const occupiedAfter = await countOccupiedSlots/);
  assert.match(releaseFlow, /RETURNING opening_id, allocated_slots, filled_slots/);
  assert.match(releaseFlow, /available_slots:\s*Math\.max\(0, allocatedSlots - filledSlots\)/);
  assert.match(releaseFlow, /released_slots:\s*Math\.max/);
  assert.match(controller, /socketEvents\.openingUpdated\(io, openingUpdate\)/);
  assert.match(controller, /action:\s*'slot_released'/);
  assert.doesNotMatch(releaseFlow, /\?\s*'Inactive'\s*:\s*'Removed'/);
  assert.doesNotMatch(releaseFlow, /SET\s+is_archived\s*=\s*true/i);
  assert.match(routes, /\/removed/);
  assert.match(monitoring, /Removed Scholars/);
  assert.match(monitoring, /import \{ toast \} from 'sonner'/);
  assert.match(monitoring, /toast\.success\('Scholarship privilege removed'/);
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


test('Removed Scholar profile lookup accepts legacy archived statuses and returns 404 semantics for missing records', () => {
  const service = read('admin/backend/services/scholarService.js');
  const controller = read('admin/backend/controllers/scholarController.js');
  const detailStart = service.indexOf('exports.fetchScholarById = async');
  const detailEnd = service.indexOf('exports.fetchScholarRenewalDocuments', detailStart);
  const detailFlow = service.slice(detailStart, detailEnd);

  assert.match(
    detailFlow,
    /\$2::boolean\s*=\s*true[\s\S]{0,100}scholar_is_archived,\s*false\)\s*=\s*true/
  );
  assert.match(detailFlow, /if \(!scholarResult\.rows\.length\)\s*\{\s*return null;/);
  assert.doesNotMatch(detailFlow, /throw new Error\('Scholar not found'\)/);
  assert.match(controller, /if \(!scholar\)\s*\{\s*return res\.status\(404\)/);
});
