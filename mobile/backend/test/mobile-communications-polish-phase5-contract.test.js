const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(backendRoot, '..', 'frontend', 'lib');

function readFrontend(...parts) {
  return fs.readFileSync(path.join(frontendRoot, ...parts), 'utf8');
}

const chatList = readFrontend(
  'features',
  'messaging',
  'presentation',
  'screens',
  'chat_list_screen.dart'
);
const messaging = readFrontend(
  'features',
  'messaging',
  'presentation',
  'screens',
  'messaging_screen.dart'
);
const notifications = readFrontend(
  'features',
  'notifications',
  'presentation',
  'screens',
  'notifications_screen.dart'
);
const announcements = readFrontend(
  'features',
  'applicant',
  'presentation',
  'screens',
  'announcements_screen.dart'
);

function sectionBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('Phase 5 preserves communication workflows and realtime ownership', () => {
  assert.match(messaging, /_sendMessage/);
  assert.match(messaging, /_sendQuickLike/);
  assert.match(messaging, /_loadOlderMessages/);
  assert.match(chatList, /archivePrivateThread/);
  assert.match(chatList, /restoreArchivedThread/);
  assert.match(notifications, /markAsRead/);
  assert.match(notifications, /markAllAsRead/);
  assert.match(announcements, /markViewed/);
  assert.match(announcements, /announcementRevision/);
});

test('conversation cards keep read-only state below the full title', () => {
  assert.match(chatList, /SMART-PDM_MOBILE_MESSAGING_LIST_RESPONSIVE_PHASE5_V1/);
  const tile = sectionBetween(chatList, 'class _ConversationTile', 'class _ArchivedHint');
  const titleIndex = tile.indexOf('title,');
  const stateIndex = tile.indexOf("'REMOVED · READ ONLY'");
  assert.ok(titleIndex >= 0, 'conversation title is missing');
  assert.ok(stateIndex > titleIndex, 'read-only state should follow the title');
  assert.doesNotMatch(tile.slice(titleIndex, stateIndex), /TextOverflow\.ellipsis/);
  assert.match(tile, /PopupMenuButton<String>/);
});

test('message thread scales its header and bounds bubbles on wide screens', () => {
  assert.match(messaging, /SMART-PDM_MOBILE_MESSAGING_THREAD_RESPONSIVE_PHASE5_V1/);
  assert.match(messaging, /FittedBox\(/);
  assert.match(messaging, /fit: BoxFit\.scaleDown/);
  assert.match(messaging, /screenWidth > 680 \? 520 : screenWidth \* 0\.76/);
  assert.match(messaging, /message: canSend \? 'Send message' : 'Send a quick like'/);
  assert.match(messaging, /Icons\.thumb_up_rounded/);
  assert.match(messaging, /semanticLabel: 'Send a quick like'/);
});

test('notifications keep the compact app bar and reclaim card width', () => {
  assert.match(notifications, /SMART-PDM_MOBILE_NOTIFICATIONS_RESPONSIVE_PHASE5_V1/);
  assert.match(notifications, /tooltip: hasUnread\s*\? 'Mark all notifications as read'/);
  assert.match(notifications, /Icons\.done_all_rounded/);
  assert.doesNotMatch(notifications, /else\s+const SizedBox\(width: 40\)/);
  assert.match(notifications, /ListView\.separated\(/);
  assert.match(notifications, /scrollDirection: Axis\.horizontal/);
});

test('announcements avoid competing metadata and poll only as fallback', () => {
  assert.match(announcements, /SMART-PDM_MOBILE_ANNOUNCEMENTS_RESPONSIVE_PHASE5_V1/);
  assert.match(announcements, /MobileRealtimeService\.instance\.isRealtimeHealthy/);
  assert.match(announcements, /Timer\.periodic\(const Duration\(seconds: 12\)/);
  const card = sectionBetween(announcements, 'class _AnnouncementListCard', '\n}');
  assert.match(card, /Wrap\(/);
  assert.match(card, /WrapCrossAlignment\.center/);
  assert.match(announcements, /SelectableText\(/);
});
