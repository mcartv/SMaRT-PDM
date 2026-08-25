const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Admin bell shows the exact unread count instead of a dot', () => {
  const source = read('../frontend/src/components/layout/AdminLayout.jsx');
  assert.equal(source.includes("{unreadCount > 99 ? '99+' : unreadCount}"), true);
  assert.doesNotMatch(source, /right-0\.5 top-0\.5 h-3 w-3 rounded-full border-2 border-white bg-red-500/);
});

test('Admin notifications support per-item mark as read and unread', () => {
  const layout = read('../frontend/src/components/layout/AdminLayout.jsx');
  const hook = read('../frontend/src/hooks/usePortalNotifications.js');
  const routes = read('routes/notificationRoutes.js');
  const controller = read('controllers/notificationController.js');
  const service = read('services/notificationService.js');

  assert.match(layout, /Mark as unread/);
  assert.match(layout, /Mark as read/);
  assert.match(hook, /const markAsUnread = useCallback/);
  assert.match(hook, /notifications\/\$\{notificationId\}\/unread/);
  assert.match(routes, /\/:notificationId\/unread/);
  assert.match(controller, /MARK_NOTIFICATION_UNREAD/);
  assert.match(service, /update\(\{ is_read: false, read_at: null \}\)/);
});

test('Readiness attention is tracked per opening and clears when that opening is viewed', () => {
  const source = read('../frontend/src/pages/ApplicationReview.jsx');
  assert.match(source, /READINESS_SEEN_STORAGE_PREFIX/);
  assert.match(source, /readinessAttentionSignatures/);
  assert.match(source, /unseenReadinessOpeningIds/);
  assert.match(source, /onOpeningViewed\(itemId\)/);
  assert.match(source, /onOpeningViewed\(opening\.opening_id\)/);
  assert.match(source, /hasNeedsAttention = unseenReadinessOpeningIds\.size > 0/);
  assert.doesNotMatch(source, /hasNeedsAttention = readinessRows\.length > 0/);
});

test('Readiness seen state is scoped to the signed-in Admin account', () => {
  const source = read('../frontend/src/pages/ApplicationReview.jsx');
  assert.match(source, /sessionStorage\.getItem\('adminProfile'\)/);
  assert.match(source, /smart-pdm:admin:readiness-seen:v1/);
});
