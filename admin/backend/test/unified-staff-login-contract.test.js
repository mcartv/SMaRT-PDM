'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read, exists } = require('./_current-system-test-utils');

test('unified login card routes by the returned primary role', () => {
  const card = read('frontend/src/components/auth/UnifiedUserLoginCard.jsx');

  assert.ok(exists('frontend/src/components/auth/UnifiedUserLoginCard.jsx'));
  assert.match(card, /authService\.login/);
  assert.match(card, /data\?\.user\?\.role/);
  assert.match(card, /PORTAL_CONFIG\[portalName\]/);
  assert.match(card, /savePortalSession/);
  assert.match(card, /navigate\(portal\.redirectPath/);
  assert.match(card, /\/admin\/forgot-password/);
  assert.doesNotMatch(card, />\s*Staff\s*</i);
});

test('login loading state remains busy until successful navigation unmounts the page', () => {
  const card = read('frontend/src/components/auth/UnifiedUserLoginCard.jsx');

  assert.match(card, /if \(loginRequestRef\.current \|\| isLoading\) return/);
  assert.match(card, /Signing in\.\.\./);
  assert.match(card, /disabled=\{isLoading \|\| !turnstileToken\}/);
  assert.match(card, /onClick=\{\(\) => navigate\('\/admin\/forgot-password'[\s\S]{0,220}disabled=\{isLoading\}/);
  assert.match(card, /Admin password recovery/);
  assert.match(card, /catch \(err\)[\s\S]{0,320}setIsLoading\(false\)/);
  assert.doesNotMatch(card, /finally\s*\{\s*setIsLoading\(false\)/);
});

test('login motion is subtle and recovery page is static', () => {
  const login = read('frontend/src/pages/UnifiedLogin.jsx');
  const recovery = read('frontend/src/pages/ForgotPassword.jsx');

  assert.match(login, /smartpdm-login-slide-right 1s/);
  assert.match(login, /smartpdm-login-facade 1\.6s/);
  assert.doesNotMatch(login, /smartpdm-login-float/);
  assert.doesNotMatch(recovery, /@keyframes smartpdm-recovery|smartpdm-recovery-/);
});

test('Admin recovery keeps the original Admin-only API and accurate loading actions', () => {
  const recovery = read('frontend/src/pages/ForgotPassword.jsx');

  assert.match(recovery, /\/api\/auth\/admin\/forgot-password\/start/);
  assert.match(recovery, /\/api\/auth\/admin\/forgot-password\/verify/);
  assert.match(recovery, /\/api\/auth\/admin\/forgot-password\/reset/);
  assert.match(recovery, /loadingAction === 'send'/);
  assert.match(recovery, /loadingAction === 'resend'/);
  assert.match(recovery, /loadingAction === 'verify'/);
  assert.match(recovery, /loadingAction === 'reset'/);
  assert.match(recovery, /Registered Admin Email/);
  assert.match(recovery, /Admin Password Recovery/);
  assert.match(recovery, /Reset Admin Password/);
  assert.match(recovery, /Back to Login/);
  assert.doesNotMatch(recovery, /Enter the registered Admin email address to request a recovery code\./i);
});
