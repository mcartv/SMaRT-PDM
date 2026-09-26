'use strict';
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const mobile = (rel) => fs.readFileSync(path.resolve(root, '../frontend', rel), 'utf8');

test('mobile removal endpoint persists who removed whom before cutoff', () => {
  const source = read('src/controllers/groupRemovalController.js');
  const insertAt = source.indexOf('INSERT INTO messages');
  const deleteAt = source.indexOf('DELETE FROM chat_room_members');
  assert.ok(insertAt >= 0 && deleteAt > insertAt);
  assert.match(source, /removed \$\{targetName\} from the group/);
  assert.match(source, /removedByName/);
  assert.match(source, /removalMessageId/);
});

test('mobile remove routes are intercepted without changing add and leave behavior', () => {
  const routes = read('src/routes/messageRoutes.js');
  assert.match(routes, /groupRemovalController\.removeMember, messageController\.addRoomMembers/);
  assert.match(routes, /members\/:memberId', protect, groupRemovalController\.removeMember/);
  assert.match(routes, /rooms\/:roomId\/leave/);
});

test('former group API refuses post-cutoff messages', () => {
  const former = read('src/controllers/formerRoomHistoryController.js');
  assert.match(former, /m\.sent_at <= \$3/);
  assert.match(former, /readOnly: true/);
  assert.match(former, /formerMember: true/);
});

test('mobile UI marks former groups as removed/read-only and removes active controls', () => {
  const list = mobile('lib/features/messaging/presentation/screens/chat_list_screen.dart');
  const screen = mobile('lib/features/messaging/presentation/screens/messaging_screen.dart');
  assert.match(list, /REMOVED · READ ONLY/);
  assert.match(list, /Previous group · read-only history/);
  assert.match(screen, /You are no longer in this group/);
  assert.match(screen, /person_remove_alt_1_rounded/);
  assert.match(screen, /removal notice above shows who removed you/i);
});

test('provider keeps realtime post-removal messages outside former history', () => {
  const provider = mobile('lib/features/messaging/presentation/providers/messaging_provider.dart');
  assert.match(provider, /if \(cutoff == null \|\| message\.sentAt\.isAfter\(cutoff\)\) return;/);
  assert.match(provider, /isActiveGroupReadOnly/);
  assert.match(provider, /_rememberRealtimeMessage/);
});
