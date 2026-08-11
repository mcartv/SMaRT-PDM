'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('Admin recovery resolves the submitted active Admin account instead of one hardcoded email', () => {
  const source = read('admin/backend/controllers/authController.js');

  assert.match(source, /async function findAuthorizedAdminForReset\(email\)/);
  assert.match(source, /const user = await findStaffByEmail\(normalizedEmail\)/);
  assert.match(source, /if \(user\.is_archived === true\) return null/);
  assert.match(source, /if \(resolvedRole !== 'admin'\)/);
  assert.doesNotMatch(source, /ALLOWED_ADMIN_EMAIL/);
  assert.match(source, /sendAdminResetOtp\(\{[\s\S]*to: user\.email/);
});

test('Admin forgot-password page asks which Admin email should be recovered', () => {
  const source = read('admin/frontend/src/pages/ForgotPassword.jsx');
  const login = read('admin/frontend/src/pages/AdminLogin.jsx');

  assert.match(source, /const \[email, setEmail\]/);
  assert.match(source, /case 'email':/);
  assert.match(source, /Admin Email Address/);
  assert.match(source, /\{ email: normalizedEmail \}/);
  assert.match(source, /email: normalizeEmail\(email\)/);
  assert.doesNotMatch(source, /OFFICIAL_ADMIN_EMAIL/);
  assert.match(login, /forgot-password'[\s\S]*state: \{ email \}/);
});

test('frontend auth service no longer defaults recovery to a single official Admin email', () => {
  const source = read('admin/frontend/src/services/authService.js');

  assert.doesNotMatch(source, /OFFICIAL_ADMIN_EMAIL/);
  assert.match(source, /startAdminPasswordReset: async \(email\)/);
  assert.match(source, /verifyAdminPasswordResetOtp: async \([\s\S]*email[\s\S]*\) =>/);
  assert.match(source, /resetAdminPassword: async \([\s\S]*email[\s\S]*\) =>/);
});
