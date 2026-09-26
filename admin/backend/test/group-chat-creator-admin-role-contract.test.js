'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..', '..');

function readBackend(relativePath) {
  return fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('group admin role actions are intercepted without changing normal member actions', () => {
  const routes = readBackend('routes/messageRoutes.js');

  assert.match(routes, /roomAdminController\.manageRoomAdminRole/);
  assert.match(
    routes,
    /router\.post\([\s\S]*'\/rooms\/:roomId\/members'[\s\S]*roomAdminController\.manageRoomAdminRole[\s\S]*messageController\.addRoomMembers/
  );
});

test('only the original group creator can promote or demote admins', () => {
  const service = readBackend('services/roomAdminService.js');

  assert.match(service, /cr\.created_by/);
  assert.match(service, /Only the group creator can promote or demote group admins/);
  assert.match(service, /GROUP_CREATOR_REQUIRED/);
  assert.match(service, /The group creator cannot be demoted/);
});

test('promotion and demotion persist system messages in the normal message history', () => {
  const service = readBackend('services/roomAdminService.js');

  assert.match(service, /subject,[\s\S]*message_body/);
  assert.match(service, /'system'/);
  assert.match(service, /made \$\{memberName\} a group admin/);
  assert.match(service, /removed \$\{memberName\} as a group admin/);
});

test('role changes emit dedicated realtime refresh events', () => {
  const controller = readBackend('controllers/roomAdminController.js');

  assert.match(controller, /room:member-promoted/);
  assert.match(controller, /room:member-demoted/);
  assert.match(controller, /relayMessageEvent/);
});

test('admin messaging UI exposes creator-only promote and demote controls', () => {
  const frontend = readRepo('admin/frontend/src/pages/AdminMessages.jsx');

  assert.match(frontend, /createdBy:/);
  assert.match(frontend, /viewerIsCreator/);
  assert.match(frontend, /const canDemote/);
  assert.match(frontend, /action: 'demote_admin'/);
  assert.match(frontend, /room:member-demoted/);
  assert.match(frontend, /Remove group admin/);
});
