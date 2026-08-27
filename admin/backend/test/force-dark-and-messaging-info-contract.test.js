'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('force dark mode is stored per user beside personal portal themes', () => {
  const schema = read('backend/sql/portal_theme_settings_schema.sql');
  const service = read('backend/services/themeSettingService.js');
  const routes = read('backend/routes/themeSettingRoutes.js');

  assert.match(schema, /staff_portal_theme_settings[\s\S]*force_dark_mode boolean not null default false/);
  assert.match(service, /updateForceDarkMode[\s\S]*user_id:\s*actorUserId[\s\S]*portal_key:\s*normalizedPortal/);
  assert.match(routes, /:\s*portalKey\/force-dark|\/:portalKey\/force-dark/);
});

test('web dark mode uses a native palette without globally inverting the page', () => {
  const css = read('frontend/src/index.css');

  assert.match(css, /:root\s*{[\s\S]*--bg-primary:\s*#f6f7f8[\s\S]*--text-main:\s*#202428/);
  assert.match(css, /\.dark-mode\s*{[\s\S]*--bg-primary:\s*#18191a[\s\S]*--bg-elevated:\s*#2d2e30[\s\S]*--text-main:\s*#e4e6eb/);
  assert.match(css, /html\.smartpdm-force-dark[\s\S]*color-scheme:\s*dark/);
  assert.match(css, /--portal-surface:\s*var\(--bg-secondary\)/);
  assert.match(css, /html\.smartpdm-force-dark \.bg-white/);
  assert.doesNotMatch(css, /filter:\s*invert\(1\) hue-rotate\(180deg\)/);
});

test('messaging group info remains beside the desktop conversation instead of replacing it', () => {
  const messages = read('frontend/src/pages/AdminMessages.jsx');

  assert.match(messages, /conversationWithInfoGridClass/);
  assert.match(messages, /lg:grid-cols-\[280px_minmax\(0,1fr\)_300px\]/);
  assert.match(messages, /groupInfoOpen \? 'hidden lg:flex'/);
  assert.match(messages, /aria-label="Group information"[\s\S]*lg:border-l/);
  assert.doesNotMatch(messages, />\s*Open messages\s*</);
});
