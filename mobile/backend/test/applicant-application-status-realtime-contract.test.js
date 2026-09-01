const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('admin decisions relay application status changes to the applicant socket', () => {
  const controller = read('admin/backend/controllers/applicationController.js');
  const mobileRoutes = read('mobile/backend/src/routes/internalRealtimeRoutes.js');
  assert.match(controller, /function relayApplicantApplicationEvent/);
  assert.match(controller, /fetchApplicationRealtimeTarget\(applicationId\)/);
  assert.match(controller, /relayApplicantApplicationEvent\(id, 'application:updated'/);
  assert.match(controller, /relayApplicantApplicationEvent\(id, 'application:disqualified'/);
  assert.match(mobileRoutes, /'application:updated'/);
  assert.match(mobileRoutes, /'application:disqualified'/);
});

test('selection changes broadcast a safe application refresh event', () => {
  const controller = read('admin/backend/controllers/selectionController.js');
  assert.match(controller, /relayModuleEvent\(\{[\s\S]*event: 'application:updated'/);
  assert.match(controller, /source: 'selection'/);
});

test('mounted mobile status consumers react through applicationRevision', () => {
  const provider = read('mobile/frontend/lib/features/notifications/presentation/providers/notification_provider.dart');
  const dashboard = read('mobile/frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart');
  const tracking = read('mobile/frontend/lib/features/forms/presentation/screens/status_tracking_screen.dart');
  assert.match(provider, /case MobileRealtimeEvents\.applicationUpdated:[\s\S]*_applicationRevision \+= 1/);
  assert.match(dashboard, /provider\.applicationRevision != _lastApplicationRevision/);
  assert.match(tracking, /provider\.applicationRevision == _lastApplicationRevision/);
});
