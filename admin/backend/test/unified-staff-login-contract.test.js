'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read, exists } = require('./_current-system-test-utils');

test('public auth login uses the unified staff login handler', () => {
  const routes = read('backend/routes/authRoutes.js');
  const controller = read('backend/controllers/authController.js');

  assert.match(routes, /router\.post\('\/login',\s*loginLimiter,\s*authController\.staffLogin\)/);
  assert.match(controller, /exports\.staffLogin\s*=\s*async\s*\(req, res\)\s*=>\s*loginWithRole\(req, res, null\)/);
  assert.match(controller, /const tokenRole = role \|\| resolvedRole/);
  assert.match(controller, /STAFF_ACCESS_NOT_CONFIGURED/);
});

test('landing page owns the single staff login and legacy login URLs redirect there', () => {
  const app = read('frontend/src/App.jsx');
  const landing = read('frontend/src/pages/SmartPDMLanding.jsx');

  assert.ok(exists('frontend/src/components/auth/UnifiedStaffLoginCard.jsx'));
  assert.match(landing, /UnifiedStaffLoginCard/);
  assert.doesNotMatch(landing, /portalLinks\.map/);

  for (const path of [
    '/admin/login',
    '/pd/login',
    '/guidance/login',
    '/sdo/login',
    '/ro-coordinator/login',
  ]) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(app, new RegExp(`path="${escaped}"[^\n]+/landing#access`));
  }
});

test('unified login routes by returned primary role instead of asking for an office portal', () => {
  const card = read('frontend/src/components/auth/UnifiedStaffLoginCard.jsx');

  assert.match(card, /authService\.login/);
  assert.match(card, /data\?\.user\?\.role/);
  assert.match(card, /PORTAL_CONFIG\[portalName\]/);
  assert.match(card, /savePortalSession/);
  assert.match(card, /navigate\(portal\.redirectPath/);
  assert.match(card, /active RO Area assignment/);
});
