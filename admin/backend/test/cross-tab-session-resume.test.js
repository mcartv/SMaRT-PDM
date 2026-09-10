'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('cross-tab session resume uses one transport with request/response hydration', () => {
  const storage = read('frontend/src/utils/authStorage.js');
  const main = read('frontend/src/main.jsx');

  assert.match(storage, /BroadcastChannel/);
  assert.match(storage, /PORTAL_SESSION_STORAGE_EVENT_KEY/);
  assert.match(storage, /addEventListener\('storage'/);
  assert.match(storage, /SESSION_REQUEST/);
  assert.match(storage, /SESSION_RESPONSE/);
  assert.match(storage, /export async function hydratePortalSessionFromPeerTabs/);
  assert.match(storage, /export function installPortalSessionSync/);
  assert.match(storage, /SESSION_ESTABLISHED/);
  assert.match(storage, /broadcastPortalSessionEstablished/);
  assert.match(storage, /writePortalSessionToTab/);
  assert.match(storage, /getTabPortalSession/);
  assert.match(storage, /if \(!sentViaChannel\)/);
  assert.match(storage, /processedSyncEventIds/);

  assert.match(main, /hydratePortalSessionFromPeerTabs/);
  assert.match(main, /const portalName = getPortalNameFromPath\(pathname\)/);
  assert.match(main, /if \(portalName \|\| pathname === '\/login'\)/);
  assert.match(main, /installPortalSessionSync\(\)/);
});

test('logout and invalidation target the exact shared session, not the portal generally', () => {
  const storage = read('frontend/src/utils/authStorage.js');
  const authService = read('frontend/src/services/authService.js');
  const protectedRoute = read('frontend/src/components/auth/ProtectedRoute.jsx');
  const socket = read('frontend/src/hooks/useSocket.js');

  assert.match(storage, /SESSION_CLEARED/);
  assert.match(storage, /browserSessionId/);
  assert.match(storage, /expectedToken/);
  assert.match(storage, /stale-token/);
  assert.match(storage, /if \(payload\.token && active\.token !== payload\.token\) return/);
  assert.match(storage, /broadcastPortalSessionCleared\(resolvedPortalName, active\)/);

  assert.match(authService, /broadcastPortalSessionCleared\(active\.portalName, active\)/);
  assert.match(authService, /expectedToken: active\.token/);
  assert.match(authService, /const replacement = getStoredPortalSession\(active\.portalName\)/);
  assert.match(authService, /if \(cleared && !replacement\?\.token\)/);
  assert.match(authService, /Another tab established a newer session/);

  assert.match(protectedRoute, /getStoredItem\(storageKey\) !== token/);
  assert.match(protectedRoute, /expectedToken: token/);
  assert.match(protectedRoute, /validatedTokenRef/);

  assert.match(socket, /socketToken !== currentToken/);
  assert.match(socket, /stale-socket-token/);
  assert.match(socket, /expectedToken: accountWide \? '' : socketToken \|\| currentToken/);
});

test('cross-tab login does not forcibly navigate unrelated public pages', () => {
  const storage = read('frontend/src/utils/authStorage.js');

  assert.match(storage, /if \(!currentPortal\)/);
  assert.match(storage, /if \(currentPath === '\/login'\)/);
  assert.match(storage, /window\.location\.replace\(session\.redirectPath\)/);
});
