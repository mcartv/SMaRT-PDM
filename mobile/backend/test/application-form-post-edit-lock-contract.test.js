const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const mobileService = fs.readFileSync(
  path.join(backendRoot, 'src', 'services', 'applicationService.js'),
  'utf8'
);

const preview = fs.readFileSync(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'application_form_preview_screen.dart'
  ),
  'utf8'
);

const editor = fs.readFileSync(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'new_applicant_screen.dart'
  ),
  'utf8'
);

test('initial submitted Application Form can remain editable while lifecycle allows', () => {
  assert.match(mobileService, /const lifecycleCanEdit =/);
  assert.match(mobileService, /application\.is_archived !== true/);
  assert.match(mobileService, /!terminalApplicationStatus/);
  assert.match(mobileService, /!selectionStarted/);
  assert.match(mobileService, /!activated/);
});

test('successful requested re-edit is marked as awaiting verification', () => {
  assert.match(mobileService, /reason_code: 'APPLICATION_FORM_RESUBMITTED'/);
  assert.match(
    mobileService,
    /applicationFormAwaitingVerification =\s*applicationFormReviewStatus === 'pending'/s
  );
});

test('Edit Form is disabled while the resubmitted form awaits verification', () => {
  assert.match(
    mobileService,
    /const canEdit =\s*lifecycleCanEdit &&\s*!applicationFormAwaitingVerification &&\s*applicationFormReviewStatus !== 'verified';/s
  );
  assert.match(
    mobileService,
    /Edit Form is temporarily disabled until OSFA\/Admin completes the review or requests another correction/
  );
});

test('Preview Form receives and displays the awaiting verification state', () => {
  assert.match(preview, /bool _awaitingVerification = false;/);
  assert.match(
    preview,
    /_awaitingVerification = editability\['awaiting_verification'\] == true/
  );
  assert.match(preview, /'Awaiting verification'/);
  assert.match(preview, /Icons\.hourglass_top_rounded/);
});

test('Edit Form button uses backend can_edit and therefore becomes greyed out', () => {
  assert.match(preview, /final canEdit = _data != null && _canEdit;/);
  assert.match(preview, /onPressed: canEdit \? _openEditor : null/);
});

test('another Admin correction request can unlock Edit Form again', () => {
  assert.match(
    mobileService,
    /applicationFormCorrectionRequested =\s*applicationFormReviewStatus === 'reupload_required'/
  );
  assert.match(
    mobileService,
    /applicationFormAwaitingVerification =\s*applicationFormReviewStatus === 'pending'/
  );
});

test('verified Application Form remains locked', () => {
  assert.match(mobileService, /applicationFormReviewStatus !== 'verified'/);
  assert.match(
    mobileService,
    /Your Application Form has been verified\. Edit Form is disabled unless OSFA\/Admin requests another correction\./
  );
});

test('post-edit guidance dialog remains intact', () => {
  assert.match(editor, /Application Form Submitted for Verification/);
  assert.match(editor, /Wait for the next verification update from OSFA\/Admin/);
});
