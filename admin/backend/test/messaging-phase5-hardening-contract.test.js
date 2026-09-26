'use strict';
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const adminUi = () => fs.readFileSync(path.resolve(root, '../frontend/src/pages/AdminMessages.jsx'), 'utf8');

test('member removal writes the actor-named system message before deleting membership', () => {
  const source = read('controllers/groupRemovalController.js');
  const insertAt = source.indexOf("INSERT INTO messages");
  const deleteAt = source.indexOf("DELETE FROM chat_room_members");
  assert.ok(insertAt >= 0 && deleteAt > insertAt, 'system message must be stored before membership deletion/cutoff');
  assert.match(source, /removed \$\{targetName\} from the group/);
  assert.match(source, /subject, message_body/);
  assert.match(source, /'system'/);
});

test('all removal route shapes use the audited removal controller', () => {
  const routes = read('routes/messageRoutes.js');
  assert.match(routes, /groupRemovalController\.removeMember, messageController\.addRoomMembers/);
  assert.match(routes, /members\/:memberId', groupRemovalController\.removeMember/);
});

test('removed member cutoff is backend-enforced and includes the final removal activity', () => {
  const sql = read('sql/20260926_preserve_removed_group_history.sql');
  const former = read('controllers/formerRoomHistoryController.js');
  assert.match(sql, /BEFORE DELETE ON public\.chat_room_members/);
  assert.match(former, /m\.sent_at <= \$3/);
  assert.match(former, /m\.sent_at <= mta\.archived_at/);
});

test('web shows removal activity distinctly and former history stays read-only', () => {
  const ui = adminUi();
  assert.match(ui, /removed\\b.*from the group/);
  assert.match(ui, /UserMinus/);
  assert.match(ui, /Read-only history/);
  assert.match(ui, /newer messages and member updates are not available/i);
});

test('phase 5 keeps existing realtime dedupe and stable optimistic keys', () => {
  const ui = adminUi();
  assert.match(ui, /processedRealtimeMessageIdsRef/);
  assert.match(ui, /clientMessageId/);
  assert.match(ui, /scheduleRealtimeListSync/);
});
