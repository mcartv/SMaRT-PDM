const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('forced session logout stores one-time reason-specific login feedback', () => {
  const authStorage = read('frontend/src/utils/authStorage.js');

  assert.match(authStorage, /Account Disabled/);
  assert.match(authStorage, /Your account has been disabled by an administrator/);
  assert.match(authStorage, /Access Updated/);
  assert.match(authStorage, /Session Expired/);
  assert.match(authStorage, /consumePortalSessionFeedback/);
  assert.match(authStorage, /SESSION_FEEDBACK_MAX_AGE_MS/);
});

test('protected HTTP 401s keep the forced logout path even when sockets are unavailable', () => {
  const authStorage = read('frontend/src/utils/authStorage.js');
  const main = read('frontend/src/main.jsx');

  assert.match(authStorage, /installSessionInvalidationFetchGuard/);
  assert.match(authStorage, /response\.status !== 401/);
  assert.match(authStorage, /SESSION_INVALIDATION_CODES\.has\(code\)/);
  assert.match(main, /installSessionInvalidationFetchGuard\(\)/);
  assert.match(authStorage, /redirectPortalToLogin/);
  assert.match(authStorage, /window\.location\.replace\(portal\.loginPath\)/);
});

test('all portal sessions use a three-second server-validation timer independent of Socket.IO', () => {
  const authService = read('frontend/src/services/authService.js');

  assert.match(authService, /validateCurrentPortal/);
  assert.match(authService, /authService\.validateStaffSession\(active\.token\)/);
  assert.match(authService, /setInterval\(validateCurrentPortal, 3_000\)/);
  assert.match(authService, /invalidateStoredPortalSession/);
  assert.match(authService, /validationInFlight/);
  assert.match(authService, /validateCurrentPortal\(\);/);
  assert.doesNotMatch(authService, /initializeSocket\(\)/);
  assert.doesNotMatch(authService, /!navigator\.onLine \|\|\s*document\.hidden/);
});

test('session validation uses a lightweight protected status route with an older-backend fallback', () => {
  const authService = read('frontend/src/services/authService.js');
  const authRoutes = read('backend/routes/authRoutes.js');
  const authController = read('backend/controllers/authController.js');

  assert.match(authService, /\/api\/auth\/session\/check/);
  assert.match(authService, /error\.status === 404/);
  assert.match(authService, /\/api\/theme-settings/);
  assert.match(authRoutes, /router\.get\('\/session\/check', protect, authController\.getStaffSessionStatus\)/);
  assert.match(authController, /exports\.getStaffSessionStatus/);
  assert.match(authController, /active: true/);
});

test('login pages surface the forced logout reason and department routes validate current access', () => {
  const adminLogin = read('frontend/src/pages/AdminLogin.jsx');
  const departmentLogin = read('frontend/src/pages/DepartmentPortalLogin.jsx');
  const protectedRoute = read('frontend/src/components/auth/ProtectedRoute.jsx');
  const authService = read('frontend/src/services/authService.js');

  assert.match(adminLogin, /consumePortalSessionFeedback\('admin'\)/);
  assert.match(adminLogin, /sessionFeedback\.title/);
  assert.match(departmentLogin, /consumePortalSessionFeedback\(portalKey\)/);
  assert.match(departmentLogin, /sessionFeedback\.message/);
  assert.match(protectedRoute, /authService\.validateStaffSession\(token\)/);
  assert.match(authService, /validateStaffSession/);
  assert.match(authService, /\/api\/auth\/session\/check/);
});
