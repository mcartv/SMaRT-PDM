'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const list = read('mobile/frontend/lib/features/messaging/presentation/screens/chat_list_screen.dart');
const thread = read('mobile/frontend/lib/features/messaging/presentation/screens/messaging_screen.dart');
const provider = read('mobile/frontend/lib/features/messaging/presentation/providers/messaging_provider.dart');
const client = read('mobile/frontend/lib/features/messaging/data/services/message_service.dart');
const model = read('mobile/frontend/lib/shared/models/chat_message.dart');
const routes = read('mobile/backend/src/routes/messageRoutes.js');
const replyController = read('mobile/backend/src/controllers/messageReplyController.js');
const replyCompatibility = read('mobile/backend/src/services/messageReplyCompatibility.js');
const formerRoom = read('mobile/backend/src/controllers/formerRoomHistoryController.js');


test('message list keeps OSFA pinned while allowing other office conversations', () => {
  assert.match(list, /SMART-PDM_MOBILE_MESSAGING_REFACTOR_FINAL_V2/);
  assert.match(list, /title: const Text\('Messages'\)/);
  assert.match(list, /hintText: 'Search messages'/);
  assert.match(list, /label: 'All'/);
  assert.match(list, /label: 'Unread'/);
  assert.match(list, /label: 'Groups'/);
  assert.match(list, /SupportConversation/);
  assert.match(list, /conversation\.pinned/);
  assert.match(list, /Icons\.push_pin_rounded/);
  assert.match(list, /_openSupportThread/);
  assert.doesNotMatch(list, /Other Conversations/);
  assert.doesNotMatch(list, /Scholarship Group Chats/);
});


test('private conversation title and information are based on the selected office', () => {
  assert.match(client, /selectedSupportConversation/);
  assert.match(client, /fetchSupportConversations/);
  assert.match(thread, /MessageService\.selectedSupportConversation/);
  assert.match(thread, /contact\?\.department/);
  assert.match(thread, /contact\?\.position/);
  assert.match(thread, /contact\?\.email/);
  assert.doesNotMatch(thread, /Contact Info/);
  assert.doesNotMatch(thread, /'Online'/);
});


test('conversation keeps search collapsed by default and supported message actions', () => {
  assert.match(thread, /bool _chatSearchOpen = false/);
  assert.match(thread, /tooltip: 'Search this conversation'/);
  assert.match(thread, /_chatSearchOpen\s*\? _ChatSearchBar/);
  assert.match(thread, /Icons\.info_outline_rounded/);
  assert.match(thread, /title: const Text\('Reply'\)/);
  assert.match(thread, /title: const Text\('Copy text'\)/);
  assert.match(thread, /'Unsend'/);
  assert.doesNotMatch(thread, /Report message/);
});


test('mobile reply UI and API keep the web-compatible reply-to contract', () => {
  for (const field of [
    'replyToMessageId',
    'replyMessageBody',
    'replySenderId',
    'replySenderName',
  ]) {
    assert.match(model, new RegExp(field));
  }
  assert.match(thread, /ChatMessage\? _replyingTo/);
  assert.match(thread, /message\.isReply/);
  assert.match(provider, /sendMessage\(String text, \{ChatMessage\? replyTo\}\)/);
  assert.match(client, /\/api\/messages\/thread\/reply/);
  assert.match(client, /\/api\/messages\/rooms\/\$roomId\/reply/);
  assert.match(routes, /router\.post\('\/thread\/reply'/);
  assert.match(routes, /router\.post\('\/rooms\/:roomId\/reply'/);
  assert.match(replyController, /replyToMessageId/);
  assert.match(replyCompatibility, /reply_to_message_id/);
  assert.match(replyCompatibility, /replyMessageBody/);
  assert.match(formerRoom, /enrichReplyContexts/);
  assert.match(formerRoom, /items: replyAwareItems/);
});
