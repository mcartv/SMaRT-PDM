'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('web startup hydrates an authenticated portal session from another tab before routing', () => {
  const main = read('frontend/src/main.jsx');
  const authStorage = read('frontend/src/utils/authStorage.js');

  assert.match(main, /hydrateRememberedSessions\(\)/);
  assert.match(main, /await hydratePortalSessionFromPeerTabs/);
  assert.match(main, /getPortalNameFromPath\(window\.location\.pathname\)/);
  assert.match(main, /installPortalSessionSync\(\)/);

  assert.match(authStorage, /new BroadcastChannel\(PORTAL_SESSION_CHANNEL\)/);
  assert.match(authStorage, /type: 'SESSION_REQUEST'/);
  assert.match(authStorage, /type: 'SESSION_RESPONSE'/);
  assert.match(authStorage, /writePortalSessionToTab/);
  assert.match(authStorage, /ACTIVE_PORTAL_HINT_KEY/);
});

test('root entry and every department login resume the matching stored session instead of asking for credentials again', () => {
  const app = read('frontend/src/App.jsx');
  const adminLogin = read('frontend/src/pages/AdminLogin.jsx');
  const departmentLogin = read('frontend/src/pages/DepartmentPortalLogin.jsx');

  assert.match(app, /const PortalEntryRedirect/);
  assert.match(app, /getStoredPortalSession\(\)/);
  assert.match(app, /activeSession\?\.redirectPath \|\| '\/landing'/);

  assert.match(adminLogin, /getStoredPortalSession\('admin'\)/);
  assert.match(adminLogin, /navigate\(existingSession\.redirectPath, \{ replace: true \}\)/);

  assert.match(departmentLogin, /getStoredPortalSession\(portalKey\)/);
  assert.match(departmentLogin, /navigate\(existingSession\.redirectPath \|\| redirectPath, \{ replace: true \}\)/);
  assert.match(departmentLogin, /savePortalSession\(/);
});

test('explicit logout clears the same portal in peer tabs', () => {
  const authStorage = read('frontend/src/utils/authStorage.js');
  const authService = read('frontend/src/services/authService.js');
  const layout = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');

  assert.match(authStorage, /type: 'SESSION_CLEARED'/);
  assert.match(authStorage, /broadcastPortalSessionCleared/);
  assert.match(authService, /broadcastPortalSessionCleared\(active\.portalName\)/);
  assert.match(layout, /broadcastPortalSessionCleared\(portalKey\)/);
  assert.match(layout, /clearPortalSession\(portalKey\)/);
});
