const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeDeviceId,
    normalizeUserId,
    resolveActorUserId,
} = require('../utils/iotOcrIdentity');

const UUID = '2e4e1e90-3d8a-4c59-b1ef-b7ae8a8d2b11';

test('normalizes valid UUID identities', () => {
    assert.equal(normalizeDeviceId(`  ${UUID.toUpperCase()}  `), UUID);
    assert.equal(normalizeUserId(UUID), UUID);
});

test('rejects blank and non-UUID identities', () => {
    assert.equal(normalizeDeviceId(''), null);
    assert.equal(normalizeDeviceId('pi-001'), null);
    assert.equal(normalizeUserId('admin'), null);
});

test('resolves the authenticated requester from supported request fields', () => {
    assert.equal(resolveActorUserId({ user: { userId: UUID } }), UUID);
    assert.equal(resolveActorUserId({ adminSession: { user_id: UUID } }), UUID);
});
