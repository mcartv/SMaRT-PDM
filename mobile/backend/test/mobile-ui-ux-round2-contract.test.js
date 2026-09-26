const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const register = read('mobile/frontend/lib/features/auth/presentation/screens/register_screen.dart');
const legalSheet = read('mobile/frontend/lib/shared/widgets/legal_document_sheet.dart');
const shell = read('mobile/frontend/lib/features/applicant/presentation/screens/new_applicant_screen.dart');
const family = read('mobile/frontend/lib/features/forms/presentation/screens/step_family_intake.dart');
const documents = read('mobile/frontend/lib/features/applicant/presentation/screens/applicant_documents_screen.dart');
const status = read('mobile/frontend/lib/features/dashboard/presentation/widgets/applicant_application_status_panel.dart');

test('registration legal agreement uses responsive document rows and a usable legal sheet', () => {
  assert.match(register, /Widget _policyLink\(/);
  assert.match(register, /'Terms & Privacy'/);
  assert.match(register, /title: 'Terms of Service'/);
  assert.match(register, /title: 'Privacy Statement'/);
  assert.match(legalSheet, /DraggableScrollableSheet\(/);
  assert.match(legalSheet, /SelectableText\(/);
  assert.match(legalSheet, /maxLines: 2/);
});

test('parent and guardian mobile inputs are numeric and secondary contacts are optional', () => {
  assert.match(family, /FilteringTextInputFormatter\.digitsOnly/);
  assert.match(family, /LengthLimitingTextInputFormatter\(11\)/);
  assert.match(family, /keyboardType: TextInputType\.number/);
  assert.match(family, /Provide at least one parent or guardian mobile number/);
  assert.match(family, /String\? _familyMobileError\(String value, \{bool required = false\}\)/);
  assert.match(shell, /_hasUsableParentGuardianMobile\(\)/);
  assert.match(shell, /_fillBlankParentGuardianMobilesWithNA\(\)/);
  assert.match(shell, /family\.mobile\.contact\.required/);
});

test('application form gives the form more screen space and keeps scholarship context compact', () => {
  assert.match(shell, /maxWidth: 920/);
  assert.match(shell, /margin: EdgeInsets\.zero/);
  assert.match(shell, /borderRadius: BorderRadius\.zero/);
  assert.match(shell, /'Selected scholarship'/);
  assert.doesNotMatch(shell, /'Selected Opening'/);
});

test('application navigation uses short action labels', () => {
  assert.match(shell, /return 'Complete Questions'/);
  assert.match(shell, /return 'Finish Essay'/);
  assert.match(shell, /\? 'Save Updates'/);
  assert.doesNotMatch(shell, /Complete Personal Statement/);
  assert.doesNotMatch(shell, /Answer Required Questions/);
});

test('required documents UI is responsive and never ellipsizes action labels', () => {
  assert.match(documents, /'Required document progress'/);
  assert.match(documents, /actionConstraints\.maxWidth < 430/);
  assert.match(documents, /constraints\.maxWidth < 390/);
  assert.match(documents, /'Needs action'/);
  assert.match(documents, /'View Application Form'/);
  assert.match(documents, /'Back to Dashboard'/);
  assert.doesNotMatch(documents, /TextOverflow\.ellipsis/);
});

test('application status moves the stage out of the cramped header and allows wrapping', () => {
  assert.match(status, /'APPLICATION STATUS'/);
  assert.match(status, /'Application progress: \$stepLabel'/);
  assert.match(status, /maxLines: 3/);
  assert.match(status, /application\.primaryAction\.label/);
  assert.match(status, /maxLines: 2/);
  assert.doesNotMatch(status, /TextOverflow\.ellipsis/);
  assert.doesNotMatch(status, /BoxConstraints\(maxWidth: 150\)/);
});

test('changed Dart files contain none of the previously observed corruption markers', () => {
  const combined = [register, legalSheet, shell, family, documents, status].join('\n');
  for (const malformed of ['origrn', '_syncPreviousOrigrn', ".jor(', ')", 'margrn:']) {
    assert.ok(!combined.includes(malformed), malformed);
  }
});
