const test = require('node:test');
const assert = require('node:assert/strict');

const presence = require('../services/iotOcrPresenceService');

test('Pi availability is offline until an authenticated worker checks in', () => {
    assert.equal(presence.getAvailability().online, false);
    presence.checkIn('2e4e1e90-3d8a-4c59-b1ef-b7ae8a8d2b11');
    const availability = presence.getAvailability();
    assert.equal(availability.online, true);
    assert.equal(availability.device_count, 1);
    assert.ok(availability.last_seen_at);
});
