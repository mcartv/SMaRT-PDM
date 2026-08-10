'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const accountService = fs.readFileSync(
    path.join(__dirname, '../services/accountService.js'),
    'utf8'
);
const authController = fs.readFileSync(
    path.join(__dirname, '../controllers/authController.js'),
    'utf8'
);
const authMiddleware = fs.readFileSync(
    path.join(__dirname, '../middleware/authMiddleware.js'),
    'utf8'
);
const adminSessionService = fs.readFileSync(
    path.join(__dirname, '../services/adminSessionService.js'),
    'utf8'
);
const accountController = fs.readFileSync(
    path.join(__dirname, '../controllers/accountController.js'),
    'utf8'
);
const server = fs.readFileSync(
    path.join(__dirname, '../server/server.js'),
    'utf8'
);
const socketHook = fs.readFileSync(
    path.join(__dirname, '../../frontend/src/hooks/useSocket.js'),
    'utf8'
);
const authStorage = fs.readFileSync(
    path.join(__dirname, '../../frontend/src/utils/authStorage.js'),
    'utf8'
);

test('role/archive/restore changes bump token_version and revoke managed Admin sessions', () => {
    assert.match(accountService, /token_version = COALESCE\(token_version, 1\) \+ 1/);
    assert.match(accountService, /roleChanged \|\| nextIsArchived !==/);
    assert.match(accountService, /revokeAllAdminSessionsForUser\(client, userId\)/);
    assert.match(accountService, /Restoring an account deliberately does not revive its old browser/);
});


test('new staff and Admin JWTs carry token_version and protected HTTP requests revalidate current account state', () => {
    assert.match(authController, /token_version: Number\(profile\.token_version \|\| 1\)/);
    assert.match(adminSessionService, /token_version: Number\(user\.token_version \|\| 1\)/);
    assert.match(authMiddleware, /assertCurrentStaffSession/);
    assert.match(authMiddleware, /StaffSessionError/);
});

test('Admin backend requires socket authentication before connection handler', () => {
    const middlewareIndex = server.indexOf('io.use(createStaffSocketAuthMiddleware())');
    const connectionIndex = server.indexOf("io.on('connection'");

    assert.ok(middlewareIndex >= 0, 'socket authentication middleware must be registered');
    assert.ok(connectionIndex > middlewareIndex, 'authentication middleware must run before connection handler');
    assert.doesNotMatch(server, /connected without userId in handshake/);
    assert.match(server, /function handleJoinPayload\(socket\)[\s\S]*joinSocketToUserRoom\(socket\)/);
});

test('account invalidation notifies and disconnects the affected user room', () => {
    assert.match(accountController, /timeout\(1500\)[\s\S]*emit\('session:invalidated'/);
    assert.match(accountController, /hardDisconnect/);
    assert.match(accountController, /disconnectSockets\(true\)/);
    assert.match(accountController, /account\.session_invalidated === true/);
    assert.match(socketHook, /typeof acknowledge === 'function'/);
    assert.match(socketHook, /received: true/);
});

test('public pages do not open unauthenticated staff sockets and auth failures clear stale sessions', () => {
    assert.match(socketHook, /if \(!token\)[\s\S]*return null;/);
    assert.match(socketHook, /SESSION_INVALID_CODES/);
    assert.match(socketHook, /invalidateStoredPortalSession/);
    assert.match(authStorage, /clearPortalSession\(resolvedPortalName\)/);
    assert.match(authStorage, /portal-session:invalidated/);
});
