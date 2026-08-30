'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('personal portal themes are isolated by account in persistence, cache, and socket delivery', () => {
  const service = read('backend/services/themeSettingService.js');
  const hook = read('frontend/src/hooks/usePortalTheme.js');
  const controller = read('backend/controllers/themeSettingController.js');

  assert.match(service, /\.eq\('user_id',\s*actorUserId\)[\s\S]*\.eq\('portal_key',\s*normalizedPortal\)/);
  assert.match(service, /onConflict:\s*'user_id,portal_key'/);
  assert.match(hook, /smartpdm-theme-\$\{portalKey\}-\$\{userId/);
  assert.match(hook, /payload\?\.is_personal === true/);
  assert.match(hook, /!userId \|\| !payloadUserId \|\| payloadUserId !== userId/);
  assert.match(controller, /socketEvents\.emitToUser\(io, targetUserId, 'maintenance:updated', payload\)/);
});

test('only appropriate primary admin actions inherit the personal portal theme', () => {
  const themePanel = read('frontend/src/pages/maintenance/ThemePanel.jsx');
  const networkGate = read('frontend/src/components/system/NetworkGate.jsx');
  const registry = read('frontend/src/pages/maintenance/StudentRegistryPanel.jsx');
  const academicYear = read('frontend/src/pages/maintenance/AcademicYearPanel.jsx');
  const finalSelection = read('frontend/src/components/selection/FinalSelectionPanel.jsx');
  const applicationReview = read('frontend/src/pages/ApplicationReview.jsx');
  const endorsement = read('frontend/src/pages/EndorsementQueue.jsx');

  assert.match(themePanel, /bg-\[var\(--portal-base\)\][\s\S]*hover:bg-\[var\(--portal-active\)\]/);
  assert.doesNotMatch(themePanel, /Save Custom Theme[\s\S]{0,300}bg-stone-900/);
  assert.doesNotMatch(networkGate, /#4b2a1a|#5c3522/i);
  assert.match(networkGate, /bg-\[var\(--portal-base\)\]/);
  assert.match(registry, /onClick=\{onApply\}[\s\S]{0,180}bg-\[var\(--portal-base\)\]/);
  assert.match(academicYear, /bg-\[var\(--portal-base\)\] hover:bg-\[var\(--portal-active\)\]/);
  assert.match(finalSelection, /Finalize List[\s\S]{0,300}|bg-\[var\(--portal-base\)\]/);
  assert.match(applicationReview, /border-\[var\(--portal-base\)\] bg-\[var\(--portal-base\)\]/);

  // Semantic approval/success actions intentionally remain green instead of
  // being recolored by the user's decorative theme.
  assert.match(endorsement, /#059669/);
});

test('admin to mobile realtime relay tolerates transient backend wakeups and common environment aliases', () => {
  const relay = read('backend/services/studentRealtimeRelayService.js');
  const messages = read('backend/controllers/messageController.js');
  const renewals = read('backend/controllers/renewalController.js');

  assert.match(relay, /process\.env\.STUDENT_BACKEND_BASE_URL/);
  assert.match(relay, /process\.env\.MOBILE_BACKEND_URL/);
  assert.match(relay, /process\.env\.MOBILE_API_URL/);
  assert.match(relay, /RELAY_TIMEOUT_MS\s*=\s*15000/);
  assert.match(relay, /attempt <= 2/);
  assert.match(relay, /AbortController/);

  assert.match(messages, /function emitMessageCreated[\s\S]*relayToStudentBackend\('message:new'/);
  assert.match(messages, /function emitMessageRead[\s\S]*relayToStudentBackend\('message:read'/);
  assert.match(renewals, /function emitRenewalUpdated[\s\S]*relayRenewalEvent/);
});
