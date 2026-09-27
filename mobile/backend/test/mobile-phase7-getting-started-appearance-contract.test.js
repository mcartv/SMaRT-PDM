const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const read = (...parts) =>
  fs.readFileSync(path.join(mobileRoot, 'frontend', 'lib', ...parts), 'utf8');

const settings = read('shared', 'widgets', 'app_settings_sheet.dart');
const themeProvider = read('app', 'theme', 'theme_provider.dart');
const dashboard = read(
  'features',
  'dashboard',
  'presentation',
  'screens',
  'dashboard_screen.dart'
);

test('Appearance exposes Light and Dark only', () => {
  assert.match(settings, /title: 'Light'/);
  assert.match(settings, /title: 'Dark'/);
  assert.doesNotMatch(settings, /title: 'System'/);
  assert.doesNotMatch(settings, /ThemeMode\.system/);
});

test('old System preferences resolve to Light instead of a hidden mode', () => {
  assert.match(themeProvider, /ThemeMode _themeMode = ThemeMode\.light/);
  assert.match(themeProvider, /return value == 'dark' \? ThemeMode\.dark : ThemeMode\.light/);
  assert.match(themeProvider, /initialThemeMode: ThemeMode\.light/);
  assert.doesNotMatch(themeProvider, /ThemeMode\.system/);
});

test('Getting Started guide has clearer student-facing progress and wording', () => {
  assert.match(dashboard, /'Getting Started'/);
  assert.match(dashboard, /'Step \$\{_index \+ 1\} of \$\{_steps\.length\}'/);
  assert.match(dashboard, /LinearProgressIndicator/);
  assert.match(dashboard, /AnimatedSwitcher/);
  assert.match(dashboard, /Endorsement progress/);
  assert.match(dashboard, /Announcements, and Messages/);
  assert.match(dashboard, /isLast \? 'Done' : 'Next'/);
  assert.doesNotMatch(dashboard, /Saving\.\.\./);
  assert.doesNotMatch(dashboard, /Getting started \$\{_index \+ 1\}\/\$\{_steps\.length\}/);
});

test('first-time onboarding persistence behavior remains unchanged', () => {
  assert.match(dashboard, /await prefs\.setBool\(guideKey, true\)/);
  assert.match(dashboard, /await _profileService\.markOnboardingSeen\(\)/);
  assert.match(dashboard, /barrierDismissible: false/);
});
