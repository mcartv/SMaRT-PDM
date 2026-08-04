const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyPiToken } = require('../middleware/verifyPiToken');

const DEVICE_UUID = '2e4e1e90-3d8a-4c59-b1ef-b7ae8a8d2b11';

function makeResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

test('accepts a valid token and UUID device id', () => {
    process.env.PI_SHARED_TOKEN = 'secret-token';
    const req = {
        headers: {
            'x-pi-token': 'secret-token',
            'x-pi-device-id': DEVICE_UUID,
        },
    };
    const res = makeResponse();
    let called = false;

    verifyPiToken(req, res, () => {
        called = true;
    });

    assert.equal(called, true);
    assert.equal(req.piAuth.deviceId, DEVICE_UUID);
});

test('rejects a non-UUID device id before queue access', () => {
    process.env.PI_SHARED_TOKEN = 'secret-token';
    const req = {
        headers: {
            'x-pi-token': 'secret-token',
            'x-pi-device-id': 'pi-001',
        },
    };
    const res = makeResponse();

    verifyPiToken(req, res, () => {
        throw new Error('next must not be called');
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'PI_DEVICE_ID_INVALID');
});
