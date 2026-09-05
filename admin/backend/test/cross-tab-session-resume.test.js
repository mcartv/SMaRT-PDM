'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('cross-tab session resume uses BroadcastChannel request/response hydration', () => {
  const storage = read('frontend/src/utils/authStorage.js');
  const main = read('frontend/src/main.jsx');

  assert.match(storage, /BroadcastChannel/);
  assert.match(storage, /SESSION_REQUEST/);
  assert.match(storage, /SESSION_RESPONSE/);
  assert.match(storage, /export async function hydratePortalSessionFromPeerTabs/);
  assert.match(storage, /export function installPortalSessionSync/);
  assert.match(storage, /SESSION_ESTABLISHED/);
  assert.match(storage, /broadcastPortalSessionEstablished/);
  assert.match(storage, /writePortalSessionToTab/);

  assert.match(main, /hydratePortalSessionFromPeerTabs/);
  assert.match(main, /getPortalNameFromPath\(window\.location\.pathname\)/);
  assert.match(main, /installPortalSessionSync\(\)/);
});

test('logout broadcasts session clearing so peer tabs clear the same user session', () => {
  const storage = read('frontend/src/utils/authStorage.js');
  const authService = read('frontend/src/services/authService.js');
  const departmentLayout = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');
  const sdoLayout = read('frontend/src/components/layout/SDOLayout.jsx');

  assert.match(storage, /SESSION_CLEARED/);
  assert.match(storage, /export function broadcastPortalSessionCleared/);
  assert.match(storage, /clearPortalSession\(payload\.portalName\)/);
  assert.match(authService, /broadcastPortalSessionCleared\(active\.portalName\)/);
  assert.match(departmentLayout, /await authService\.logout\(\)/);
  assert.match(sdoLayout, /await authService\.logout\(\)/);
});
