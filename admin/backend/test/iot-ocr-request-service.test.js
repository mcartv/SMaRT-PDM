const test = require('node:test');
const assert = require('node:assert/strict');

const DEVICE_UUID = '2e4e1e90-3d8a-4c59-b1ef-b7ae8a8d2b11';
const OTHER_DEVICE_UUID = '72b3dbe6-1da3-47de-8be2-911c9797a1a0';
const REQUEST_UUID = 'e8126252-c44d-4185-8244-72ea15d79758';
const APPLICATION_UUID = '7cf66c74-c23b-4c52-85da-82326a57de89';
const STUDENT_UUID = 'a477ac1e-49b8-4427-b327-c484b87d5f10';

let activeClient = null;
const dbPath = require.resolve('../config/db');
require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
        connect: async () => activeClient,
    },
};

let savedSnapshotInput = null;
const applicationServicePath = require.resolve('../services/applicationService');
require.cache[applicationServicePath] = {
    id: applicationServicePath,
    filename: applicationServicePath,
    loaded: true,
    exports: {
        normalizeOcrPayload: (payload) => ({
            raw_text: payload.raw_text || '',
            ocr_confidence: payload.ocr_confidence ?? null,
            extracted_fields: payload.extracted_fields || {},
            source_payload: payload.source_payload || {},
        }),
        saveApplicationDocumentOcrSnapshot: async (input) => {
            savedSnapshotInput = input;
            return { document_id: 'snapshot-id' };
        },
    },
};

const servicePath = require.resolve('../services/iotOcrRequestService');
delete require.cache[servicePath];
const iotOcrRequestService = require('../services/iotOcrRequestService');

function requestRow(overrides = {}) {
    return {
        request_id: REQUEST_UUID,
        application_id: APPLICATION_UUID,
        student_id: STUDENT_UUID,
        student_name: 'Test Student',
        document_key: 'student_grade_forms',
        document_type: 'Grade Report',
        status: 'claimed',
        requested_by: null,
        claimed_by: null,
        created_at: new Date().toISOString(),
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

function makeClient(row) {
    const calls = [];
    const client = {
        calls,
        released: false,
        async query(sql, params = []) {
            const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
            calls.push({ sql: normalizedSql, params });

            if (normalizedSql === 'BEGIN' || normalizedSql === 'COMMIT' || normalizedSql === 'ROLLBACK') {
                return { rows: [] };
            }

            if (normalizedSql.includes('SELECT * FROM iot_ocr_requests')) {
                return { rows: [row] };
            }

            if (normalizedSql.includes("status = 'completed'")) {
                return {
                    rows: [
                        requestRow({
                            ...row,
                            status: 'completed',
                            claimed_by: params[1],
                            completed_at: new Date().toISOString(),
                        }),
                    ],
                };
            }

            return { rows: [] };
        },
        release() {
            this.released = true;
        },
    };
    return client;
}

test('completion backfills valid device provenance before saving snapshot', async () => {
    savedSnapshotInput = null;
    activeClient = makeClient(requestRow());

    const result = await iotOcrRequestService.completeRequest({
        requestId: REQUEST_UUID,
        status: 'completed',
        rawText: 'OCR result',
        extractedFields: { gwa: 1.5 },
        sourcePayload: { source: 'test' },
        claimedBy: DEVICE_UUID,
    });

    assert.equal(result.request.status, 'completed');
    assert.equal(result.request.claimed_by, DEVICE_UUID);
    assert.equal(savedSnapshotInput.iotDeviceId, DEVICE_UUID);
    assert.equal(savedSnapshotInput.iotRequestId, REQUEST_UUID);

    const provenanceUpdate = activeClient.calls.find(
        (call) => call.sql.includes("status = CASE WHEN status = 'pending' THEN 'claimed'")
    );
    assert.ok(provenanceUpdate);
    assert.equal(provenanceUpdate.params[1], DEVICE_UUID);
    assert.equal(activeClient.released, true);
});

test('completion rejects a result from a different device', async () => {
    activeClient = makeClient(requestRow({ claimed_by: OTHER_DEVICE_UUID }));

    await assert.rejects(
        () => iotOcrRequestService.completeRequest({
            requestId: REQUEST_UUID,
            status: 'completed',
            claimedBy: DEVICE_UUID,
        }),
        (error) => error.statusCode === 409 && /another Pi device/.test(error.message)
    );

    assert.ok(activeClient.calls.some((call) => call.sql === 'ROLLBACK'));
    assert.equal(activeClient.released, true);
});

test('service rejects non-UUID device provenance', async () => {
    await assert.rejects(
        () => iotOcrRequestService.completeRequest({
            requestId: REQUEST_UUID,
            status: 'completed',
            claimedBy: 'pi-001',
        }),
        (error) => error.statusCode === 400 && /valid Pi device UUID/.test(error.message)
    );
});
