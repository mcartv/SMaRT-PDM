const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const mobileService = read(path.join(backendRoot, 'src', 'services', 'applicationService.js'));
const adminService = read(path.join(repoRoot, 'admin', 'backend', 'services', 'applicationService.js'));
const preview = read(path.join(frontendRoot, 'lib', 'features', 'applicant', 'presentation', 'screens', 'application_form_preview_screen.dart'));
const editor = read(path.join(frontendRoot, 'lib', 'features', 'applicant', 'presentation', 'screens', 'new_applicant_screen.dart'));
const notifications = read(path.join(frontendRoot, 'lib', 'features', 'notifications', 'presentation', 'screens', 'notifications_screen.dart'));
const frontendService = read(path.join(frontendRoot, 'lib', 'features', 'forms', 'data', 'services', 'application_service.dart'));
const provider = read(path.join(frontendRoot, 'lib', 'features', 'forms', 'presentation', 'providers', 'new_scholar_provider.dart'));

test('Application Form remains editable while lifecycle allows editing', () => {
  assert.match(
    mobileService,
    /const canEdit =\s*application\.is_archived !== true &&\s*!terminalApplicationStatus &&\s*!selectionStarted &&\s*!activated;/
  );
  assert.doesNotMatch(mobileService, /const canEdit =\s*applicationFormCorrectionRequested &&/);
});

test('Preview Form and Edit Form reuse the existing application workflow', () => {
  assert.match(preview, /title: const Text\('Preview Form'\)/);
  assert.match(preview, /'Edit Form'/);
  assert.match(preview, /AppRoutes\.newApplicant/);
  assert.match(preview, /'editExistingApplication': true/);
  assert.match(frontendService, /body\['edit_existing_application'\] = true/);
  assert.match(provider, /updateSubmittedApplication/);
});

test('Admin Application Form re-edit request creates a specific mobile notification', () => {
  assert.match(adminService, /Application Form Edit Required/);
  assert.match(adminService, /referenceType: 'application_form'/);
  assert.match(adminService, /review\?\.documentKey === 'application_form'/);
  assert.match(adminService, /review\?\.reviewStatus === 'reupload_required'/);
  assert.match(adminService, /reviews: requiredReviews/);
});

test('Application Form correction notification opens Preview Form', () => {
  assert.match(notifications, /referenceType == 'application_form'/);
  assert.match(notifications, /AppRoutes\.applicationFormPreview/);
});

test('Preview clearly indicates correction request and preserves Admin remark', () => {
  assert.match(preview, /'Correction requested'/);
  assert.match(preview, /Admin remark: \$_correctionComment/);
  assert.match(preview, /_correctionRequested = editability\['correction_requested'\] == true/);
});

test('Successful Edit Form submission gives clear verification guidance', () => {
  assert.match(editor, /Application Form Submitted for Verification/);
  assert.match(editor, /all important information you entered is complete and correct/);
  assert.match(editor, /Wait for the next verification update from OSFA\/Admin/);
  assert.match(editor, /another correction is required or when the review status changes/);
  assert.match(editor, /barrierDismissible: false/);
});

test('Preview refreshes immediately after successful editing', () => {
  assert.match(preview, /if \(updated == true\) \{\s*await _load\(\);\s*\}/s);
});

test('Editing updates the existing application rather than creating a duplicate', () => {
  assert.match(mobileService, /existingApplication\.application_id/);
  assert.match(
    mobileService,
    /\.eq\(\s*'application_id',\s*existingApplication\.application_id\s*\)/s
  );
});
