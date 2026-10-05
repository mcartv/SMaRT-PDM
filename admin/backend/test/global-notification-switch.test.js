'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');

for (const backend of ['admin/backend', 'mobile/backend/src']) {
    const { createNotificationPolicy } = require(path.join(root, backend, 'config/notificationPolicy'));

    test(`${backend}: policy shares concurrent reads and caches off for a minute`, async () => {
        let clock = 100000;
        let reads = 0;
        let enabled = false;
        const policy = createNotificationPolicy({
            now: () => clock,
            load: async () => { reads += 1; return enabled; },
        });
        assert.deepEqual(await Promise.all([policy.notificationsEnabled(), policy.notificationsEnabled()]), [false, false]);
        clock += 59000;
        assert.equal(await policy.notificationsEnabled(), false);
        assert.equal(reads, 1);
        enabled = true;
        clock += 1000;
        assert.equal(await policy.notificationsEnabled(), true);
        assert.equal(reads, 2);
    });

    test(`${backend}: settings update wins over an older in-flight read`, async () => {
        let release;
        const policy = createNotificationPolicy({ load: () => new Promise((resolve) => { release = resolve; }) });
        const read = policy.notificationsEnabled();
        policy.setNotificationsEnabled(false);
        release(true);
        assert.equal(await read, false);
        assert.equal(policy.isNotificationDeliveryEnabled(), false);
        policy.setNotificationsEnabled(true);
        assert.equal(await policy.notificationsEnabled(), true);
    });

    test(`${backend}: failures retain off and back off without repeated logs`, async () => {
        let clock = 100000;
        let warnings = 0;
        const policy = createNotificationPolicy({
            now: () => clock,
            load: async () => { throw new Error('offline'); },
            warn: () => { warnings += 1; },
        });
        policy.setNotificationsEnabled(false);
        clock += 60000;
        assert.equal(await policy.notificationsEnabled(), false);
        assert.equal(await policy.notificationsEnabled(), false);
        assert.equal(warnings, 1);
    });

    test(`${backend}: a slow failed policy read gets a full cooldown after completion`, async () => {
        let clock = 100000;
        let reads = 0;
        let warnings = 0;
        const policy = createNotificationPolicy({
            now: () => clock,
            load: async () => { reads += 1; clock += 65000; throw new Error('offline'); },
            warn: () => { warnings += 1; },
        });
        policy.setNotificationsEnabled(false);
        clock += 60000;
        assert.equal(await policy.notificationsEnabled(), false);
        for (let tick = 0; tick < 12; tick += 1) {
            assert.equal(await policy.notificationsEnabled(), false);
            clock += 5000;
        }
        assert.equal(reads, 1);
        assert.equal(warnings, 1);
        assert.equal(await policy.notificationsEnabled(), false);
        assert.equal(reads, 2);
    });
}

