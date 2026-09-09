const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const express = require('express');

async function fixture(t, overrides = {}, storageError = null) {
    const bytes = Buffer.from('synthetic capture');
    const events = [];
    const row = { artifact_id: 'artifact', request_status: 'processing', ocr_version: 'v2',
        document_key: 'student_grade_forms', claimed_by: 'device', device_id: 'device',
        artifact_kind: 'original', mime_type: 'image/png', byte_count: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        bucket_name: 'private', object_path: 'request/original.png', ...overrides };
    const client = { query: async (sql) => { events.push(sql.trim().split(/\s/)[0]); return { rows: [row] }; }, release() {} };
    const mocks = { crypto, jsonwebtoken: jwt,
        '../config/db': { connect: async () => client },
        '../config/supabase': { storage: { from: (bucket) => ({ upload: async (object, body, options) => {
            events.push('STORE'); assert.equal(bucket, 'private'); assert.equal(object, row.object_path);
            assert.deepEqual(body, bytes); assert.equal(options.contentType, 'image/png'); return { error: storageError };
        } }) } },
    };
    const context = { module: { exports: {} }, require: (key) => mocks[key], Buffer,
        process: { env: { PI_SHARED_TOKEN: 'test-only-secret' } }, console: { error() {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/captureUploadRelay.js'), 'utf8'), context);
    const relay = context.module.exports;
    const app = express();
    app.put('/api/pi/iot-ocr/:requestId/capture-artifacts/:artifactId/upload', relay.verify,
        express.raw({ type: ['image/png', 'image/jpeg'], limit: '15mb' }), relay.upload);
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const data = relay.authorize({ protocol: 'http', get: () => `127.0.0.1:${server.address().port}`,
        params: { requestId: 'request' }, piAuth: { deviceId: 'device' } },
    { artifacts: [{ artifact_id: 'artifact', signed_url: 'https://storage.invalid', token: 'old' }] });
    return { bytes, events, url: data.artifacts[0].signed_url,
        put: (url = data.artifacts[0].signed_url, body = bytes, mime = 'image/png') => fetch(url,
            { method: 'PUT', headers: { 'Content-Type': mime }, body }) };
}

test('existing worker raw PUT stores an integrity-checked private capture and commits availability', async (t) => {
    const f = await fixture(t); assert.equal((await f.put()).status, 200);
    assert.deepEqual(f.events, ['BEGIN', 'SELECT', 'STORE', 'UPDATE', 'COMMIT']);
});
test('token tampering, expiry, and cross-artifact replay are rejected before database access', async (t) => {
    const f = await fixture(t);
    for (const url of [f.url + 'bad', f.url.replace('/artifact/upload', '/other/upload'),
        f.url.split('?')[0] + '?token=' + jwt.sign({ requestId: 'request', artifactId: 'artifact', deviceId: 'device' },
            'test-only-secret', { audience: 'iot-capture-upload', expiresIn: -1 })]) {
        assert.equal((await f.put(url)).status, 403);
    }
    assert.deepEqual(f.events, []);
});
test('cancelled requests, another device and unrelated documents cannot store images', async (t) => {
    for (const override of [{ request_status: 'cancelled' }, { claimed_by: 'other' },
        { device_id: 'other' }, { document_key: 'birth_certificate' }, { ocr_version: 'v1' }]) {
        const f = await fixture(t, override); assert.equal((await f.put()).status, 409);
        assert.ok(!f.events.includes('STORE')); assert.ok(f.events.includes('ROLLBACK'));
    }
});
test('incorrect size, digest and MIME type fail before storage', async (t) => {
    const f = await fixture(t);
    for (const [body, mime] of [[Buffer.from('short'), 'image/png'],
        [Buffer.alloc(f.bytes.length), 'image/png'], [f.bytes, 'image/jpeg']]) {
        assert.equal((await f.put(f.url, body, mime)).status, 400);
    }
    assert.ok(!f.events.includes('STORE'));
});
test('storage failure rolls back availability and allows a later retry', async (t) => {
    const f = await fixture(t, {}, { message: 'private provider detail' });
    const response = await f.put(); assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /private provider detail/);
    assert.ok(!f.events.includes('UPDATE')); assert.ok(f.events.includes('ROLLBACK'));
});
test('indigency uses the same verified upload path', async (t) => {
    const f = await fixture(t, { document_key: 'certificate_of_indigency' });
    assert.equal((await f.put()).status, 200);
});
