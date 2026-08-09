const pool = require('../config/db');
const documentTypes = require('../utils/documentTypes');
const { normalizeDeviceId, normalizeUserId } = require('../utils/iotOcrIdentity');
const { ensureIotOcrSchema } = require('./iotOcrSchemaService');

const PI_ACTIVE_STATUSES = Object.freeze([
    'pending', 'claimed', 'previewing', 'focusing', 'capturing', 'processing',
]);
const TERMINAL_STATUSES = Object.freeze(['completed', 'cancelled', 'failed', 'expired']);
const ALLOWED_TRANSITIONS = Object.freeze({
    pending: Object.freeze(['claimed', 'expired', 'cancelled']),
    claimed: Object.freeze(['previewing', 'failed', 'expired']),
    previewing: Object.freeze(['focusing', 'cancelled', 'failed', 'expired']),
    focusing: Object.freeze(['capturing', 'failed', 'expired']),
    capturing: Object.freeze(['processing', 'failed', 'expired']),
    processing: Object.freeze(['review_required', 'failed', 'expired']),
    review_required: Object.freeze(['completed']),
});
const ACTIVE_STATUS_SQL = PI_ACTIVE_STATUSES.map((status) => `'${status}'`).join(', ');
const FORBIDDEN_PAYLOAD_KEYS = new Set([
    'image', 'image_url', 'capture_url', 'capture_path', 'processed_image',
    'processed_image_url', 'base64_image',
]);
const PENDING_TTL_SQL = `NOW() - INTERVAL '10 minutes'`;
const PROCESSING_TTL_SQL = `NOW() - INTERVAL '6 minutes'`;

function buildHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(String(value || '').trim());
}

function assertTextOnlyPayload(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
        if (FORBIDDEN_PAYLOAD_KEYS.has(String(key).toLowerCase())) {
            throw buildHttpError(400, `Forbidden OCR image field: ${key}`);
        }
        assertTextOnlyPayload(nested);
    }
}

function mapRequestRow(row) {
    if (!row) return null;
    return {
        request_id: row.request_id,
        application_id: row.application_id,
        student_id: row.student_id,
        student_name: row.student_name || null,
        document_key: row.document_key,
        document_type: row.document_type,
        template_id: row.template_id || null,
        status: row.status || 'pending',
        requested_by: row.requested_by || null,
        claimed_by: row.claimed_by || null,
        claimed_at: row.claimed_at || null,
        processing_started_at: row.processing_started_at || null,
        processing_heartbeat_at: row.processing_heartbeat_at || null,
        reviewed_by: row.reviewed_by || null,
        reviewed_at: row.reviewed_at || null,
        retry_of_request_id: row.retry_of_request_id || null,
        error_code: row.error_code || null,
        error_message: row.error_message || null,
        created_at: row.created_at || null,
        completed_at: row.completed_at || null,
        updated_at: row.updated_at || null,
    };
}

function mapCandidateRow(row) {
    if (!row) return null;
    return {
        candidate_id: row.candidate_id,
        request_id: row.request_id,
        status: 'review_required',
        document_key: row.document_key,
        template_id: row.template_id,
        raw_text: row.raw_text || '',
        fields: row.fields || {},
        field_confidence: row.field_confidence || {},
        validation_issues: row.validation_issues || [],
        review_required: true,
        processing: row.processing || {},
        created_at: row.created_at || null,
    };
}

