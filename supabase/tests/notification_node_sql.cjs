'use strict';

// Run after notification_creation_policy.sql on the disposable local cluster.
// Uses the actual Node SQL helper; never connects to configured Supabase.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { Client } = require('../../admin/backend/node_modules/pg');

async function main() {
  const client = new Client({
    host: '127.0.0.1', port: Number(process.env.SMART_PDM_NOTIFICATION_TEST_PORT || 55439),
    user: 'postgres', database: 'smart_pdm_notification_policy_test',
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../admin/backend/services/notificationService.js'), 'utf8'), {
      module, exports: module.exports, console, Date,
      require(name) {
        if (name === '../config/db') return client;
        // Deliberately stale ON cache: the database must enforce OFF itself.
        if (name === '../config/notificationPolicy') return { notificationsEnabled: async () => true };
        if (['../config/supabase', '../utils/staffRoles', './studentRealtimeRelayService'].includes(name)) return {};
        throw new Error(`Unexpected dependency: ${name}`);
      },
    });
    const request = {
      userId: '00000000-0000-0000-0000-000000000001', type: 'Test',
      title: 'Once', message: 'Test', referenceId: 'once', referenceType: 'policy-test',
    };
    const first = await module.exports.createUserNotificationOnce(request);
    assert.ok(first.notification_id);
    assert.equal(first.is_read, false);
    assert.equal(first.read_at, null);
    assert.equal(await module.exports.createUserNotificationOnce(request), null);
    await client.query('UPDATE general_settings SET notifications_enabled = false');
    assert.equal(await module.exports.createUserNotificationOnce({ ...request, referenceId: 'blocked' }), null);
    console.log('PASS: actual Node SQL helper inserts once, deduplicates, preserves read_at and handles database OFF despite stale Node ON');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