function loadModule(relativePath, dependencies) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), {
        module, exports: module.exports, console, Date, process,
        require(name) {
            if (Object.hasOwn(dependencies, name)) return dependencies[name];
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    return module.exports;
}

for (const backend of ['admin/backend', 'mobile/backend/src']) {
    test(`${backend}: disabled creation avoids database, recipient and relay work`, async () => {
        const service = loadModule(`${backend}/services/notificationService.js`, {
            '../config/supabase': { from() { throw new Error('Unexpected database request'); } },
            '../config/db': { query() { throw new Error('Unexpected SQL request'); } },
            '../config/notificationPolicy': { notificationsEnabled: async () => false },
            '../utils/staffRoles': {},
            './studentRealtimeRelayService': {},
            './adminRealtimeRelayService': {},
            './pushNotificationService': {},
            crypto: require('node:crypto'),
        });
        assert.equal(await service.createUserNotification({ userId: 'user', type: 'General', title: 'Test', message: 'Test' }), null);
        assert.equal((await service.createStaffNotifications({ roles: ['admin'], title: 'Test', message: 'Test' })).length, 0);
        assert.equal((await service.getStaffTargets({ roles: ['admin'] })).length, 0);
        if (backend === 'admin/backend') {
            assert.equal((await service.createNotificationsForAudience({ audience: 'all', title: 'Test', message: 'Test' })).length, 0);
            assert.equal(await service.createUserNotificationOnce({ userId: 'user', type: 'General', title: 'Test', message: 'Test' }), null);
            await assert.rejects(service.syncAnnouncementNotifications({}), /required/);
        }
    });
}

test('push delivery stops before Firebase initialization or device-token lookup', async () => {
    const service = loadModule('mobile/backend/src/services/pushNotificationService.js', {
        '../config/supabase': { from() { throw new Error('Unexpected token query'); } },
        '../config/notificationPolicy': { notificationsEnabled: async () => false },
        'firebase-admin/app': { getApps() { throw new Error('Unexpected Firebase initialization'); } },
        'firebase-admin/messaging': {},
    });
    assert.equal((await service.sendUserNotificationPush({ userId: 'user' })).reason, 'notifications_disabled');
});

test('ON push delivery sends once per device and marks the existing card without resetting read state', async () => {
    const sent = [];
    const updates = [];
    const service = loadModule('mobile/backend/src/services/pushNotificationService.js', {
        '../config/notificationPolicy': { notificationsEnabled: async () => true },
        '../config/supabase': {
            from(table) {
                const builder = {
                    select() { return this; },
                    update(value) { updates.push({ table, value }); return this; },
                    async eq() {
                        return { data: table === 'user_device_tokens' ? [
                            { device_token: 'token', platform: 'android' },
                            { device_token: 'token', platform: 'android' },
                        ] : null, error: null };
                    },
                };
                return builder;
            },
        },
        'firebase-admin/app': { getApps: () => [{}] },
        'firebase-admin/messaging': { getMessaging: () => ({ async sendEach(messages) {
            sent.push(...messages);
            return { successCount: messages.length, failureCount: 0, responses: messages.map(() => ({ success: true })) };
        } }) },
    });
    const result = await service.sendUserNotificationPush({ userId: 'user', notification: { notification_id: 'n1', title: 'Test', message: 'Body', is_read: true } });
    assert.equal(result.sent, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].data.notificationId, 'n1');
    assert.equal(updates.length, 1);
    assert.equal(updates[0].table, 'notifications');
    assert.deepEqual(Object.keys(updates[0].value), ['push_sent']);
    assert.equal(updates[0].value.push_sent, true);
});

test('settings relay immediately updates the mobile policy and invalidates settings cache', () => {
    const handlers = new Map();
    const router = { post(route, ...callbacks) { handlers.set(route, callbacks.at(-1)); } };
    let enabled = true;
    let invalidations = 0;
    loadModule('mobile/backend/src/routes/internalRealtimeRoutes.js', {
        express: { Router: () => router },
        '../utils/internalRealtimeSecret': {},
        '../config/notificationPolicy': { setNotificationsEnabled(value) { enabled = value; } },
        '../config/appCache': { invalidateNamespaces() { invalidations += 1; } },
    });
    const io = { emit() {} };
    const res = { status() { return this; }, json(value) { return value; } };
    for (const value of [false, true]) {
        const result = handlers.get('/module-event')({
            app: { get: () => io },
            body: { event: 'settings:updated', payload: { source: 'general_settings', notifications_enabled: value } },
        }, res);
        assert.equal(result.success, true);
        assert.equal(enabled, value);
    }
    assert.equal(invalidations, 2);
});

test('general settings persist off, preserve it across other edits, and restrict changes to admins', async () => {
    let stored = { general_settings_id: 1, notifications_enabled: true };
    let runtimeEnabled = true;
    const builder = {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: stored, error: null }; },
        upsert(value) { stored = value; return this; },
        async single() { return { data: stored, error: null }; },
    };
    const service = loadModule('admin/backend/services/generalSettingService.js', {
        '../config/supabase': { from: () => builder },
        '../config/notificationPolicy': { setNotificationsEnabled(value) { runtimeEnabled = value; } },
    });
    const admin = { role: 'admin', user_id: 'admin' };
    assert.equal((await service.updateGeneralSettings({ notifications_enabled: false }, admin)).notifications_enabled, false);
    assert.equal(runtimeEnabled, false);
    assert.equal((await service.updateGeneralSettings({ office_name: 'New office' }, admin)).notifications_enabled, false);
    await assert.rejects(service.updateGeneralSettings({ notifications_enabled: 'false' }, admin), /must be a boolean/);
    await assert.rejects(service.updateGeneralSettings({ notifications_enabled: true }, { role: 'staff' }), /Access denied/);
    assert.equal((await service.updateGeneralSettings({ notifications_enabled: true }, admin)).notifications_enabled, true);
    assert.equal(runtimeEnabled, true);
});
