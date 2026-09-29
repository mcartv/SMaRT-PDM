'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const historyService = read('mobile/backend/src/services/messageHistoryService.js');
const historyController = read('mobile/backend/src/controllers/messageHistoryController.js');
const list = read('mobile/frontend/lib/features/messaging/presentation/screens/chat_list_screen.dart');
const thread = read('mobile/frontend/lib/features/messaging/presentation/screens/messaging_screen.dart');

test('opening a private office thread synchronizes canonical per-user read state', () => {
  assert.match(historyService, /async function syncPrivateReadState/);
  assert.match(historyService, /INSERT INTO message_read_states/);
  assert.match(historyService, /ON CONFLICT \(message_id, user_id\)/);
  assert.match(historyService, /is_read = true/);
  assert.match(historyController, /syncPrivateReadState/);
  assert.match(historyController, /new Set\(\[/);
});

test('message list refreshes unread state as soon as a conversation closes', () => {
  assert.match(list, /Future<void> _openSupportThread/);
  assert.match(list, /await AppNavigator\.pushDetail/);
  assert.match(list, /refreshUnreadCount/);
  assert.match(list, /_refreshSupportConversations/);
});

test('message list follows the approved compact visual hierarchy', () => {
  assert.match(list, /SMART-PDM_MOBILE_MESSAGING_REFACTOR_FINAL_V3/);
  assert.match(list, /label: 'All'/);
  assert.match(list, /label: 'Unread'/);
  assert.match(list, /label: 'Groups'/);
  assert.match(list, /Icons\.push_pin_rounded/);
  assert.match(list, /AppColors\.teal/);
  assert.match(list, /AppColors\.magenta/);
  assert.match(list, /AppColors\.orange/);
  assert.doesNotMatch(list, /Other Conversations/);
});

test('conversation keeps search collapsed, removes online status, and uses compact date pills', () => {
  assert.match(thread, /bool _chatSearchOpen = false/);
  assert.match(thread, /tooltip: 'Search this conversation'/);
  assert.match(thread, /_chatSearchOpen\s*\? _ChatSearchBar/);
  assert.match(thread, /class _DateDivider/);
  assert.doesNotMatch(thread, /'Online'/);
  assert.doesNotMatch(thread, /Contact Info/);
  assert.match(thread, /hintText: 'Type a message\.\.\.'/);
});


test('message timeline groups bubbles and only separates meaningful time gaps', () => {
  assert.match(thread, /difference\(older\.sentAt\)\.inMinutes <= 5/);
  assert.match(thread, /bool _shouldShowTimeDivider/);
  assert.match(thread, /const Duration\(hours: 1\)/);
  assert.match(thread, /class _TimeDivider/);
  assert.doesNotMatch(thread, /showTimestamp/);
  assert.match(thread, /Delivered · \$timeLabel/);
  assert.match(thread, /older\.subject\?\.toLowerCase\(\) == 'system'/);
  assert.match(thread, /newer\.subject\?\.toLowerCase\(\) == 'system'/);
});

test('group activity is plain centered timeline text without a capsule', () => {
  const bubbleStart = thread.indexOf('class _MessageBubble');
  assert.notEqual(bubbleStart, -1);
  const start = thread.indexOf("if (message.subject?.toLowerCase() == 'system')", bubbleStart);
  assert.notEqual(start, -1);
  const end = thread.indexOf('final isDark', start);
  assert.notEqual(end, -1);
  const systemActivity = thread.slice(start, end);
  assert.match(systemActivity, /Center\(/);
  assert.match(systemActivity, /Text\(\s*message\.messageBody/);
  assert.doesNotMatch(systemActivity, /Container\(/);
  assert.doesNotMatch(systemActivity, /Border\.all/);
  assert.doesNotMatch(systemActivity, /Icons\.info_outline_rounded/);
  assert.doesNotMatch(systemActivity, /person_remove_alt/);
});
