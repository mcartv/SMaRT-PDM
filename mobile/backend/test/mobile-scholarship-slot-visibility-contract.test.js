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

const openingService = fs.readFileSync(
  path.resolve(__dirname, '../src/services/openingService.js'),
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

test('Mobile opening visibility is no longer suppressed by applicant eligibility', () => {
  assert.match(openingService, /\.in\('posting_status', \['open', 'closed'\]\)/);
  assert.match(
    openingService,
    /status === 'closed'[\s\S]*Number\(item\.available_slots \|\| 0\) > 0/
  );
  assert.match(openingService, /availability\.can_apply === true[\s\S]*!activeApplication/);
  assert.doesNotMatch(openingService, /const scopedItems = allItems\.filter/);
  assert.doesNotMatch(openingService, /items:\s*availability\.can_apply \? items : \[\]/);
  assert.doesNotMatch(
    openingClient,
    /opening\.postingStatus\.trim\(\)\.toLowerCase\(\) == 'open'/
  );
  assert.doesNotMatch(
    openingClient,
    /opening\.canApply &&\s*!opening\.hasApplied/
  );
});

