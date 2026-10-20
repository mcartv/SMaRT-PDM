'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('heartbeat locks the session before the page and retries only PostgreSQL deadlocks', () => {
  const service = read('backend/services/adminSessionService.js');
  const heartbeat = service.slice(
    service.indexOf('async function heartbeatAdminSession'),
    service.indexOf('// releaseAdminPage')
  );

  assert.ok(heartbeat.indexOf('UPDATE admin_sessions') < heartbeat.indexOf('INSERT INTO admin_session_pages'));
  assert.match(heartbeat, /ON CONFLICT \(session_id, page_id\)/);
  assert.match(heartbeat, /error\?\.code === '40P01'/);
  assert.match(heartbeat, /attempt < HEARTBEAT_DEADLOCK_RETRY_LIMIT/);
  assert.doesNotMatch(heartbeat, /error\?\.code === '23505'/);
});
