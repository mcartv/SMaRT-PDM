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

test('Mobile Available Scholarships does not display scholarship slot counts', () => {
  assert.doesNotMatch(openingsScreen, /Scholarship Slots?/);
  assert.doesNotMatch(openingsScreen, /opening\.allocatedSlots/);
  assert.doesNotMatch(openingsScreen, /_buildAvailabilityHighlight/);
});
