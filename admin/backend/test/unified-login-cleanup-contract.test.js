'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const COMPATIBILITY_LOGIN_FILES = [
  'frontend/src/pages/AdminLogin.jsx',
  'frontend/src/pages/PDLogin.jsx',
  'frontend/src/pages/GuidanceLogin.jsx',
  'frontend/src/pages/SDOLogin.jsx',
  'frontend/src/pages/ROCoordinatorLogin.jsx',
  'frontend/src/pages/DepartmentPortalLogin.jsx',
];

test('public app exposes one unified login and keeps compatibility redirects', () => {
  const app = read('frontend/src/App.jsx');

  assert.match(app, /path="\/login"\s+element=\{<UnifiedLogin\s*\/>\}/);
  assert.match(app, /path="\/admin\/login"\s+element=\{<AdminLogin\s*\/>\}/);

  for (const path of ['/sdo/login', '/guidance/login', '/pd/login', '/ro-coordinator/login']) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(app, new RegExp(`path="${escaped}"[\\s\\S]{0,120}Navigate to="\\/login"`));
  }
});

test('legacy login components are inert compatibility shims with no duplicated authentication UI', () => {
  for (const file of COMPATIBILITY_LOGIN_FILES) {
    const source = read(file);
    assert.match(source, /Navigate to="\/login" replace/);
    assert.doesNotMatch(source, /authService|<form|type="password"|PDM-Facade|Login Access/);
  }

  const legacyCard = read('frontend/src/components/auth/UnifiedStaffLoginCard.jsx');
  assert.match(legacyCard, /UnifiedUserLoginCard/);
  assert.doesNotMatch(legacyCard, /<form|authService|Authorized Staff Access|Staff sign in/);
});

test('session invalidation sends users directly to the unified login', () => {
  const authService = read('frontend/src/services/authService.js');

  assert.match(authService, /window\.location\.replace\('\/login'\)/);
  assert.doesNotMatch(authService, /window\.location\.replace\('\/admin\/login'\)/);
});


test('Admin-only password recovery is labeled clearly from the unified login', () => {
  const loginCard = read('frontend/src/components/auth/UnifiedUserLoginCard.jsx');
  const forgot = read('frontend/src/pages/ForgotPassword.jsx');

  assert.match(loginCard, /Admin password recovery/);
  assert.match(forgot, /Admin Password Recovery/);
  assert.match(forgot, /Registered Admin Email/);
  assert.match(forgot, /Reset Admin Password/);
  assert.match(forgot, /\/api\/auth\/admin\/forgot-password\/start/);
  assert.match(forgot, /\/api\/auth\/admin\/forgot-password\/verify/);
  assert.match(forgot, /\/api\/auth\/admin\/forgot-password\/reset/);
  assert.doesNotMatch(forgot, /\/api\/auth\/forgot-password\/(?:start|verify|reset)/);
});

test('login and Admin forgot-password reloads reuse the landing public loader', () => {
  const networkGate = read('frontend/src/components/system/NetworkGate.jsx');

  for (const path of ['/landing', '/login', '/admin/forgot-password']) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(networkGate, new RegExp(`['\"]${escaped}['\"]`));
  }

  assert.match(networkGate, /PUBLIC_REFRESH_LOADER_MIN_MS\s*=\s*1_500/);
  assert.match(networkGate, /performance\.getEntriesByType\('navigation'\)/);
  assert.match(networkGate, /<PublicLogoLoader/);
  assert.doesNotMatch(networkGate, /The landing page cannot reach the server right now/);
});
