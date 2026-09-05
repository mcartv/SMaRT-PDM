const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const openingsScreen = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../frontend/lib/features/applicant/presentation/screens/scholarship_openings_screen.dart'
  ),
  'utf8'
);
const openingClient = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../frontend/lib/features/applicant/data/services/program_opening_service.dart'
  ),
  'utf8'
);
const openingController = fs.readFileSync(
  path.resolve(__dirname, '../src/controllers/openingController.js'),
  'utf8'
);
const dashboardScreen = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart'
  ),
  'utf8'
);

test('Mobile Available Scholarships does not display scholarship slot counts', () => {
  assert.doesNotMatch(openingsScreen, /Scholarship Slots?/);
  assert.doesNotMatch(openingsScreen, /opening\.allocatedSlots/);
  assert.doesNotMatch(openingsScreen, /_buildAvailabilityHighlight/);
});

test('Mobile Available Scholarships reconciles closed openings even after a missed realtime event', () => {
  assert.match(openingsScreen, /Timer\.periodic\(const Duration\(seconds: 20\)/);
  assert.doesNotMatch(
    openingsScreen,
    /if \(MobileRealtimeService\.instance\.isRealtimeHealthy\) return;/
  );
  assert.match(openingClient, /\/api\/openings\?revision=\$revision/);
});

test('Mobile opening responses cannot be cached after an admin status change', () => {
  assert.match(
    openingController,
    /Cache-Control', 'private, no-store, max-age=0'/
  );
  assert.match(openingController, /Pragma', 'no-cache'/);
});

test('Mobile Dashboard reconciles Available Scholarships after a missed opening realtime event', () => {
  assert.match(
    dashboardScreen,
    /_openingReconciliationTimer = Timer\.periodic\([\s\S]*Duration\(seconds: 20\)/
  );
  assert.match(dashboardScreen, /unawaited\(_loadOpenings\(\)\)/);
  assert.match(dashboardScreen, /_openingReconciliationTimer\?\.cancel\(\)/);
});
