const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('RO Coordinator scholar requests are linked to real placements and cannot be manually fulfilled', () => {
  const migration = read('supabase/migrations/20260904000200_link_ro_placements_to_scholar_requests.sql');
  const routes = read('admin/backend/routes/roRoutes.js');
  const service = read('admin/backend/services/roService.js');
  const panel = read('admin/frontend/src/pages/ROScholarRequestsPanel.jsx');

  assert.match(migration, /scholar_request_id/i);
  assert.match(routes, /scholar-requests\/:requestId\/assign/);
  assert.match(service, /scholar_request_id:\s*scholarRequestId/);
  assert.match(service, /pg_advisory_lock\(hashtext\(\$1\)\)/);
  assert.match(service, /SCHOLAR_REQUEST_ASSIGNMENT_TOKEN\] === true/);
  assert.match(service, /Request-linked RO placements must be created from the RO Area scholar request workflow/);
  assert.match(service, /allowedStatuses\s*=\s*\['Declined'\]/);
  assert.match(service, /acknowledged_count\s*>=\s*progress\.requested_scholar_count/);
  assert.doesNotMatch(panel, /Mark Fulfilled/);
  assert.match(panel, /Assign Scholars/);
  assert.match(panel, /Awaiting acknowledgment/);
  assert.match(service, /Replaced by Admin after the scholar reported a concern/);
  assert.match(service, /placement_status = 'Cancelled'/);
});

test('request-originated placements notify scholars and require their existing acknowledgment', () => {
  const adminService = read('admin/backend/services/roService.js');
  const mobileService = read('mobile/backend/src/services/roService.js');
  const coordinatorController = read('admin/backend/controllers/roCoordinatorController.js');

  assert.match(adminService, /coordinatorPreapproved:\s*Boolean\(scholarRequest\)/);
  assert.match(adminService, /placement_status:\s*coordinatorPreapproved\s*\?\s*'Approved'/);
  assert.match(adminService, /New required RO assignment/);
  assert.match(mobileService, /student_acknowledged_at:\s*now/);
  assert.match(mobileService, /syncScholarRequestForRo\(ro\.ro_id\)/);
  assert.match(mobileService, /assignment_status\s*===\s*'Conflict Reported'/);
  assert.match(coordinatorController, /assigned_scholars/);
  assert.match(coordinatorController, /'placement_status', rp\.placement_status/);
  assert.match(coordinatorController, /acknowledged_count/);
  assert.match(read('admin/frontend/src/pages/ROScholarRequestsPanel.jsx'), /Replaced/);
  assert.match(read('admin/frontend/src/pages/ROCoordinatorScholarRequests.jsx'), /Replaced/);
});
