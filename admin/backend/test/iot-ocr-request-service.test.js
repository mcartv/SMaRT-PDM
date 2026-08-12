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

test('IoT OCR is disabled only for registration, request letter, and application form', () => {
    assert.equal(service.isIotOcrDocumentEnabled('certificate_of_registration'), false);
    assert.equal(service.isIotOcrDocumentEnabled('letter_of_request'), false);
    assert.equal(service.isIotOcrDocumentEnabled('application_form'), false);
    assert.equal(service.isIotOcrDocumentEnabled('student_grade_forms'), true);
    assert.equal(service.isIotOcrDocumentEnabled('certificate_of_indigency'), true);
    assert.equal(service.isIotOcrDocumentEnabled('birth_certificate'), true);
});

test('review_required is not Pi-active and can complete or expire', () => {
    assert.equal(service.PI_ACTIVE_STATUSES.includes('review_required'), false);
    assert.deepEqual(service.ALLOWED_TRANSITIONS.review_required, ['completed', 'expired']);
});

test('fixed-lens worker can transition directly from previewing to capturing', () => {
    assert.ok(service.ALLOWED_TRANSITIONS.previewing.includes('capturing'));
});

test('grade fields recover from immutable raw OCR when Tesseract joins GRADEFOR', () => {
    const fields = service.withDerivedGradeFields(
        'student_grade_forms',
        'STUDENT NUMBER STUDENT NAME COURSE : PDM-2023-003137 Petima , Venice Eve BsiT '
            + 'COPY OF GRADEFOR THE PERIOD: 1st 2023-2024 O W A SCORE . 1,89',
        {}
    );

    assert.equal(fields.student_number.normalized_value, 'PDM-2023-003137');
    assert.equal(fields.student_name.normalized_value, 'Petima, Venice Eve');
    assert.equal(fields.course.normalized_value, 'BsiT');
    assert.equal(fields.semester.normalized_value, '1st Semester');
    assert.equal(fields.academic_year.normalized_value, '2023-2024');
    assert.equal(fields.gwa.normalized_value, '1.89');
    assert.deepEqual(fields.subjects, []);
});

test('grade Academic Year recovers from THEPERIOO OCR noise', () => {
    const fields = service.withDerivedGradeFields(
        'student_grade_forms',
        'STUDENT NUMBER PDM-2023-003137 COPY OF GRADE FOR THEPERIOO: '
            + '1st 2023-2024 GWA: 1.89',
        {}
    );

    assert.equal(fields.semester.normalized_value, '1st Semester');
    assert.equal(fields.academic_year.normalized_value, '2023-2024');
});

test('indigency review fields recover full address without changing immutable raw OCR', () => {
    const rawText = 'Certificate Subject Name: MS. VENICE EVE PELIMA,\n'
        + 'Full Address: 12 SAMPLE STREET, LIAS, MARILAO, BULACAN\n'
        + 'Issue Date: 24 day of March 2025';
    const fields = service.withDerivedIndigencyFields(
        'certificate_of_indigency',
        rawText,
        {
            issue_date: { normalized_value: 'legacy date' },
            issuing_barangay: { normalized_value: 'legacy barangay' },
        }
    );

    assert.equal(fields.certificate_subject_name.normalized_value, 'MS. VENICE EVE PELIMA,');
    assert.equal(
        fields.residency_address.normalized_value,
        '12 SAMPLE STREET, LIAS, MARILAO, BULACAN'
    );
    assert.equal(fields.issue_date, undefined);
    assert.equal(fields.issuing_barangay, undefined);
    assert.match(rawText, /Full Address: 12 SAMPLE STREET/);
});

test('indigency confirmation requires and preserves the verified full address', () => {
    const fields = {
        certificate_subject_name: 'JUAN DELA CRUZ',
        residency_address: '12 SAMPLE STREET, LIAS, MARILAO, BULACAN',
        issue_date: '24 day of March 2025',
        issuing_barangay: 'LIAS',
    };

    assert.deepEqual(
        service.validateConfirmedDocumentFields('certificate_of_indigency', fields),
        {
            certificate_subject_name: fields.certificate_subject_name,
            residency_address: fields.residency_address,
        }
    );
    assert.throws(
        () => service.validateConfirmedDocumentFields(
            'certificate_of_indigency',
            { ...fields, residency_address: '   ' }
        ),
        /residency_address/
    );
    assert.deepEqual(
        service.buildVerifiedApplicationPatch('certificate_of_indigency', fields),
        { student: { marilao_resident: true } }
    );
    assert.deepEqual(
        service.buildVerifiedApplicationPatch('certificate_of_indigency', {
            ...fields,
            residency_address: '12 SAMPLE STREET, MALOLOS, BULACAN',
        }),
        { student: { marilao_resident: false } }
    );
});

test('admin cancellation is allowed for every Pi-active lifecycle state', () => {
    for (const status of service.PI_ACTIVE_STATUSES) {
        assert.ok(
            service.ALLOWED_TRANSITIONS[status].includes('cancelled'),
            `${status} must allow admin cancellation`
        );
    }
});