function transitionAllowed(from, to) {
    return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

function normalizeCandidate(input, requestRow) {
    const source = input.candidate && typeof input.candidate === 'object'
        ? input.candidate
        : input;
    const extracted = source.extractedFields || source.extracted_fields || {};
    const processingSource = source.processing || source.sourcePayload || source.source_payload || {};
    const fields = source.fields || extracted.fields || extracted || {};
    const fieldConfidence = source.fieldConfidence || source.field_confidence || extracted.field_confidence || {};
    const validationIssues = source.validationIssues || source.validation_issues || extracted.validation_issues || [];
    const templateId = String(
        source.templateId || source.template_id || extracted.template_id ||
        processingSource.preprocessing_variant || `${requestRow.document_key}_v1`
    ).trim();
    const processing = source.processing && typeof source.processing === 'object'
        ? source.processing
        : {
            registration_status: processingSource.registration_status || 'unknown',
            preprocessing_variant: processingSource.preprocessing_variant || templateId,
            ocr_engine: 'tesseract',
        };
    const candidate = {
        request_id: requestRow.request_id,
        status: 'review_required',
        document_key: requestRow.document_key,
        template_id: templateId,
        raw_text: String(source.rawText ?? source.raw_text ?? ''),
        fields: fields && typeof fields === 'object' && !Array.isArray(fields) ? fields : {},
        field_confidence: fieldConfidence && typeof fieldConfidence === 'object' && !Array.isArray(fieldConfidence)
            ? fieldConfidence
            : {},
        validation_issues: Array.isArray(validationIssues) ? validationIssues : [],
        review_required: true,
        processing,
    };
    assertTextOnlyPayload(candidate);
    return candidate;
}

function validateConfirmedDocumentFields(documentKey, fields) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        throw buildHttpError(400, 'corrected_fields must be an object');
    }
    assertTextOnlyPayload(fields);

    const requiredByDocument = {
        certificate_of_live_birth: ['child_name', 'mother_maiden_name', 'father_name'],
        certificate_of_indigency: ['certificate_subject_name', 'issue_date', 'issuing_barangay'],
        student_grade_forms: ['student_number', 'student_name', 'course', 'semester', 'academic_year', 'subjects', 'gwa'],
    };
    const required = requiredByDocument[documentKey];
    if (!required) throw buildHttpError(400, 'Unsupported OCR document contract');
    const missing = required.filter((key) => fields[key] === undefined || fields[key] === null);
    if (missing.length) throw buildHttpError(400, `Missing confirmed OCR fields: ${missing.join(', ')}`);
    if (documentKey === 'student_grade_forms' && !Array.isArray(fields.subjects)) {
        throw buildHttpError(400, 'subjects must be an array');
    }
    return fields;
}

async function expireStaleRequests(client) {
    await client.query(`
        UPDATE public.iot_ocr_requests
        SET status = 'expired', error_code = 'PENDING_TIMEOUT',
            error_message = 'IoT OCR request expired while waiting for the Pi',
            completed_at = NOW(), updated_at = NOW()
        WHERE status = 'pending' AND created_at < ${PENDING_TTL_SQL}
    `);
    await client.query(`
        UPDATE public.iot_ocr_requests
        SET status = 'expired', error_code = 'PROCESSING_HEARTBEAT_TIMEOUT',
            error_message = 'IoT OCR worker heartbeat expired',
            completed_at = NOW(), updated_at = NOW()
        WHERE status IN ('claimed', 'previewing', 'focusing', 'capturing', 'processing')
          AND COALESCE(processing_heartbeat_at, updated_at) < ${PROCESSING_TTL_SQL}
    `);
}

async function resolveRequestContext(client, applicationId, documentKey) {
    const normalizedDocumentKey = documentTypes.normalizeDocumentType(documentKey);
    if (!applicationId || !normalizedDocumentKey) throw buildHttpError(400, 'Valid application and document are required');
    if (normalizedDocumentKey === 'application_form') throw buildHttpError(400, 'Document cannot be camera scanned');
    const documentType = documentTypes.DOCUMENT_TYPE_TO_NAME[normalizedDocumentKey];
    if (!documentType) throw buildHttpError(400, 'Invalid document_key');
    const result = await client.query(`
        SELECT a.application_id, a.student_id,
               TRIM(CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name)) AS student_name
        FROM public.applications a
        LEFT JOIN public.students s ON s.student_id = a.student_id
        WHERE a.application_id = $1::uuid LIMIT 1
    `, [applicationId]);
    if (!result.rows.length) throw buildHttpError(404, 'Application not found');
    return { ...result.rows[0], document_key: normalizedDocumentKey, document_type: documentType };
}

exports.createRequest = async (input = {}) => {
    await ensureIotOcrSchema();
    const requestedBy = normalizeUserId(input.requestedBy || input.requested_by);
    if (!requestedBy) throw buildHttpError(401, 'Authenticated requester user_id is required');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await expireStaleRequests(client);
        const context = await resolveRequestContext(
            client,
            input.applicationId || input.application_id,
            input.documentKey || input.document_key
        );
        const active = await client.query(`
            SELECT * FROM public.iot_ocr_requests
            WHERE application_id = $1::uuid AND document_key = $2
              AND status IN (${ACTIVE_STATUS_SQL})
            ORDER BY created_at DESC LIMIT 1 FOR UPDATE
        `, [context.application_id, context.document_key]);
        if (active.rows.length) {
            await client.query('COMMIT');
            return { created: false, request: mapRequestRow(active.rows[0]) };
        }
        const inserted = await client.query(`
            INSERT INTO public.iot_ocr_requests
                (application_id, student_id, student_name, document_key, document_type, status, requested_by)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'pending', $6::uuid)
            RETURNING *
        `, [context.application_id, context.student_id, context.student_name || null,
            context.document_key, context.document_type, requestedBy]);
        await client.query('COMMIT');
        return { created: true, request: mapRequestRow(inserted.rows[0]) };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
};

