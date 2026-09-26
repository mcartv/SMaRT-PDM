'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

test('message history defaults to 30 and enforces a 50 row hard maximum', () => {
  const service = read('services/messageHistoryService.js');
  assert.match(service, /const DEFAULT_BATCH_SIZE = 30/);
  assert.match(service, /const MAX_BATCH_SIZE = 50/);
  assert.match(service, /Math\.min\(parsed, MAX_BATCH_SIZE\)/);
});

test('cursor history is newest-first in SQL and chronological in the UI payload', () => {
  const service = read('services/messageHistoryService.js');
  assert.match(service, /ORDER BY m\.sent_at DESC, m\.message_id DESC/);
  assert.match(service, /\[\.\.\.descendingPage\]\.reverse\(\)/);
  assert.match(service, /sentAt: row\.sent_at, messageId: row\.message_id/);
});

test('legacy endpoints remain backward compatible unless view=window is requested', () => {
  const controller = read('controllers/messageHistoryController.js');
  assert.match(controller, /view \|\| ''/);
  assert.match(controller, /=== 'window'/);
  assert.match(controller, /messageController\.getConversationMessages\(req, res\)/);
  assert.match(controller, /messageController\.getRoomMessages\(req, res\)/);
});

test('window room history is decoupled from member profile loading', () => {
  const controller = read('controllers/messageHistoryController.js');
  assert.doesNotMatch(controller, /fetchRoomMembers/);
  const service = read('services/messageHistoryService.js');
  assert.match(service, /SELECT 1[\s\S]*FROM chat_room_members/);
});

test('message routes keep existing route shapes while adding the history wrapper', () => {
  const routes = read('routes/messageRoutes.js');
  assert.match(routes, /messageHistoryController\.getConversationMessages/);
  assert.match(routes, /messageHistoryController\.getRoomMessages/);
  assert.match(routes, /router\.post\('\/rooms\/:roomId\/messages', messageController\.sendRoomMessage\)/);
  assert.match(routes, /router\.get\('\/rooms\/:roomId\/members', messageController\.getRoomMembers\)/);
});
