const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('former group history is cutoff-limited and read-only', () => {
  const controller = read('src/controllers/formerRoomHistoryController.js');
  assert.match(controller, /m\.sent_at <= \$3/);
  assert.match(controller, /readOnly: true/);
  assert.match(controller, /formerMember: true/);
  assert.match(controller, /NOT EXISTS[\s\S]*chat_room_members/);
});

test('mobile routes expose former room list and history window', () => {
  const routes = read('src/routes/messageRoutes.js');
  assert.match(routes, /\/former-rooms'/);
  assert.match(routes, /\/former-rooms\/:roomId\/window/);
});

test('mobile UI blocks sending and displays a read-only state', () => {
  const provider = read('../frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  const screen = read('../frontend/lib/features/messaging/presentation/screens/messaging_screen.dart');
  assert.match(provider, /isActiveGroupReadOnly/);
  assert.match(provider, /no longer a member/);
  assert.match(screen, /You are no longer in this group/);
  assert.match(screen, /New messages, member changes, and replies are not available/);
});

test('former room stays discoverable but removes active-only controls', () => {
  const service = read('../frontend/lib/features/messaging/data/services/message_service.dart');
  const provider = read('../frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
  const list = read('../frontend/lib/features/messaging/presentation/screens/chat_list_screen.dart');
  assert.match(service, /\/api\/messages\/former-rooms/);
  assert.match(service, /Read-only history/);
  assert.match(provider, /if \(!_rooms\.any\(\(room\) => room\.roomId == normalizedRoomId\)\)/);
  assert.match(list, /READ ONLY/);
  assert.match(list, /onArchive: room\.readOnly \? null/);
});
