'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('current auth storage invalidates a portal session locally and redirects to the unified login', () => {
  const source = read('frontend/src/utils/authStorage.js');

  assert.match(source, /export function clearPortalSession/);
  assert.match(source, /export function invalidateStoredPortalSession/);
  assert.match(source, /redirectPortalToLogin/);
  assert.match(source, /portal-session:invalidated/);
  assert.match(source, /window\.location\.replace\('\/login'\)/);
});

test('cross-tab clearing is available alongside direct local invalidation', () => {
  const source = read('frontend/src/utils/authStorage.js');

  assert.match(source, /export function broadcastPortalSessionCleared/);
  assert.match(source, /SESSION_CLEARED/);
});
