'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAnnouncementScheduleGate } = require('../services/announcementScheduleGate');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadServiceHarness({ now = Date.now, queryResult } = {}) {
    const reads = [];
    let nextScheduledAt = null;
    const supabase = {
        from(table) {
            const query = { table, filters: [] };
            const builder = {
                select(columns) { query.columns = columns; return builder; },
                eq(column, value) { query.filters.push([column, value]); return builder; },
                in(column, value) { query.filters.push([column, value]); return builder; },
                update() { query.update = true; return builder; },
                lte(column, value) { query.filters.push([column, value]); return builder; },
                order() { return builder; },
                limit() { return builder; },
                single() { return builder; },
                then(resolve) {
                    reads.push(query);
                    return Promise.resolve(queryResult?.(query) || {
                        data: query.columns === 'scheduled_at' && nextScheduledAt
                            ? [{ scheduled_at: nextScheduledAt }] : [],
                        error: null,
                    }).then(resolve);
                },
            };
            return builder;
        },
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/announcementService.js'), 'utf8'), {
        module,
        exports: module.exports,
        console,
        Date,
        require(name) {
            if (name === '../config/supabase') return supabase;
            if (name === './notificationService') return {};
            if (name === '../config/appCache') return { invalidateNamespaces() {} };
            if (name === './announcementScheduleGate') return {
                createAnnouncementScheduleGate: options => createAnnouncementScheduleGate({ ...options, now }),
            };
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    return { service: module.exports, reads, schedule(value) { nextScheduledAt = value; } };
}

test('announcement service skips due queries while idle and rechecks after a change', async () => {
    const harness = loadServiceHarness();
    await harness.service.publishDueAnnouncements();
    await harness.service.publishDueAnnouncements();
    assert.equal(harness.reads.length, 1);
    assert.equal(harness.reads[0].columns, 'scheduled_at');
    assert.deepEqual(harness.reads[0].filters, [['status', 'Scheduled'], ['is_archived', false]]);

    harness.schedule(new Date(Date.now() - 5000).toISOString());
    harness.service.invalidateAnnouncementReads();
    await harness.service.publishDueAnnouncements();
    assert.equal(harness.reads.length, 3);
    assert.equal(harness.reads[2].columns, 'announcement_id');
    assert.ok(harness.reads[2].filters.some(([column]) => column === 'scheduled_at'));
});

test('idle five-second ticks perform only one database read per minute', async () => {
    let clock = 100000;
    let reads = 0;
    const gate = createAnnouncementScheduleGate({
        now: () => clock,
        loadNextScheduledAt: async () => { reads += 1; return null; },
    });
    for (let tick = 0; tick < 12; tick += 1) {
        assert.equal(await gate.isDue(), false);
        clock += 5000;
    }
    assert.equal(reads, 1);
    assert.equal(await gate.isDue(), false);
    assert.equal(reads, 2);
});

test('a known scheduled time becomes due without waiting for reconciliation', async () => {
    let clock = 100000;
    let reads = 0;
    const gate = createAnnouncementScheduleGate({
        now: () => clock,
        loadNextScheduledAt: async () => { reads += 1; return new Date(107000).toISOString(); },
    });
    assert.equal(await gate.isDue(), false);
    clock = 105000;
    assert.equal(await gate.isDue(), false);
    clock = 110000;
    assert.equal(await gate.isDue(), true);
    assert.equal(reads, 1);
});

test('changes invalidate an idle schedule and concurrent ticks share the read', async () => {
    let reads = 0;
    let scheduledAt = null;
    const gate = createAnnouncementScheduleGate({
        now: () => 100000,
        loadNextScheduledAt: async () => { reads += 1; return scheduledAt; },
    });
    assert.deepEqual(await Promise.all([gate.isDue(), gate.isDue()]), [false, false]);
    assert.equal(reads, 1);
    scheduledAt = new Date(90000).toISOString();
    gate.invalidate();
    assert.equal(await gate.isDue(), true);
    assert.equal(reads, 2);
});

test('a change during a database read is reconciled on the next tick', async () => {
    let release;
    let reads = 0;
    const gate = createAnnouncementScheduleGate({
        now: () => 100000,
        loadNextScheduledAt: () => {
            reads += 1;
            return reads === 1 ? new Promise((resolve) => { release = resolve; }) : null;
        },
    });
    const pending = gate.isDue();
    gate.invalidate();
    release(null);
    assert.equal(await pending, false);
    assert.equal(await gate.isDue(), false);
    assert.equal(reads, 2);
});

test('failed reconciliation backs off instead of logging an error every five seconds', async () => {
    let clock = 100000;
    let reads = 0;
    const gate = createAnnouncementScheduleGate({
        now: () => clock,
        loadNextScheduledAt: async () => { reads += 1; throw new Error('offline'); },
    });
    await assert.rejects(gate.isDue(), /offline/);
    clock += 5000;
    assert.equal(await gate.isDue(), false);
    assert.equal(reads, 1);
    clock += 55000;
    await assert.rejects(gate.isDue(), /offline/);
    assert.equal(reads, 2);
});

test('publication failures back off exponentially, survive invalidation, and reset after success', async () => {
    let clock = 100000;
    let reads = 0;
    const gate = createAnnouncementScheduleGate({
        now: () => clock,
        loadNextScheduledAt: async () => { reads += 1; return new Date(90000).toISOString(); },
    });
    assert.equal(await gate.isDue(), true);
    for (const delay of [30000, 60000, 120000, 240000, 300000, 300000]) {
        gate.publicationFailed();
        gate.invalidate();
        const readsBefore = reads;
        clock += delay - 1;
        assert.equal(await gate.isDue(), false);
        assert.equal(reads, readsBefore);
        clock += 1;
        assert.equal(await gate.isDue(), true);
    }
    gate.publicationSucceeded();
    gate.publicationFailed();
    clock += 29999;
    assert.equal(await gate.isDue(), false);
    clock += 1;
    assert.equal(await gate.isDue(), true);
});

test('due-query errors pause database work until retry and reset after a successful empty pass', async () => {
    let clock = 100000;
    let failing = true;
    const harness = loadServiceHarness({
        now: () => clock,
        queryResult: query => query.columns === 'announcement_id' && failing
            ? { data: null, error: { message: 'offline' } } : null,
    });
    harness.schedule(new Date(90000).toISOString());
    await assert.rejects(harness.service.publishDueAnnouncements(), /offline/);
    assert.equal(harness.reads.length, 2);
    for (let tick = 0; tick < 5; tick += 1) {
        clock += 5000;
        harness.service.invalidateAnnouncementReads();
        await harness.service.publishDueAnnouncements();
    }
    assert.equal(harness.reads.length, 2);
    clock += 5000;
    failing = false;
    await harness.service.publishDueAnnouncements();
    assert.equal(harness.reads.length, 4);
    failing = true;
    await assert.rejects(harness.service.publishDueAnnouncements(), /offline/);
    clock += 30000;
    await assert.rejects(harness.service.publishDueAnnouncements(), /offline/);
});

test('failed row publication pauses scheduler reads instead of retrying every five seconds', async () => {
    let clock = 100000;
    const harness = loadServiceHarness({
        now: () => clock,
        queryResult: query => query.update
            ? { data: null, error: { message: 'publication failed' } }
            : query.columns === 'announcement_id'
                ? { data: [{ announcement_id: 'failed-announcement' }], error: null } : null,
    });
    harness.schedule(new Date(90000).toISOString());
    await harness.service.publishDueAnnouncements();
    assert.equal(harness.reads.length, 3);
    clock += 5000;
    await harness.service.publishDueAnnouncements();
    assert.equal(harness.reads.length, 3);
    clock += 25000;
    await harness.service.publishDueAnnouncements();
    assert.equal(harness.reads.length, 5);
    clock += 30000;
    await harness.service.publishDueAnnouncements();
    assert.equal(harness.reads.length, 5);
});
