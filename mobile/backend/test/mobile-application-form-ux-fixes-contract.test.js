const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const shell = read('mobile/frontend/lib/features/applicant/presentation/screens/new_applicant_screen.dart');
const family = read('mobile/frontend/lib/features/forms/presentation/screens/step_family_intake.dart');
const academic = read('mobile/frontend/lib/features/forms/presentation/screens/step_academic_intake.dart');
const status = read('mobile/frontend/lib/features/dashboard/presentation/widgets/applicant_application_status_panel.dart');
const messagingProvider = read('mobile/frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');

test('application footer hides while keyboard is open and keeps consistent 52px actions', () => {
  assert.match(shell, /MediaQuery\.viewInsetsOf\(context\)\.bottom > 0/);
  assert.match(shell, /if \(!keyboardOpen\) _buildFooter\(provider\)/);
  assert.doesNotMatch(shell, /minimumSize:\s*const Size\(0, 56\)/);
  assert.match(shell, /minimumSize:\s*const Size\(0, 52\)/);
});

test('validation feedback revalidates and clears as corrected values become valid', () => {
  assert.match(shell, /void _handleFormChanged\(\)/);
  assert.match(shell, /_showValidationErrors\s*\?\s*_validateCurrentForm\(\)/);
  assert.match(shell, /if \(_showValidationErrors && validationError == null\)/);
  assert.match(shell, /_formFeedbackError = validationError/);
  assert.match(shell, /onChanged: _handleFormChanged/);
});

test('family form provides no-sibling N\/A handling for printable mapping', () => {
  assert.match(family, /title: 'No sibling'/);
  assert.match(family, /void _setNoSibling\(bool value\)/);
  for (const marker of [
    "siblingLastNameController.text = 'N/A'",
    "siblingFirstNameController.text = 'N/A'",
    "siblingMiddleNameController.text = 'N/A'",
    "siblingMobileController.text = 'N/A'",
    "siblingOccupationController.text = 'N/A'",
    "siblingCompanyController.text = 'N/A'",
    "widget.data.siblingEducationalAttainment = 'N/A'",
  ]) assert.ok(family.includes(marker), marker);
});

test('LRN accepts digits only and stays capped at 12 characters', () => {
  assert.match(academic, /keyboardType:\s*TextInputType\.number/);
  assert.match(academic, /FilteringTextInputFormatter\.digitsOnly/);
  assert.match(academic, /LengthLimitingTextInputFormatter\(12\)/);
  assert.match(academic, /RegExp\(r'\^\\d\{12\}\$'\)/);
});

test('secondary application-form actions use the same minimum height', () => {
  assert.match(family, /OutlinedButton\.styleFrom\([\s\S]*?minimumSize:\s*const Size\(0, 52\)/);
  assert.match(academic, /TextButton\.styleFrom\([\s\S]*?minimumSize:\s*const Size\(0, 52\)/);
});

test('application status is reorganized without inventing workflow states', () => {
  assert.match(status, /'APPLICATION STATUS'/);
  assert.match(status, /'Current status'/);
  assert.match(status, /application\.title/);
  assert.match(status, /application\.description/);
  assert.match(status, /application\.stepLabel/);
  assert.match(status, /application\.primaryAction/);
  assert.match(status, /minimumSize:\s*const Size\.fromHeight\(52\)/);
});


test('family form source has no malformed identifiers from the application-form patch', () => {
  for (const malformed of ['origrn', '_syncPreviousOrigr', '_syncPreviousOrigrn', ".jor(', ')", 'margrn:']) {
    assert.doesNotMatch(family, new RegExp(malformed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(family, /final origin = \[/);
  assert.match(family, /parentPreviousTownProvinceController\.text = origin/);
  assert.match(family, /return parts\.join\(', '\)/);
  assert.match(family, /margin: const EdgeInsets\.only\(bottom: 16\)/);
  assert.match(family, /_syncPreviousOrigin\(\)/);
});

test('read-only former-group realtime branch returns a bool explicitly', () => {
  assert.match(
    messagingProvider,
    /if \(cutoff == null \|\| message\.sentAt\.isAfter\(cutoff\)\) return false;/,
  );
});
