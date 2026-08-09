const test = require('node:test');
const assert = require('node:assert/strict');

const DEVICE_UUID = '2e4e1e90-3d8a-4c59-b1ef-b7ae8a8d2b11';
const OTHER_DEVICE_UUID = '72b3dbe6-1da3-47de-8be2-911c9797a1a0';
const REQUEST_UUID = 'e8126252-c44d-4185-8244-72ea15d79758';
const APPLICATION_UUID = '7cf66c74-c23b-4c52-85da-82326a57de89';

let activeClient;
const dbPath = require.resolve('../config/db');
require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { connect: async () => activeClient },
};

const schemaPath = require.resolve('../services/iotOcrSchemaService');
require.cache[schemaPath] = {
    id: schemaPath,
    filename: schemaPath,
    loaded: true,
    exports: { ensureIotOcrSchema: async () => undefined },
};

const servicePath = require.resolve('../services/iotOcrRequestService');
delete require.cache[servicePath];
const service = require('../services/iotOcrRequestService');

function requestRow(overrides = {}) {
    return {
        request_id: REQUEST_UUID,
        application_id: APPLICATION_UUID,
        student_id: 'a477ac1e-49b8-4427-b327-c484b87d5f10',
        document_key: 'student_grade_forms',
        document_type: 'Grade Report',
        status: 'processing',
        claimed_by: DEVICE_UUID,
        ...overrides,
    };
}

function makeCandidateClient(row = requestRow()) {
    const calls = [];
    return {
        calls,
        async query(sql, params = []) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            calls.push({ sql: normalized, params });
            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) return { rows: [] };
            if (normalized.includes('SELECT * FROM public.iot_ocr_requests')) return { rows: [row] };
            if (normalized.includes('SELECT * FROM public.iot_ocr_candidates')) return { rows: [] };
            if (normalized.includes('INSERT INTO public.iot_ocr_candidates')) {
                return { rows: [{
                    candidate_id: '6b7de9c4-3c6c-4eb7-8826-b25ddd98406a',
                    request_id: REQUEST_UUID,
                    document_key: row.document_key,
                    template_id: params[2],
                    raw_text: params[3],
                    fields: JSON.parse(params[4]),
                    field_confidence: JSON.parse(params[5]),
                    validation_issues: JSON.parse(params[6]),
                    processing: JSON.parse(params[7]),
                }] };
            }
            if (normalized.includes("status = 'review_required'")) {
                return { rows: [requestRow({ ...row, status: 'review_required', template_id: params[1] })] };
            }
            return { rows: [] };
        },
        release() {},
    };
}

test('Pi success persists an immutable candidate and stops at review_required', async () => {
    activeClient = makeCandidateClient();
    const result = await service.completeRequest({
        requestId: REQUEST_UUID,
        status: 'review_required',
        templateId: 'grade_form_v1',
        rawText: 'text',
        fields: { student_number: '2023-1' },
        fieldConfidence: { student_number: 92 },
        validationIssues: [],
        processing: { registration_status: 'matched', ocr_engine: 'tesseract' },
        claimedBy: DEVICE_UUID,
    });
    assert.equal(result.request.status, 'review_required');
    assert.equal(result.candidate.template_id, 'grade_form_v1');
    assert.ok(activeClient.calls.some((call) => call.sql.includes('INSERT INTO public.iot_ocr_candidates')));
    assert.ok(!activeClient.calls.some((call) => call.sql.includes('iot_ocr_reviews')));
});

test('candidate submission rejects another Pi device', async () => {
    activeClient = makeCandidateClient(requestRow({ claimed_by: OTHER_DEVICE_UUID }));
    await assert.rejects(
        () => service.completeRequest({ requestId: REQUEST_UUID, status: 'review_required', claimedBy: DEVICE_UUID }),
        /another Pi device/
    );
});

test('completed is not a valid Pi result status', async () => {
    activeClient = makeCandidateClient();
    await assert.rejects(
        () => service.completeRequest({ requestId: REQUEST_UUID, status: 'completed', claimedBy: DEVICE_UUID }),
        /review_required, failed, or cancelled/
    );
});

test('text-only contract recursively rejects image fields', () => {
    assert.throws(
        () => service.assertTextOnlyPayload({ fields: { nested: { capture_path: '/tmp/a.jpg' } } }),
        /Forbidden OCR image field/
    );
});

test('review_required is not Pi-active and can complete or expire', () => {
    assert.equal(service.PI_ACTIVE_STATUSES.includes('review_required'), false);
    assert.deepEqual(service.ALLOWED_TRANSITIONS.review_required, ['completed', 'expired']);
});

test('admin cancellation is allowed for every Pi-active lifecycle state', () => {
    for (const status of service.PI_ACTIVE_STATUSES) {
        assert.ok(
            service.ALLOWED_TRANSITIONS[status].includes('cancelled'),
            `${status} must allow admin cancellation`
        );
    }
});

test('grade confirmation keeps the immutable Tesseract GWA read-only', () => {
    const candidate = {
        student_number: { raw_text: '2023-001234', normalized_value: '2023-001234' },
        student_name: { raw_text: 'JUAN DELA CRUZ', normalized_value: 'JUAN DELA CRUZ' },
        course: { raw_text: 'BSIT', normalized_value: 'BSIT' },
        semester: { raw_text: '1st Semester', normalized_value: '1st Semester' },
        academic_year: { raw_text: '2025-2026', normalized_value: '2025-2026' },
        gwa: { raw_text: '1.63', normalized_value: '1.63' },
        subjects: [],
    };
    const verified = service.validateConfirmedDocumentFields(
        'student_grade_forms',
        { ...candidate, student_name: 'JUAN S. DELA CRUZ', gwa: '1.63' },
        candidate
    );
    assert.equal(verified.student_name, 'JUAN S. DELA CRUZ');
    assert.equal(verified.gwa, '1.63');
    assert.throws(
        () => service.validateConfirmedDocumentFields(
            'student_grade_forms',
            { ...candidate, gwa: '1.75' },
            candidate
        ),
        /GWA is read-only/
    );
});

test('grade confirmation rejects an invalid Tesseract GWA', () => {
    assert.throws(() => service.normalizeGwa('N/A'), /1.00 to 5.00/);
    assert.throws(() => service.normalizeGwa('5.50'), /1.00 to 5.00/);
});

test('same-state Pi update is treated as a processing heartbeat', async () => {
    const row = requestRow({ status: 'processing' });
    activeClient = {
        calls: [],
        async query(sql) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            this.calls.push(normalized);
            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) return { rows: [] };
            if (normalized.startsWith('SELECT * FROM public.iot_ocr_requests')) return { rows: [row] };
            if (normalized.includes('SET processing_heartbeat_at = NOW()')) {
                return { rows: [{ ...row, processing_heartbeat_at: new Date().toISOString() }] };
            }
            return { rows: [] };
        },
        release() {},
    };

    const result = await service.updateRequestStatus({
        requestId: REQUEST_UUID,
        status: 'processing',
        claimedBy: DEVICE_UUID,
    });
    assert.ok(result.processing_heartbeat_at);
    assert.ok(activeClient.calls.some((sql) => sql.includes('SET processing_heartbeat_at = NOW()')));
});

test('status updates persist expiration before opening the transition transaction', () => {
    const fs = require('node:fs');
    const source = fs.readFileSync(servicePath, 'utf8');
    const updateSource = source.slice(source.indexOf('exports.updateRequestStatus'));
    assert.ok(
        updateSource.indexOf('await expireStaleRequests(client, { force: true })') <
        updateSource.indexOf("await client.query('BEGIN')")
    );
});
