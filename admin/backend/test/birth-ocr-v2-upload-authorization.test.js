const test = require('node:test');
const assert = require('node:assert/strict');

const REQUEST_ID = 'f63ecca4-f186-4d60-b71a-1894a76301bf';
const DEVICE_ID = '2e4e1e90-3d8a-4c59-b1ef-b7ae8a8d2b11';
const insertCalls = [];
const signedUploadCalls = [];

const client = {
    async query(sql, params = []) {
        const normalized = String(sql).replace(/\s+/g, ' ').trim();
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) return { rows: [] };
        if (normalized.includes('SELECT * FROM public.iot_ocr_requests')) {
            return {
                rows: [{
                    request_id: REQUEST_ID,
                    document_key: 'birth_certificate',
                    ocr_version: 'v2',
                    status: 'processing',
                    claimed_by: DEVICE_ID,
                }],
            };
        }
        if (normalized.includes('INSERT INTO public.iot_ocr_capture_artifacts')) {
            insertCalls.push({ sql: normalized, params });
            return { rows: [{ artifact_id: params[0], object_path: params[5] }] };
        }
        throw new Error(`Unexpected query in Birth V2 authorization test: ${normalized}`);
    },
    release() {},
};

const dbPath = require.resolve('../config/db');
require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
        connect: async () => client,
        query: async () => ({ rows: [], rowCount: 0 }),
    },
};

const bucket = {
    async createSignedUploadUrl(objectPath, options) {
        signedUploadCalls.push({ objectPath, options });
        return {
            data: {
                signedUrl: `https://storage.invalid/upload?token=test-token`,
                token: 'test-token',
            },
            error: null,
        };
    },
};
const supabasePath = require.resolve('../config/supabase');
require.cache[supabasePath] = {
    id: supabasePath,
    filename: supabasePath,
    loaded: true,
    exports: {
        storage: {
            getBucket: async () => ({
                data: { id: 'iot-ocr-captures', public: false },
                error: null,
            }),
            from: () => bucket,
        },
    },
};

const requestServicePath = require.resolve('../services/iotOcrRequestService');
require.cache[requestServicePath] = {
    id: requestServicePath,
    filename: requestServicePath,
    loaded: true,
    exports: {},
};

const servicePath = require.resolve('../services/birthOcrV2Service');
delete require.cache[servicePath];
const service = require('../services/birthOcrV2Service');

function originalArtifact() {
    return {
        artifact_kind: 'original',
        cell_key: null,
        mime_type: 'image/jpeg',
        byte_count: 512,
        sha256: 'a'.repeat(64),
        roi_polygon: null,
    };
}

function completeManifest() {
    return [
        originalArtifact(),
        ...service.CELL_KEYS.map((cellKey, index) => ({
            artifact_kind: 'cell',
            cell_key: cellKey,
            mime_type: 'image/png',
            byte_count: 128 + index,
            sha256: String((index + 1) % 10).repeat(64),
            roi_polygon: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.2], [0.1, 0.2]],
        })),
    ];
}

test.beforeEach(() => {
    insertCalls.length = 0;
    signedUploadCalls.length = 0;
});

test('original Birth V2 capture binds SQL NULL before signed upload authorization', async () => {
    const result = await service.authorizeUploads({
        requestId: REQUEST_ID,
        deviceId: DEVICE_ID,
        artifacts: [originalArtifact()],
    });

    assert.equal(insertCalls.length, 1);
    assert.equal(insertCalls[0].params[9], null);
    assert.equal(signedUploadCalls.length, 1);
    assert.equal(result.artifacts.length, 1);
});

test('nine Birth V2 cell polygons remain JSON arrays while original remains SQL NULL', async () => {
    const result = await service.authorizeUploads({
        requestId: REQUEST_ID,
        deviceId: DEVICE_ID,
        artifacts: completeManifest(),
    });

    assert.equal(insertCalls.length, 10);
    assert.equal(insertCalls[0].params[9], null);
    for (const call of insertCalls.slice(1)) {
        assert.equal(Array.isArray(JSON.parse(call.params[9])), true);
        assert.equal(JSON.parse(call.params[9]).length, 4);
    }
    assert.equal(signedUploadCalls.length, 10);
    assert.equal(result.artifacts.length, 10);
});

test('diagnostic expected regions accept only the nine normalized Birth cell keys', () => {
    const polygon = [[0.1, 0.1], [0.4, 0.1], [0.4, 0.2], [0.1, 0.2]];
    const normalized = service.normalizeDiagnostic({
        code: 'PSA_BIRTH_V2_TOPOLOGY_MISMATCH',
        registration_status: 'matched',
        topology_status: 'mismatch',
        registration_mode: 'manual_station_quad',
        region_mode: 'expected_calibration',
        source_regions: Object.fromEntries(service.CELL_KEYS.map((key) => [key, polygon])),
    });
    assert.equal(normalized.registration_mode, 'manual_station_quad');
    assert.equal(normalized.region_mode, 'expected_calibration');
    assert.deepEqual(Object.keys(normalized.source_regions), [...service.CELL_KEYS]);
    assert.throws(() => service.normalizeDiagnostic({
        code: 'PSA_BIRTH_V2_TOPOLOGY_MISMATCH',
        source_regions: { image_url: polygon },
    }), /Invalid diagnostic source region key/);
});
