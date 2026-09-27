const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const loginPath = path.join(
  mobileRoot,
  'frontend',
  'lib',
  'features',
  'auth',
  'presentation',
  'screens',
  'login_screen.dart'
);
const login = fs.readFileSync(loginPath, 'utf8');

test('Phase 2.1 login polish marker is present', () => {
  assert.match(login, /SMART-PDM_MOBILE_AUTH_LOGIN_POLISH_PHASE2_1_V1/);
});

test('login responds to compact widths and larger text without wrapping the form', () => {
  assert.match(login, /LayoutBuilder/);
  assert.match(login, /MediaQuery\.textScalerOf\(context\)\.scale\(1\)/);
  assert.match(login, /constraints\.maxWidth < 360 \|\| textScale > 1\.15/);
  assert.match(login, /horizontalPadding = isCompact \? 16\.0 : 20\.0/);
  assert.match(login, /BoxConstraints\(maxWidth: 520\)/);
  assert.match(login, /SingleChildScrollView/);
});

test('login card and identity icon use restrained compact proportions', () => {
  assert.match(login, /cardPadding = isCompact \? 20\.0 : 22\.0/);
  assert.match(login, /iconSize = isCompact \? 58\.0 : 64\.0/);
  assert.match(login, /isCompact \? 22 : 26/);
  assert.doesNotMatch(login, /width: 72/);
  assert.doesNotMatch(login, /height: 72/);
  assert.doesNotMatch(login, /BorderRadius\.circular\(30\)/);
});

test('existing login behavior and routes remain wired', () => {
  assert.match(login, /_authService\.login\(/);
  assert.match(login, /StudentIdInputFormatter\.toFullStudentId/);
  assert.match(login, /AppRoutes\.home/);
  assert.match(login, /AppRoutes\.studentLookup/);
  assert.match(login, /AppRoutes\.forgotPassword/);
  assert.match(login, /_obscurePassword\s*=\s*!_obscurePassword/);
  assert.match(login, /hasPrefilledId/);
  assert.match(login, /focusPassword/);
});

test('login keeps keyboard-safe scrolling and dark surfaces', () => {
  assert.match(login, /SafeArea/);
  assert.match(login, /SingleChildScrollView/);
  assert.match(login, /AppColors\.applicantDarkBackground/);
  assert.match(login, /AppColors\.applicantDarkSurface/);
  assert.match(login, /AppColors\.applicantDarkSurfaceMuted/);
});
