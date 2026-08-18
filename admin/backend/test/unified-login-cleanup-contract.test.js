'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const LEGACY_LOGIN_FILES = [
  'AdminLogin.jsx',
  'PDLogin.jsx',
  'GuidanceLogin.jsx',
  'SDOLogin.jsx',
  'ROCoordinatorLogin.jsx',
  'DepartmentPortalLogin.jsx',
];

test('public app exposes one unified login and keeps legacy URL redirects', () => {
  const app = read('frontend/src/App.jsx');

  assert.match(app, /path="\/login"\s+element=\{<UnifiedLogin\s*\/>\}/);
  for (const path of ['/admin/login', '/sdo/login', '/guidance/login', '/pd/login', '/ro-coordinator/login']) {
    assert.match(app, new RegExp(`path="${path.replaceAll('/', '\\/')}"[\\s\\S]{0,120}Navigate to="\\/login"`));
  }
});

test('legacy role-specific login components are compatibility redirects only', () => {
  for (const file of LEGACY_LOGIN_FILES) {
    const source = read(`frontend/src/pages/${file}`);
    assert.match(source, /Navigate to="\/login" replace/);
    assert.doesNotMatch(source, /usePortalTheme|authPath|password|Email Address|Authorized .* Access/);
  }
});

test('backend exposes one login endpoint and no role-specific login endpoints', () => {
  const routes = read('backend/routes/authRoutes.js');
  const controller = read('backend/controllers/authController.js');

  assert.match(routes, /router\.post\('\/login',\s*loginLimiter,\s*authController\.staffLogin\)/);
  assert.doesNotMatch(routes, /router\.post\('\/(?:pd|guidance|sdo|ro-coordinator)\/login'/);
  assert.doesNotMatch(controller, /exports\.(?:pdLogin|guidanceLogin|sdoLogin|roCoordinatorLogin|adminLogin)/);
  assert.match(controller, /const tokenRole = resolvedRole;/);
  assert.match(controller, /USER_ACCESS_NOT_CONFIGURED/);
});

test('authenticated themes no longer fetch public role/login themes', () => {
  const hook = read('frontend/src/hooks/usePortalTheme.js');
  const landingHook = read('frontend/src/hooks/useLandingTheme.js');
  const service = read('backend/services/themeSettingService.js');

  assert.doesNotMatch(hook, /publicOnly/);
  assert.doesNotMatch(hook, /theme-settings\/public\/\$\{normalizedPortal\}/);
  assert.match(hook, /theme-settings\/current\/\$\{normalizedPortal\}/);
  assert.match(landingHook, /theme-settings\/public\/landing/);
  assert.match(service, /Only the Landing Page Theme is available publicly/);
});
