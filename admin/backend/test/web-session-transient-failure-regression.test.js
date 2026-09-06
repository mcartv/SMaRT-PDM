'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('unexpected session-validation failures are not mislabeled as invalid tokens', () => {
  const middleware = read('backend/middleware/authMiddleware.js');

  assert.match(middleware, /err\?\.name === 'TokenExpiredError'/);
  assert.match(middleware, /SESSION_VALIDATION_UNAVAILABLE/);
  assert.match(middleware, /res\.status\(503\)/);
});

test('web clears sessions only for explicit invalidation codes', () => {
  const storage = read('frontend/src/utils/authStorage.js');
  const service = read('frontend/src/services/authService.js');
  const route = read('frontend/src/components/auth/ProtectedRoute.jsx');

  assert.match(storage, /export function isSessionInvalidationError/);
  assert.match(service, /isSessionInvalidationError\(error\)/);
  assert.match(route, /if \(!isSessionInvalidationError\(error\)\)/);
  assert.match(route, /setStatus\('allowed'\)/);
  assert.match(service, /setInterval\(validateCurrentPortal, 60_000\)/);
});
