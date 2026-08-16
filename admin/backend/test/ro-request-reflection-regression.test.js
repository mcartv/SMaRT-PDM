const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const coordinatorSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/ROCoordinatorQueue.jsx'),
  'utf8'
);

const adminRoService = fs.readFileSync(
  path.resolve(__dirname, '../services/roService.js'),
  'utf8'
);

const mobileRoService = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/src/services/roService.js'),
  'utf8'
);

const mobileScreen = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../mobile/smartpdm_mobileapp/lib/features/scholar/presentation/screens/ro_assignment_screen.dart'
  ),
  'utf8'
);

test('coordinator has immediate RO placement request queue and filters', () => {
  assert.match(coordinatorSource, /\/api\/ro-coordinator\/requests/);
  assert.match(coordinatorSource, /Pending/);
  assert.match(coordinatorSource, /Approved/);
  assert.match(coordinatorSource, /Returned/);
});

test('coordinator can approve a placement request', () => {
  assert.match(coordinatorSource, /Approve RO request/);
  assert.match(coordinatorSource, /Confirm Approval/);
});

test('coordinator can reject/return with required remarks', () => {
  assert.match(coordinatorSource, /Return request to Admin/);
  assert.match(coordinatorSource, /Reason for returning/);
  assert.match(
    coordinatorSource,
    /rejecting && !remarks\.trim\(\)/
  );
});

test('RO request queue refreshes in realtime', () => {
  assert.match(coordinatorSource, /useSocketEvent\('ro:updated'/);
  assert.match(coordinatorSource, /loadRequests\(\{\s*soft:\s*true\s*\}\)/);
});

test('RO placement state and coordinator remarks persist in backend records', () => {
  assert.match(adminRoService, /ro_placements/);
  assert.match(adminRoService, /placement_status/);
  assert.match(adminRoService, /coordinator_remarks/);
  assert.match(adminRoService, /requested_at/);
  assert.match(adminRoService, /decided_at/);
});

test('RO records are isolated to the active academic period', () => {
  assert.match(adminRoService, /getCurrentAcademicPeriod/);
  assert.match(adminRoService, /\.from\('academic_period'\)/);
  assert.match(adminRoService, /\.eq\('is_active', true\)/);
  assert.match(adminRoService, /\.eq\('period_id', currentPeriod\.period_id\)/);
});

test('scholar mobile module reloads persisted RO state from /api/ro/me', () => {
  assert.match(mobileScreen, /\/api\/ro\/me/);
  assert.match(mobileScreen, /RoAssignment\.fromJson/);
});

test('scholar RO response includes coordinator placement status and remarks', () => {
  assert.match(adminRoService, /coordinator_status/);
  assert.match(adminRoService, /coordinator_remarks/);
});

test('mobile RO backend supports persisted assignment and attendance state', () => {
  assert.match(mobileRoService, /return_of_obligations/);
  assert.match(mobileRoService, /ro_placements/);
});
