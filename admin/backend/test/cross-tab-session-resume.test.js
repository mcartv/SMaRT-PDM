'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('current cross-tab session resume uses BroadcastChannel request/response hydration', () => {
  const source = read('frontend/src/utils/authStorage.js');

  assert.match(source, /BroadcastChannel/);
  assert.match(source, /SESSION_REQUEST/);
  assert.match(source, /SESSION_RESPONSE/);
  assert.match(source, /hydratePortalSessionFromPeerTabs/);
  assert.match(source, /installPortalSessionSync/);
});

test('portal session clearing uses the current direct clear/invalidation flow', () => {
  const source = read('frontend/src/utils/authStorage.js');

  assert.match(source, /clearPortalSession/);
  assert.match(source, /invalidateStoredPortalSession/);
  assert.doesNotMatch(source, /broadcastPortalSessionCleared/);
});
