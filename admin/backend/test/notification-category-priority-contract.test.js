'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('notification filters preserve chronological ordering and major classification', () => {
  const hook = read('admin/frontend/src/hooks/usePortalNotifications.js');
  assert.match(hook, /value:\s*'need_review',\s*label:\s*'Review'/);
  assert.match(hook, /unreadOnly/);
  assert.match(hook, /matchesReadState/);
  assert.match(hook, /value:\s*'major'/);
  assert.match(hook, /NOTIFICATION_TYPE_OPTIONS/);
  assert.match(hook, /matchesStatus/);
  assert.match(hook, /matchesType/);
  assert.match(hook, /return bTime - aTime/);
  assert.match(hook, /majorNotifications/);
  assert.match(hook, /loadMore/);
});

test('staff layouts expose filters and show major notifications inline', () => {
  for (const p of [
    'admin/frontend/src/components/layout/AdminLayout.jsx',
    'admin/frontend/src/components/layout/SDOLayout.jsx',
    'admin/frontend/src/components/layout/DepartmentPortalLayout.jsx',
  ]) {
    const src = read(p);
    assert.match(src, /notificationStatusOptions\.map/);
    assert.match(src, /notificationTypeOptions\.map/);
    assert.match(src, /Filter notifications by type/);
    assert.match(src, /Unread\{unreadCount/);
    assert.match(src, /setUnreadOnly/);
    assert.match(src, /option\.value === 'major'/);
    assert.match(src, /filteredNotifications\.length/);
    assert.match(src, /priority === 'major'/);
    assert.match(src, />\s*Today\s*</);
    assert.match(src, /Load more/);
    assert.doesNotMatch(src, /majorNotifications\.map/);
  }
});

test('major offense emits Disqualification Notice to relevant staff', () => {
  const src = read('admin/backend/services/endorsementSlipService.js');
  assert.match(src, /SMART_PDM_MAJOR_DISQUALIFICATION_NOTIFICATION_V1/);
  assert.match(src, /roles:\s*\['admin', 'sdo', 'guidance', 'pd'\]/);
  assert.match(src, /type:\s*'Disqualification Notice'/);
  assert.match(src, /excludeUserIds/);
});
