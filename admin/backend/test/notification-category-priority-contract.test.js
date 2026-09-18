'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('notification categories and priority are wired', () => {
  const hook = read('admin/frontend/src/hooks/usePortalNotifications.js');
  assert.match(hook, /Need Review/);
  assert.match(hook, /Disqualification Notice/);
  assert.match(hook, /major:\s*30/);
  assert.match(hook, /majorNotifications/);
});

test('staff layouts expose filters and major section', () => {
  for (const p of [
    'admin/frontend/src/components/layout/AdminLayout.jsx',
    'admin/frontend/src/components/layout/SDOLayout.jsx',
    'admin/frontend/src/components/layout/DepartmentPortalLayout.jsx',
  ]) {
    const src = read(p);
    assert.match(src, /notificationCategories\.map/);
    assert.match(src, /Major Priority/);
    assert.match(src, /filteredNotifications\.length/);
  }
});

test('major offense emits Disqualification Notice to relevant staff', () => {
  const src = read('admin/backend/services/endorsementSlipService.js');
  assert.match(src, /SMART_PDM_MAJOR_DISQUALIFICATION_NOTIFICATION_V1/);
  assert.match(src, /roles:\s*\['admin', 'sdo', 'guidance', 'pd'\]/);
  assert.match(src, /type:\s*'Disqualification Notice'/);
  assert.match(src, /excludeUserIds/);
});
