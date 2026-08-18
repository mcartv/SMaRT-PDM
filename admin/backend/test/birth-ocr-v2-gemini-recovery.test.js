'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('current auth storage invalidates a portal session locally and redirects to login', () => {
  const source = read('frontend/src/utils/authStorage.js');

  assert.match(source, /export function clearPortalSession/);
  assert.match(source, /export function invalidateStoredPortalSession/);
  assert.match(source, /redirectPortalToLogin/);
  assert.match(source, /portal-session:invalidated/);
});

test('session invalidation is no longer coupled to the removed broadcastPortalSessionCleared helper', () => {
  const source = read('frontend/src/utils/authStorage.js');

  assert.doesNotMatch(source, /broadcastPortalSessionCleared/);
});
