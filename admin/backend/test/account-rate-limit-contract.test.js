'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('profile and account mutations use scoped authenticated rate limits', () => {
  const routes = read('backend/routes/accountRoutes.js');
  const limiters = read('backend/middleware/accountRateLimiters.js');

  assert.match(routes, /router\.patch\('\/me',[\s\S]*profileEditLimiter[\s\S]*updateCurrentStaffProfile/);
  assert.equal((routes.match(/passwordActionLimiter/g) || []).length >= 4, true);
  assert.equal((routes.match(/profilePhotoLimiter/g) || []).length >= 3, true);
  assert.equal((routes.match(/adminAccountMutationLimiter/g) || []).length >= 6, true);

  assert.match(limiters, /const profileEditLimiter[\s\S]*max: 20/);
  assert.match(limiters, /const passwordActionLimiter[\s\S]*max: 5/);
  assert.match(limiters, /const profilePhotoLimiter[\s\S]*max: 10/);
  assert.match(limiters, /const adminAccountMutationLimiter[\s\S]*max: 30/);
  assert.match(limiters, /keyGenerator: authenticatedUserKey/);
  assert.match(limiters, /code: 'ACCOUNT_RATE_LIMITED'/);
});