exports.claimNextRequest = async ({ claimedBy } = {}) => {
    await ensureIotOcrSchema();
    const deviceId = normalizeDeviceId(claimedBy);
    if (!deviceId) throw buildHttpError(400, 'A valid Pi device UUID is required');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await expireStaleRequests(client);
        const result = await client.query(`
            WITH next_request AS (
                SELECT request_id FROM public.iot_ocr_requests
                WHERE status = 'pending' ORDER BY created_at ASC
                FOR UPDATE SKIP LOCKED LIMIT 1
            )
            UPDATE public.iot_ocr_requests
            SET status = 'claimed', claimed_by = $1, claimed_at = NOW(),
                processing_heartbeat_at = NOW(), updated_at = NOW()
            WHERE request_id IN (SELECT request_id FROM next_request)
            RETURNING *
        `, [deviceId]);
        if (!result.rows.length) throw buildHttpError(404, 'No IoT OCR request available');
        await client.query('COMMIT');
        return mapRequestRow(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
};

exports.updateRequestStatus = async ({ requestId, status, claimedBy } = {}) => {
    await ensureIotOcrSchema();
    const nextStatus = String(status || '').trim().toLowerCase();
    const deviceId = normalizeDeviceId(claimedBy);
    if (!isUuid(requestId) || !deviceId) throw buildHttpError(400, 'Valid request and Pi device UUID are required');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const selected = await client.query(
            'SELECT * FROM public.iot_ocr_requests WHERE request_id = $1::uuid FOR UPDATE',
            [requestId]
        );
        const row = selected.rows[0];
        if (!row) throw buildHttpError(404, 'IoT OCR request not found');
        if (row.claimed_by && normalizeDeviceId(row.claimed_by) !== deviceId) throw buildHttpError(409, 'Request belongs to another Pi device');
        if (row.status === nextStatus) {
            await client.query('COMMIT');
            return mapRequestRow(row);
        }
        if (!transitionAllowed(row.status, nextStatus) || nextStatus === 'review_required' || nextStatus === 'completed') {
            throw buildHttpError(409, `Invalid IoT OCR transition: ${row.status} -> ${nextStatus}`);
        }
        const updated = await client.query(`
            UPDATE public.iot_ocr_requests SET status = $2, claimed_by = $3,
                processing_started_at = CASE WHEN $2 = 'processing' THEN COALESCE(processing_started_at, NOW()) ELSE processing_started_at END,
                processing_heartbeat_at = NOW(),
                completed_at = CASE WHEN $2 IN ('cancelled', 'failed', 'expired') THEN NOW() ELSE completed_at END,
                updated_at = NOW()
            WHERE request_id = $1::uuid RETURNING *
        `, [requestId, nextStatus, deviceId]);
        await client.query('COMMIT');
        return mapRequestRow(updated.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
};

exports.completeRequest = async (input = {}) => {
    await ensureIotOcrSchema();
    const requestId = input.requestId || input.request_id;
    const submittedStatus = String(input.status || '').trim().toLowerCase();
    const deviceId = normalizeDeviceId(input.claimedBy || input.claimed_by);
    if (!isUuid(requestId) || !deviceId) throw buildHttpError(400, 'Valid request and Pi device UUID are required');
    if (!['review_required', 'failed', 'cancelled'].includes(submittedStatus)) {
        throw buildHttpError(400, 'Pi result status must be review_required, failed, or cancelled');
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const selected = await client.query(
            'SELECT * FROM public.iot_ocr_requests WHERE request_id = $1::uuid FOR UPDATE',
            [requestId]
        );
        const row = selected.rows[0];
        if (!row) throw buildHttpError(404, 'IoT OCR request not found');
        if (row.claimed_by && normalizeDeviceId(row.claimed_by) !== deviceId) throw buildHttpError(409, 'Request belongs to another Pi device');

        if (submittedStatus === 'review_required') {
            const existing = await client.query(
                'SELECT * FROM public.iot_ocr_candidates WHERE request_id = $1::uuid',
                [requestId]
            );
            if (existing.rows.length) {
                await client.query('COMMIT');
                return { request: mapRequestRow(row), candidate: mapCandidateRow(existing.rows[0]), idempotent: true };
            }
            if (row.status !== 'processing') throw buildHttpError(409, `Cannot submit OCR candidate from ${row.status}`);
            const candidate = normalizeCandidate(input, row);
            const inserted = await client.query(`
                INSERT INTO public.iot_ocr_candidates
                    (request_id, document_key, template_id, raw_text, fields,
                     field_confidence, validation_issues, processing, device_id)
                VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::uuid)
                RETURNING *
            `, [requestId, row.document_key, candidate.template_id, candidate.raw_text,
                JSON.stringify(candidate.fields), JSON.stringify(candidate.field_confidence),
                JSON.stringify(candidate.validation_issues), JSON.stringify(candidate.processing), deviceId]);
            const updated = await client.query(`
                UPDATE public.iot_ocr_requests SET status = 'review_required', template_id = $2,
                    processing_heartbeat_at = NOW(), error_code = NULL, error_message = NULL,
                    updated_at = NOW() WHERE request_id = $1::uuid RETURNING *
            `, [requestId, candidate.template_id]);
            await client.query('COMMIT');
            return { request: mapRequestRow(updated.rows[0]), candidate: mapCandidateRow(inserted.rows[0]), idempotent: false };
        }

        if (row.status === submittedStatus) {
            await client.query('COMMIT');
            return { request: mapRequestRow(row), candidate: null, idempotent: true };
        }
        if (!transitionAllowed(row.status, submittedStatus)) throw buildHttpError(409, `Invalid IoT OCR transition: ${row.status} -> ${submittedStatus}`);
        const updated = await client.query(`
            UPDATE public.iot_ocr_requests SET status = $2, claimed_by = $3,
                error_code = $4, error_message = $5, completed_at = NOW(), updated_at = NOW()
            WHERE request_id = $1::uuid RETURNING *
        `, [requestId, submittedStatus, deviceId, input.errorCode || input.error_code || null,
            String(input.errorMessage || input.error_message || (submittedStatus === 'cancelled' ? 'Capture cancelled' : 'OCR failed'))]);
        await client.query('COMMIT');
        return { request: mapRequestRow(updated.rows[0]), candidate: null, idempotent: false };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
};

exports.getRequestById = async ({ requestId, applicationId = null, documentKey = null }) => {
    if (!isUuid(requestId)) throw buildHttpError(400, 'Valid request_id is required');
    const client = await pool.connect();
    try {
        const params = [requestId];
        const filters = ['r.request_id = $1::uuid'];
        if (applicationId) { params.push(applicationId); filters.push(`r.application_id = $${params.length}::uuid`); }
        if (documentKey) { params.push(documentTypes.normalizeDocumentType(documentKey)); filters.push(`r.document_key = $${params.length}`); }
        const result = await client.query(`
            SELECT r.* FROM public.iot_ocr_requests r WHERE ${filters.join(' AND ')} LIMIT 1
        `, params);
        return mapRequestRow(result.rows[0]);
    } finally { client.release(); }
};

exports.getLatestRequestForDocument = async ({ applicationId, documentKey }) => {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT * FROM public.iot_ocr_requests
            WHERE application_id = $1::uuid AND document_key = $2
            ORDER BY created_at DESC LIMIT 1
        `, [applicationId, documentTypes.normalizeDocumentType(documentKey)]);
        return mapRequestRow(result.rows[0]);
    } finally { client.release(); }
};

exports.getCandidate = async ({ applicationId, documentKey, requestId = null }) => {
    await ensureIotOcrSchema();
    const client = await pool.connect();
    try {
        const params = [applicationId, documentTypes.normalizeDocumentType(documentKey)];
        const requestFilter = requestId ? 'AND r.request_id = $3::uuid' : '';
        if (requestId) params.push(requestId);
        const result = await client.query(`
            SELECT r.*, c.candidate_id, c.raw_text, c.fields, c.field_confidence,
                   c.validation_issues, c.processing, c.created_at AS candidate_created_at
            FROM public.iot_ocr_requests r
            LEFT JOIN public.iot_ocr_candidates c ON c.request_id = r.request_id
            WHERE r.application_id = $1::uuid AND r.document_key = $2 ${requestFilter}
            ORDER BY r.created_at DESC LIMIT 1
        `, params);
        if (!result.rows.length) return null;
        const row = result.rows[0];
        const candidate = row.candidate_id ? mapCandidateRow({
            ...row,
            created_at: row.candidate_created_at,
        }) : null;
        return { request: mapRequestRow(row), candidate };
    } finally { client.release(); }
};

exports.confirmCandidate = async ({ applicationId, documentKey, requestId, correctedFields, reviewedBy }) => {
    await ensureIotOcrSchema();
    const reviewerId = normalizeUserId(reviewedBy);
    const normalizedDocumentKey = documentTypes.normalizeDocumentType(documentKey);
    if (!reviewerId || !isUuid(requestId)) throw buildHttpError(400, 'Valid reviewer and request are required');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const selected = await client.query(`
            SELECT r.*, c.candidate_id FROM public.iot_ocr_requests r
            JOIN public.iot_ocr_candidates c ON c.request_id = r.request_id
            WHERE r.request_id = $1::uuid AND r.application_id = $2::uuid AND r.document_key = $3
            FOR UPDATE OF r
        `, [requestId, applicationId, normalizedDocumentKey]);
        const row = selected.rows[0];
        if (!row) throw buildHttpError(404, 'IoT OCR candidate not found');
        if (row.status === 'completed') {
            await client.query('COMMIT');
            return { request: mapRequestRow(row), idempotent: true };
        }
        if (!transitionAllowed(row.status, 'completed')) throw buildHttpError(409, `OCR request cannot be confirmed from ${row.status}`);
        const verifiedFields = validateConfirmedDocumentFields(normalizedDocumentKey, correctedFields);
        await client.query(`
            INSERT INTO public.iot_ocr_reviews
                (request_id, application_id, document_key, verified_fields, reviewed_by)
            VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::uuid)
            ON CONFLICT (request_id) DO NOTHING
        `, [requestId, applicationId, normalizedDocumentKey, JSON.stringify(verifiedFields), reviewerId]);
        const updated = await client.query(`
            UPDATE public.iot_ocr_requests SET status = 'completed', reviewed_by = $2::uuid,
                reviewed_at = NOW(), completed_at = NOW(), updated_at = NOW()
            WHERE request_id = $1::uuid RETURNING *
        `, [requestId, reviewerId]);
        await client.query('COMMIT');
        return { request: mapRequestRow(updated.rows[0]), verified_fields: verifiedFields, idempotent: false };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
};

exports.retryRequest = async ({ applicationId, documentKey, requestId, requestedBy }) => {
    await ensureIotOcrSchema();
    const requesterId = normalizeUserId(requestedBy);
    const normalizedDocumentKey = documentTypes.normalizeDocumentType(documentKey);
    if (!requesterId || !isUuid(requestId)) throw buildHttpError(400, 'Valid requester and previous request are required');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const previousResult = await client.query(`
            SELECT * FROM public.iot_ocr_requests
            WHERE request_id = $1::uuid AND application_id = $2::uuid AND document_key = $3
            FOR UPDATE
        `, [requestId, applicationId, normalizedDocumentKey]);
        const previous = previousResult.rows[0];
        if (!previous) throw buildHttpError(404, 'Previous OCR request not found');
        const active = await client.query(`
            SELECT * FROM public.iot_ocr_requests
            WHERE application_id = $1::uuid AND document_key = $2
              AND status IN (${ACTIVE_STATUS_SQL})
            ORDER BY created_at DESC LIMIT 1
        `, [applicationId, normalizedDocumentKey]);
        if (active.rows.length) {
            await client.query('COMMIT');
            return { request: mapRequestRow(active.rows[0]), created: false };
        }
        const inserted = await client.query(`
            INSERT INTO public.iot_ocr_requests
                (application_id, student_id, student_name, document_key, document_type,
                 status, requested_by, retry_of_request_id)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'pending', $6::uuid, $7::uuid)
            RETURNING *
        `, [previous.application_id, previous.student_id, previous.student_name,
            previous.document_key, previous.document_type, requesterId, previous.request_id]);
        await client.query('COMMIT');
        return { request: mapRequestRow(inserted.rows[0]), created: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
};

module.exports = {
    ...exports,
    ALLOWED_TRANSITIONS,
    PI_ACTIVE_STATUSES,
    TERMINAL_STATUSES,
    assertTextOnlyPayload,
    validateConfirmedDocumentFields,
};
