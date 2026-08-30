const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const backendService = read(
  path.join(backendRoot, 'src', 'services', 'applicationService.js')
);
const preview = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'application_form_preview_screen.dart'
  )
);
const editor = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'new_applicant_screen.dart'
  )
);
const frontendService = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'forms',
    'data',
    'services',
    'application_service.dart'
  )
);
const provider = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'forms',
    'presentation',
    'providers',
    'new_scholar_provider.dart'
  )
);
const validator = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'forms',
    'domain',
    'validation',
    'application_submission_validator.dart'
  )
);
const routes = read(
  path.join(frontendRoot, 'lib', 'app', 'routes', 'app_routes.dart')
);

test('Review current Application Form behavior', () => {
  assert.match(preview, /fetchMySubmittedApplicationForm\(\)/);
  assert.match(frontendService, /\/api\/applications\/me\/submitted-form/);
  assert.match(routes, /applicationFormPreview = '\/application-form-preview'/);
});

test('Ensure Application Form remains editable when editing is still allowed', () => {
  assert.match(
    backendService,
    /const lifecycleCanEdit =\s*application\.is_archived !== true &&\s*!terminalApplicationStatus &&\s*!selectionStarted &&\s*!activated;/s
  );
  assert.match(
    backendService,
    /const canEdit =\s*lifecycleCanEdit &&\s*!applicationFormAwaitingVerification &&\s*applicationFormReviewStatus !== 'verified';/s
  );
  assert.match(preview, /'Editing available'/);
});

test('Keep the existing Application Form fields and structure', () => {
  for (const step of [
    'step_personal_intake.dart',
    'step_family_intake.dart',
    'step_academic_intake.dart',
    'step_essay_intake.dart',
    'step_submit_intake.dart',
  ]) {
    assert.match(editor, new RegExp(step.replaceAll('.', '\\.')));
  }
  assert.match(editor, /'Personal',\s*'Family',\s*'Academic',\s*'Essay',\s*'Submit'/s);
});

test('Keep existing required-field validation', () => {
  assert.match(editor, /ApplicationSubmissionValidator/);
  assert.match(editor, /validateSubmissionPreflight/);
  assert.match(validator, /validateSubmissionPreflight/);
});

test('Keep existing field prefill behavior', () => {
  assert.match(editor, /fetchMySubmittedApplicationForm\(\)/);
  assert.match(editor, /_data\.applySavedForm\(savedFormData\)/);
});

test('Add/verify Preview Form mode', () => {
  assert.match(preview, /title: const Text\('Preview Form'\)/);
  assert.match(routes, /applicationFormPreview/);
});

test('Add/verify Edit Form mode', () => {
  assert.match(preview, /'Edit Form'/);
  assert.match(preview, /AppRoutes\.newApplicant/);
  assert.match(preview, /'editExistingApplication': true/);
});

test('Preview Form must be read-only', () => {
  assert.match(preview, /SelectableText\(/);
  assert.doesNotMatch(preview, /TextFormField\(/);
  assert.doesNotMatch(preview, /TextField\(/);
});

test('Edit Form must use the existing application form', () => {
  assert.match(preview, /AppRoutes\.newApplicant/);
  assert.match(editor, /widget\.editExistingApplication/);
  assert.match(editor, /fetchMySubmittedApplicationForm\(\)/);
});

test('Changes made in Edit Form must be saved correctly', () => {
  assert.match(frontendService, /updateSubmittedApplication/);
  assert.match(frontendService, /body\['edit_existing_application'\] = true/);
  assert.match(provider, /updateSubmittedApplication/);
  assert.match(backendService, /if \(editExistingApplication\)/);
});

test('Preview must immediately reflect saved changes', () => {
  assert.match(preview, /if \(updated == true\)[\s\S]*await _load\(\);/);
});

test('Prevent duplicate application records when editing', () => {
  assert.match(
    backendService,
    /existingApplication\.application_id/
  );
  assert.match(
    backendService,
    /\.eq\(\s*'application_id',\s*existingApplication\.application_id\s*\)/s
  );
  assert.match(
    backendService,
    /The submitted application changed\. Refresh the form before editing\./
  );
});

test('Verify responsive layout on different mobile screen sizes', () => {
  assert.match(preview, /RefreshIndicator\(/);
  assert.match(preview, /ListView\(/);
  assert.match(preview, /Wrap\(/);
  assert.match(preview, /LayoutBuilder\(/);
  assert.match(preview, /Expanded\(/);
});

test('Verify existing application submission workflow is not affected', () => {
  assert.match(
    provider,
    /editExistingApplication\s*\?\s*await _applicationService\.updateSubmittedApplication[\s\S]*:\s*await _applicationService\.submitApplication/
  );
  assert.match(
    backendService,
    /!editExistingApplication[\s\S]*opening\.posting_status !== 'open'/
  );
});