test('grade confirmation keeps GWA and restores Academic Year', () => {
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
    assert.equal(verified.student_name, undefined);
    assert.equal(verified.course, undefined);
    assert.equal(verified.semester, undefined);
    assert.equal(verified.academic_year, '2025-2026');
    assert.equal(verified.gwa, '1.63');
    assert.deepEqual(
        service.buildVerifiedApplicationPatch('student_grade_forms', verified),
        { student: { gwa: 1.63, academic_year: '2025-2026' } }
    );
    assert.throws(
        () => service.validateConfirmedDocumentFields(
            'student_grade_forms',
            { ...candidate, student_number: '   ' },
            candidate
        ),
        /student_number/
    );
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

test('grade confirmation persists GWA and configured Academic Year atomically', async () => {
    const calls = [];
    const client = {
        async query(sql, params) {
            const normalized = String(sql).replace(/\s+/g, ' ').trim();
            calls.push({ sql: normalized, params });
            if (normalized.startsWith('SELECT academic_year_id')) {
                return { rows: [{ academic_year_id: 'b8468ed8-a85d-49f4-8463-d2fe4b1d9559' }] };
            }
            return { rows: [] };
        },
    };

    const result = await service.persistVerifiedGradeSummary(
        client,
        requestRow().student_id,
        { gwa: '1.63', academic_year: '2025-2026' }
    );

    assert.deepEqual(result, { gwa: 1.63, academic_year: '2025-2026' });
    const update = calls.find((call) => call.sql.startsWith('UPDATE public.students'));
    assert.ok(update);
    assert.match(update.sql, /active_academic_year_id = \$3::uuid/);
    assert.deepEqual(update.params.slice(1), [
        1.63,
        'b8468ed8-a85d-49f4-8463-d2fe4b1d9559',
    ]);
});

test('grade confirmation rejects an unconfigured Academic Year', async () => {
    const client = { query: async () => ({ rows: [] }) };
    await assert.rejects(
        () => service.persistVerifiedGradeSummary(
            client,
            requestRow().student_id,
            { gwa: '1.63', academic_year: '2099-2100' }
        ),
        /is not configured/
    );
});

test('birth confirmation normalizes parent components without overwriting child identity', () => {
    const verified = service.validateConfirmedDocumentFields('birth_certificate', {
        child_name: { components: { first_name: 'JUAN', middle_name: 'S', last_name: 'DELA CRUZ' } },
        mother_maiden_name: { components: { first_name: 'MARIA', middle_name: 'R', last_name: 'SANTOS' } },
        father_name: { components: { first_name: 'PEDRO', middle_name: 'M', last_name: 'DELA CRUZ' } },
    });

    assert.deepEqual(verified.mother_maiden_name, {
        first_name: 'MARIA', middle_name: 'R', last_name: 'SANTOS',
    });
    assert.deepEqual(verified.father_name, {
        first_name: 'PEDRO', middle_name: 'M', last_name: 'DELA CRUZ',
    });
    assert.throws(
        () => service.validateConfirmedDocumentFields('birth_certificate', {
            child_name: { first_name: 'JUAN', last_name: 'DELA CRUZ' },
            mother_maiden_name: { first_name: 'MARIA', last_name: '' },
            father_name: { first_name: 'PEDRO', last_name: 'DELA CRUZ' },
        }),
        /Mother's maiden name requires first_name and last_name/
    );
});

test('verified birth parents upsert Mother and Father using the confirmation transaction', async () => {
    const calls = [];
    const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
    await service.upsertVerifiedBirthParents(client, requestRow().student_id, {
        mother_maiden_name: { first_name: 'MARIA', middle_name: 'R', last_name: 'SANTOS' },
        father_name: { first_name: 'PEDRO', middle_name: '', last_name: 'DELA CRUZ' },
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.params[1]), ['Mother', 'Father']);
    assert.ok(calls.every((call) => String(call.sql).includes('ON CONFLICT (student_id, relation)')));
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

test('terminal request tells the Pi worker to stop without changing state', async () => {
    activeClient = makeCandidateClient(requestRow({ status: 'cancelled' }));

    await assert.rejects(
        () => service.updateRequestStatus({
            requestId: REQUEST_UUID,
            status: 'capturing',
            claimedBy: DEVICE_UUID,
        }),
        (error) => {
            assert.equal(error.statusCode, 409);
            assert.equal(error.code, 'IOT_OCR_REQUEST_STOPPED');
            assert.equal(error.currentStatus, 'cancelled');
            return true;
        }
    );
});

test('late Pi result receives the same terminal stop contract', async () => {
    activeClient = makeCandidateClient(requestRow({ status: 'expired' }));

    await assert.rejects(
        () => service.completeRequest({
            requestId: REQUEST_UUID,
            status: 'review_required',
            claimedBy: DEVICE_UUID,
        }),
        (error) => {
            assert.equal(error.statusCode, 409);
            assert.equal(error.code, 'IOT_OCR_REQUEST_STOPPED');
            assert.equal(error.currentStatus, 'expired');
            assert.equal(error.request.status, 'expired');
            return true;
        }
    );
});

test('requests have no automatic timeout expiration', () => {
    const fs = require('node:fs');
    const source = fs.readFileSync(servicePath, 'utf8');
    assert.doesNotMatch(source, /expireStaleRequests/);
    assert.doesNotMatch(source, /PENDING_TIMEOUT|PROCESSING_HEARTBEAT_TIMEOUT|REVIEW_TIMEOUT/);
    assert.match(source, /expires_at: null/);
});
