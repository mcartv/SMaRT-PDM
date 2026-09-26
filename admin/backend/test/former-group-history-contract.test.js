const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('membership deletion preserves a personal group-history cutoff', () => {
  const sql = read('sql/20260926_preserve_removed_group_history.sql');
  assert.match(sql, /BEFORE DELETE ON public\.chat_room_members/);
  assert.match(sql, /message_thread_archives/);
  assert.match(sql, /archived_at/);
});

test('former room endpoint never returns messages after the cutoff', () => {
  const controller = read('controllers/formerRoomHistoryController.js');
  assert.match(controller, /m\.sent_at <= \$3/);
  assert.match(controller, /formerMember: true/);
  assert.match(controller, /canRestore: false/);
});
