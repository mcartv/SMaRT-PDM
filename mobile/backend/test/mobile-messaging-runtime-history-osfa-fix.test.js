'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const routes = read('mobile/backend/src/routes/messageRoutes.js');
const historyController = read(
  'mobile/backend/src/controllers/messageHistoryController.js'
);
const historyService = read(
  'mobile/backend/src/services/messageHistoryService.js'
);
const replyController = read(
  'mobile/backend/src/controllers/messageReplyController.js'
);
const supportController = read(
  'mobile/backend/src/controllers/studentSupportConversationController.js'
);
const supportService = read(
  'mobile/backend/src/services/studentSupportConversationService.js'
);
const appRouter = read('mobile/frontend/lib/app/routes/app_router.dart');
const messageService = read(
  'mobile/frontend/lib/features/messaging/data/services/message_service.dart'
);
const messagingScreen = read(
  'mobile/frontend/lib/features/messaging/presentation/screens/messaging_screen.dart'
);
const notificationsScreen = read(
  'mobile/frontend/lib/features/notifications/presentation/screens/notifications_screen.dart'
);
const realtimeBanner = read(
  'mobile/frontend/lib/core/notifications/in_app_realtime_banner.dart'
);


test('active src router exposes the paginated message history endpoints', () => {
  assert.match(routes, /messageHistoryController/);
  assert.match(
    routes,
    /router\.get\('\/thread\/window', protect, messageHistoryController\.getPrivateWindow\)/
  );
  assert.match(
    routes,
    /router\.get\('\/rooms\/:roomId\/window', protect, messageHistoryController\.getRoomWindow\)/
  );
  assert.match(
    routes,
    /router\.get\('\/thread', protect, messageHistoryController\.getFixedThread\)/
  );
});


test('student private messaging supports separate authorized-office conversations', () => {
  assert.match(routes, /studentSupportConversationController/);
  assert.match(
    routes,
    /router\.get\('\/support-conversations', protect, studentSupportConversationController\.list\)/
  );
  assert.match(
    routes,
    /router\.patch\('\/support-conversations\/:counterpartyId\/archive'/
  );
  assert.match(supportService, /'sdo'/);
  assert.match(supportService, /'guidance'/);
  assert.match(supportService, /'pd'/);
  assert.match(supportService, /'ro_coordinator'/);
  assert.match(supportService, /Student Discipline Office/);
  assert.match(supportService, /Guidance and Counseling Office/);
  assert.match(supportService, /Program Director/);
  assert.match(supportService, /Return of Obligations Coordinator/);
  assert.match(supportService, /OSFA Administrator/);
  assert.match(supportController, /listSupportConversations/);
});


test('non-OSFA offices require an existing private thread before the student can reply', () => {
  assert.match(supportService, /hasPrivateThread/);
  assert.match(
    supportService,
    /You can reply only to an existing conversation with this office/
  );
  assert.match(historyService, /resolveStudentSupportCounterparty/);
  assert.match(historyController, /resolveSupportCounterpartyId/);
  assert.match(replyController, /resolveSupportCounterpartyId/);
});

test('private notification and realtime entry points preserve the exact office conversation', () => {
  assert.match(
    routes,
    /router\.get\('\/support-conversations\/resolve', protect, studentSupportConversationController\.resolve\)/
  );
  assert.match(supportService, /WHERE message_id = \$1::uuid/);
  assert.match(supportService, /sender_id = \$2::uuid OR receiver_id = \$2::uuid/);
  assert.match(supportController, /resolveSupportConversation/);
  assert.match(messageService, /support-conversations\/resolve/);
  assert.match(notificationsScreen, /'messageReferenceId': messageReferenceId/);
  assert.match(notificationsScreen, /AppRoutes\.messaging/);
  assert.match(realtimeBanner, /'counterpartyId': item\.counterpartyId/);
  assert.match(appRouter, /messageReferenceId: payload\['messageReferenceId'\]/);
  assert.match(appRouter, /counterpartyId: payload\['counterpartyId'\]/);
  assert.match(messagingScreen, /resolveSupportConversation/);
  assert.match(messagingScreen, /MessageService\.selectSupportConversation\(conversation\)/);
});


test('history batching stays bounded and keeps reply context', () => {
  assert.match(historyService, /const DEFAULT_BATCH_SIZE = 30/);
  assert.match(historyService, /const MAX_BATCH_SIZE = 50/);
  assert.match(historyService, /limit \+ 1/);
  assert.match(historyService, /nextBeforeSentAt/);
  assert.match(historyService, /nextBeforeMessageId/);
  assert.match(historyService, /enrichReplyContexts\(items\)/);
});


test('group messaging routes remain on their existing controllers', () => {
  assert.match(
    routes,
    /router\.post\('\/rooms\/:roomId\/send', protect, messageController\.sendRoomMessage\)/
  );
  assert.match(
    routes,
    /router\.patch\('\/rooms\/:roomId\/read', protect, messageController\.markRoomThreadRead\)/
  );
  assert.match(
    routes,
    /router\.delete\('\/rooms\/:roomId\/leave', protect, messageController\.leaveRoom\)/
  );
});
