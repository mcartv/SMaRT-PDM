'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repo, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function occurrences(source, needle) {
  return source.split(needle).length - 1;
}

test('Applications and FCFS refresh from the canonical application realtime path', () => {
  const bridge = read('admin/backend/services/realtimeBridgeService.js');
  const openingApplications = read('admin/frontend/src/pages/OpeningApplications.jsx');

  assert.match(bridge, /table: 'applications'/);
  assert.match(bridge, /emitPublic\(io, 'application:updated'/);
  assert.match(openingApplications, /useSocketEvent\('application:updated'/);
  assert.match(openingApplications, /queue_position/);
  assert.match(openingApplications, /fcfs_completed_at/);
});

test('Endorsement realtime is primary and polling is only a low-frequency visible-tab fallback', () => {
  const bridge = read('admin/backend/services/realtimeBridgeService.js');
  const queue = read('admin/frontend/src/pages/EndorsementQueue.jsx');

  assert.match(bridge, /table: 'endorsement_slips'/);
  assert.match(queue, /useSocketEvent\('endorsement:updated'/);
  assert.match(queue, /FALLBACK_REFRESH_INTERVAL_MS = 2 \* 60 \* 1000/);
  assert.doesNotMatch(queue, /setInterval\(\(\) => loadQueue\(\{ soft: true \}\), 8000\)/);
});

test('Profile photo queue uses the actual bridge events only', () => {
  const bridge = read('admin/backend/services/realtimeBridgeService.js');
  const queue = read('admin/frontend/src/pages/ProfilePhotoQueue.jsx');

  assert.match(bridge, /table: 'profile_photo_reviews'/);
  assert.match(queue, /profile-photo-review:created/);
  assert.match(queue, /profile-photo-review:updated/);
  assert.doesNotMatch(queue, /profile-photo-review:approved/);
  assert.doesNotMatch(queue, /profile-photo-review:rejected/);
});

test('Accounts update through the maintenance realtime channel', () => {
  const panel = read('admin/frontend/src/pages/maintenance/AccountsPanel.jsx');
  const controller = read('admin/backend/controllers/accountController.js');

  assert.match(panel, /'maintenance:updated'/);
  assert.match(panel, /\['accounts', 'courses', 'pd_course_assignments'\]/);
  assert.match(controller, /socketEvents\.maintenanceUpdated\(io, payload\)/);
});

test('Payout realtime preserves archive/restore contracts without duplicate reload broadcasts', () => {
  const page = read('admin/frontend/src/pages/PayoutManagement.jsx');
  const dashboard = read('admin/frontend/src/pages/AdminDashboard.jsx');
  const reports = read('admin/frontend/src/pages/ReportGeneration.jsx');
  const controller = read('admin/backend/controllers/payoutController.js');

  assert.match(page, /useSocketEvent\('payout:created'/);
  assert.match(page, /useSocketEvent\('payout:updated'/);
  assert.match(page, /useSocketEvent\('payout:archived'/);
  assert.match(page, /useSocketEvent\('payout:restored'/);
  assert.doesNotMatch(page, /useSocketEvent\('scholar:released'/);

  assert.doesNotMatch(dashboard, /useSocketEvent\('payout:created'/);
  assert.match(dashboard, /useSocketEvent\('payout:updated'/);
  assert.doesNotMatch(dashboard, /useSocketEvent\('payout:archived'/);
  assert.doesNotMatch(dashboard, /useSocketEvent\('payout:restored'/);
  assert.doesNotMatch(dashboard, /useSocketEvent\('scholar:released'/);
  assert.match(dashboard, /useSocketEvent\('maintenance:updated'/);

  assert.doesNotMatch(reports, /useSocketEvent\('payout:/);
  assert.match(reports, /useSocketEvent\('report:updated'/);

  assert.match(controller, /emitPayoutBatchRealtime\(req, row\?\.batch \|\| row, 'archived'\)/);
  assert.match(controller, /emitPayoutBatchRealtime\(req, batch, 'restored'\)/);
  assert.doesNotMatch(
    controller,
    /emitPayoutBatchRealtime\(req, row\?\.batch \|\| row, 'archived'\);\s*emitPayoutBatchRealtime\(req, row\?\.batch \|\| row, 'updated'\);/
  );
  assert.doesNotMatch(
    controller,
    /emitPayoutBatchRealtime\(req, batch, 'restored'\);\s*emitPayoutBatchRealtime\(req, batch, 'updated'\);/
  );
  assert.match(controller, /socketEvents\.payoutUpdated\(io, payload\)/);
  assert.match(controller, /socketEvents\.reportUpdated/);
});

test('RO emits one canonical admin-web event while keeping one legacy alias', () => {
  const controller = read('admin/backend/controllers/roController.js');
  const relayRoutes = read('admin/backend/routes/internalRealtimeRoutes.js');
  const mobileController = read('mobile/backend/src/controllers/roController.js');
  const mobileRelay = read('mobile/backend/src/services/adminRealtimeRelayService.js');

  assert.match(controller, /socketEvents\.roUpdated\(io, data\)/);
  assert.equal(occurrences(controller, "io.emit('ro:updated', data);"), 1);
  assert.match(controller, /io\.emit\('roUpdated', data\)/);

  assert.match(relayRoutes, /router\.post\('\/ro-updated'/);
  assert.match(mobileController, /relayRoUpdated/);
  assert.match(mobileRelay, /relayRoUpdated/);
});

test('Renewals are bridged and consumed in Scholar Monitoring', () => {
  const bridge = read('admin/backend/services/realtimeBridgeService.js');
  const scholars = read('admin/frontend/src/pages/ScholarMonitoring.jsx');

  assert.match(bridge, /table: 'renewals'/);
  assert.match(bridge, /table: 'renewal_documents'/);
  assert.match(bridge, /emitPublic\(io, 'renewal:updated'/);
  assert.match(scholars, /'renewal:updated'/);
});

test('Socket hook unregisters the exact handlers it registers', () => {
  const hook = read('admin/frontend/src/hooks/useSocket.js');

  assert.match(hook, /let globalSocket = null;/);
  assert.match(hook, /socket\.on\(event, handler\)/);
  assert.match(hook, /socket\.off\(event, handler\)/);
  assert.match(hook, /handlers\.forEach\(\(\{ event, handler \}\) =>/);
});
