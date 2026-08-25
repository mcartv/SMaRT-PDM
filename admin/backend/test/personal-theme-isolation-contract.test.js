'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('personal theme persistence is keyed by both user account and access area', () => {
  const service = read('backend/services/themeSettingService.js');

  assert.match(service, /PERSONAL_TABLE_NAME\s*=\s*'staff_portal_theme_settings'/);
  assert.match(service, /\.eq\('user_id',\s*actorUserId\)[\s\S]*\.eq\('portal_key',\s*normalizedPortal\)/);
  assert.match(service, /upsert\(personalPayload,\s*\{\s*onConflict:\s*'user_id,portal_key'\s*\}\)/);
  assert.match(service, /user_id:\s*actorUserId/);
});

test('browser theme cache is isolated by user id even for two accounts with the same role', () => {
  const hook = read('frontend/src/hooks/usePortalTheme.js');

  assert.match(hook, /smartpdm-theme-\$\{portalKey\}-\$\{userId/);
  assert.match(hook, /const userId = getUserIdFromToken\(token\)/);
  assert.match(hook, /storageKeyForPortal\(normalizedPortal,\s*userId\)/);
  assert.match(hook, /event\.detail\?\.user_id && userId && event\.detail\.user_id !== userId/);
  assert.match(hook, /payload\?\.is_personal && payload\?\.user_id && userId && payload\.user_id !== userId/);
});

test('fresh theme schema supports personal RO Coordinator themes', () => {
  const schema = read('backend/sql/portal_theme_settings_schema.sql');
  const migration = read('../supabase/migrations/20260729_add_ro_coordinator_workflow.sql');

  assert.match(schema, /staff_portal_theme_settings_portal_key_check[\s\S]*ro_coordinator/);
  assert.match(migration, /staff_portal_theme_settings_portal_key_check[\s\S]*ro_coordinator/);
});
