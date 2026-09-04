const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('onboarding setup remains separate from contact-only Profile editing', () => {
  const service = read('mobile/backend/src/services/profileService.js');
  const controller = read('mobile/backend/src/controllers/profileController.js');

  assert.match(service, /async function setupMyProfile/);
  assert.match(service, /async function updateMyProfile/);
  assert.match(controller, /profileService\.setupMyProfile\(userId, req\.body \|\| \{\}\)/);
  assert.match(service, /Profile & Account can only update phone number and address/);
  assert.match(service, /'phone_number'/);
  assert.match(service, /'street_address'/);
  assert.match(service, /'barangay'/);
});

test('Profile UI keeps Section read-only and preserves structured address fields', () => {
  const screen = read('mobile/frontend/lib/features/profile/presentation/screens/profile_screen.dart');

  assert.match(screen, /label:\s*'Section'[\s\S]{0,180}enabled:\s*false/);
  assert.doesNotMatch(screen, /setString\('user_section'/);
  assert.match(screen, /'street_address':\s*_streetAddressController/);
  assert.match(screen, /'subdivision':\s*_subdivisionController/);
  assert.match(screen, /'barangay':\s*_barangayController/);
  assert.match(screen, /'city':\s*_cityController/);
  assert.match(screen, /'province':\s*_provinceController/);
  assert.match(screen, /'zip_code':\s*_zipCodeController/);
});
