const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('activation-only revision prevents the transition modal on ordinary scholar login', () => {
  const provider = read('mobile/frontend/lib/features/notifications/presentation/providers/notification_provider.dart');
  const shell = read('mobile/frontend/lib/app/shell/presentation/screens/top_level_shell_screen.dart');

  assert.match(provider, /int _scholarActivationRevision = 0/);
  assert.match(provider, /if \(!_hasScholarAccess\) \{[\s\S]*_scholarActivationRevision \+= 1/);
  assert.match(shell, /revision <= _handledScholarActivationRevision/);
  assert.match(shell, /_isScholarTransitionOpen/);
});

test('activation modal retries, confirms success, and exposes bounded recovery', () => {
  const dialog = read('mobile/frontend/lib/features/scholar/presentation/widgets/scholar_activation_transition_dialog.dart');

  assert.match(dialog, /Duration\.zero/);
  assert.match(dialog, /Duration\(seconds: 1\)/);
  assert.match(dialog, /Duration\(seconds: 3\)/);
  assert.match(dialog, /Scholar access activated/);
  assert.match(dialog, /Continue as Applicant/);
  assert.match(dialog, /Try Again/);
  assert.match(dialog, /PopScope\([\s\S]*canPop: !_isSynchronizing/);
});

test('successful synchronization refreshes authoritative profile and returns home', () => {
  const provider = read('mobile/frontend/lib/features/notifications/presentation/providers/notification_provider.dart');
  const shell = read('mobile/frontend/lib/app/shell/presentation/screens/top_level_shell_screen.dart');

  assert.match(provider, /Future<bool> reconcileScholarActivation\(\)/);
  assert.match(provider, /await _refreshScholarAccessFromProfile\(\)/);
  assert.match(provider, /await refresh\(silent: true\)/);
  assert.match(provider, /deferScholarActivationUntilNextRefresh/);
  assert.match(shell, /await provider\.deferScholarActivationUntilNextRefresh\(\)/);
  assert.match(shell, /await switchToIndex\(0, animated: false\)/);
});
