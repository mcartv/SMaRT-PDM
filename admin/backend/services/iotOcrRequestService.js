const pool = require('../config/db');
const documentTypes = require('../utils/documentTypes');
const { normalizeDeviceId, normalizeUserId } = require('../utils/iotOcrIdentity');
const { isMarilaoLocation } = require('../utils/marilaoResidency');
const { ensureIotOcrSchema } = require('./iotOcrSchemaService');

const PI_ACTIVE_STATUSES = Object.freeze([
    'pending', 'claimed', 'previewing', 'focusing', 'capturing', 'processing',
]);
const TERMINAL_STATUSES = Object.freeze(['completed', 'cancelled', 'failed', 'expired']);
const IOT_OCR_DISABLED_DOCUMENT_KEYS = Object.freeze([
    'application_form',
    'certificate_of_registration',
    'letter_of_request',
]);
const ALLOWED_TRANSITIONS = Object.freeze({
    pending: Object.freeze(['claimed', 'expired', 'cancelled']),
    claimed: Object.freeze(['previewing', 'cancelled', 'failed', 'expired']),
    previewing: Object.freeze(['focusing', 'capturing', 'cancelled', 'failed', 'expired']),
    focusing: Object.freeze(['capturing', 'cancelled', 'failed', 'expired']),
    capturing: Object.freeze(['processing', 'cancelled', 'failed', 'expired']),
    processing: Object.freeze(['review_required', 'cancelled', 'failed', 'expired']),
    review_required: Object.freeze(['completed', 'expired']),
});
const ACTIVE_STATUS_SQL = PI_ACTIVE_STATUSES.map((status) => `'${status}'`).join(', ');
const FORBIDDEN_PAYLOAD_KEYS = new Set([
    'image', 'image_url', 'capture_url', 'capture_path', 'processed_image',
    'processed_image_url', 'base64_image',
]);

function buildHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function isIotOcrDocumentEnabled(documentKey) {
    const normalized = documentTypes.normalizeDocumentType(documentKey);
    return Boolean(
        normalized && !IOT_OCR_DISABLED_DOCUMENT_KEYS.includes(normalized)
    );
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
        expires_at: null,
    };
}

function mapCandidateRow(row) {
    if (!row) return null;
    const storedFields = row.verified_fields || row.fields || {};
    return {
        candidate_id: row.candidate_id,
        request_id: row.request_id,
        status: row.status === 'completed' ? 'completed' : 'review_required',
        document_key: row.document_key,
        template_id: row.template_id,
        raw_text: row.raw_text || '',
        fields: withDerivedIndigencyFields(
            row.document_key,
            row.raw_text,
            withDerivedGradeFields(row.document_key, row.raw_text, storedFields)
        ),
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

function fieldValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value.normalized_value ?? value.raw_text ?? value.value ?? '';
    }
    return value;
}

function gradeField(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return { raw_text: normalized, normalized_value: normalized };
}

function withDerivedGradeFields(documentKey, rawText, storedFields = {}) {
    const normalizedKey = documentTypes.normalizeDocumentType(documentKey);
    const source = storedFields && typeof storedFields === 'object' && !Array.isArray(storedFields)
        ? storedFields
        : {};
    if (normalizedKey !== 'student_grade_forms') return source;

    const fields = { ...source, subjects: Array.isArray(source.subjects) ? source.subjects : [] };
    const missing = (key) => !String(fieldValue(fields[key]) ?? '').trim();
    const text = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!text) return fields;

    const numberMatch = text.match(/\b((?:PDM[-\s]?)?\d{4}[-\s]\d{4,7})\b/i);
    if (numberMatch && missing('student_number')) {
        fields.student_number = gradeField(numberMatch[1].replace(/\s+/g, '-').toUpperCase());
    }

    const identityMatch = text.match(
        /STUDENT\s+NUMBER\s+STUDENT\s+NAME\s+COURSE\s*[:|\-]?\s*(?:PDM[-\s]?)?\d{4}[-\s]\d{4,7}\s+(.+?)\s+COPY\s+OF\s+GRADE(?:\s*FOR)?\b/i
    );
    if (identityMatch) {
        const identity = identityMatch[1].replace(/\s+,/g, ',').trim();
        const parts = identity.match(/^(.+?)\s+((?:BS|AB|B)[A-Z][A-Z0-9.-]{1,12})$/i);
        if (parts) {
            if (missing('student_name')) fields.student_name = gradeField(parts[1]);
            if (missing('course')) fields.course = gradeField(parts[2]);
        }
    }

    const periodText = text.replace(
        /\bTHE\s*PERI[O0D]{2}\b/gi,
        'THE PERIOD'
    );
    const periodMatch = periodText.match(
        /GRADE\s*FOR\s+THE\s+PERIOD\s*[:\-]?\s*(1ST|2ND|FIRST|SECOND|SUMMER)?(?:\s+SEMESTER)?\s+(\d{4}\s*[-–]\s*\d{4})/i
    );
    if (periodMatch) {
        const semester = {
            '1ST': '1st Semester',
            '2ND': '2nd Semester',
            'FIRST': 'First Semester',
            'SECOND': 'Second Semester',
            'SUMMER': 'Summer',
        }[String(periodMatch[1] || '').toUpperCase()];
        if (semester && missing('semester')) fields.semester = gradeField(semester);
        if (missing('academic_year')) {
            fields.academic_year = gradeField(periodMatch[2].replace(/\s*[-–]\s*/g, '-'));
        }
    }

    const gwaMatch = text.match(
        /\b(?:G\s*W\s*A|[O0]\s*W\s*A)(?:\s+SCORE)?\b\s*[:;=.\-|]?\s*([1-5])(?:\s*[.,]\s*|\s+)?(\d{1,2})?\b/i
    );
    if (gwaMatch && missing('gwa')) {
        fields.gwa = gradeField(gwaMatch[1] + (gwaMatch[2] ? `.${gwaMatch[2]}` : ''));
    }
    return fields;
}

function withDerivedIndigencyFields(documentKey, rawText, storedFields = {}) {
    const normalizedKey = documentTypes.normalizeDocumentType(documentKey);
    const source = storedFields && typeof storedFields === 'object' && !Array.isArray(storedFields)
        ? storedFields
        : {};
    if (normalizedKey !== 'certificate_of_indigency') return source;

    const fields = { ...source };
    const missing = (key) => !String(fieldValue(fields[key]) ?? '').trim();
    const text = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!text) return fields;

    const subject = text.match(
        /Certificate\s+Subject\s+Name\s*[:\-]?\s*(.+?)(?=\s+Full\s+Address\s*[:\-]?|\s+Issue\s+Date\s*[:\-]?|\s+Issuing\s+Barangay\s*[:\-]?|$)/i
    );
    if (subject && missing('certificate_subject_name')) {
        fields.certificate_subject_name = gradeField(subject[1].replace(/\s+,/g, ',').trim());
    }

    const address = text.match(
        /Full\s+Address\s*[:\-]?\s*(.+?)(?=\s+Issue\s+Date\s*[:\-]?|\s+Issuing\s+Barangay\s*[:\-]?|$)/i
    );
    if (address && missing('residency_address')) {
        fields.residency_address = gradeField(address[1].trim());
    }

    delete fields.issue_date;
    delete fields.issuing_barangay;
    return fields;
}

function normalizeGwa(value) {
    const raw = String(fieldValue(value) ?? '').trim();
    const numeric = Number(raw);
    if (!raw || !Number.isFinite(numeric) || numeric < 1 || numeric > 5) {
        throw buildHttpError(400, 'GWA must be a valid number from 1.00 to 5.00');
    }
    return Number(numeric.toFixed(2));
}

function normalizeAcademicYear(value) {
    const raw = String(fieldValue(value) ?? '').trim();
    const match = raw.match(/^(\d{4})\s*[-–—]\s*(\d{4})$/);
    if (!match || Number(match[2]) !== Number(match[1]) + 1) {
        throw buildHttpError(400, 'Academic Year must use the format YYYY-YYYY');
    }
    return `${match[1]}-${match[2]}`;
}

async function persistVerifiedGradeSummary(client, studentId, verifiedFields) {
    const gwa = normalizeGwa(verifiedFields.gwa);
    const academicYear = normalizeAcademicYear(verifiedFields.academic_year);
    const yearResult = await client.query(`
        SELECT academic_year_id
        FROM public.academic_years
        WHERE LOWER(TRIM(label)) = LOWER($1)
        LIMIT 1
    `, [academicYear]);
    const academicYearId = yearResult.rows[0]?.academic_year_id;
    if (!academicYearId) {
        throw buildHttpError(
            409,
            `Academic Year ${academicYear} is not configured in SMaRT-PDM`
        );
    }
    await client.query(`
        UPDATE public.students
        SET gwa = $2,
            active_academic_year_id = $3::uuid
        WHERE student_id = $1::uuid
    `, [studentId, gwa, academicYearId]);
    return { gwa, academic_year: academicYear };
}

function birthNameComponents(value, { required = true, label = 'Name' } = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const components = source.components && typeof source.components === 'object'
        ? source.components
        : source;
    let firstName = String(components.first_name ?? '').trim();
    let middleName = String(components.middle_name ?? '').trim();
    let lastName = String(components.last_name ?? '').trim();

    if (!firstName && !lastName) {
        const raw = String(fieldValue(value) ?? '').replace(/\s+/g, ' ').trim();
        const parts = raw.split(' ').filter(Boolean);
        if (parts.length === 1) firstName = parts[0];
        if (parts.length >= 2) {
            firstName = parts[0];
            lastName = parts[parts.length - 1];
            middleName = parts.slice(1, -1).join(' ');
        }
    }

    if (required && (!firstName || !lastName)) {
        throw buildHttpError(400, `${label} requires first_name and last_name`);
    }
    return {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
    };
}

async function upsertVerifiedBirthParents(client, studentId, verifiedFields) {
    const parents = [
        ['Mother', verifiedFields.mother_maiden_name],
        ['Father', verifiedFields.father_name],
    ];
    for (const [relation, name] of parents) {
        if (!name?.first_name || !name?.last_name) continue;
        await client.query(`
            INSERT INTO public.student_family
                (student_id, relation, first_name, middle_name, last_name, updated_at)
            VALUES ($1::uuid, $2, $3, NULLIF($4, ''), $5, NOW())
            ON CONFLICT (student_id, relation) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                middle_name = EXCLUDED.middle_name,
                last_name = EXCLUDED.last_name,
                updated_at = NOW()
        `, [studentId, relation, name.first_name, name.middle_name, name.last_name]);
    }
}

function buildVerifiedApplicationPatch(documentKey, verifiedFields = {}) {
    if (documentKey === 'student_grade_forms') {
        return {
            student: {
                gwa: normalizeGwa(verifiedFields.gwa),
                academic_year: normalizeAcademicYear(verifiedFields.academic_year),
            },
        };
    }
    if (documentKey === 'certificate_of_indigency') {
        return {
            student: {
                marilao_resident: isMarilaoLocation(
                    verifiedFields.residency_address
                    ?? verifiedFields.full_address
                    ?? verifiedFields.address
                ),
            },
        };
    }
    return null;
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
    candidate.fields = withDerivedGradeFields(
        candidate.document_key,
        candidate.raw_text,
        candidate.fields
    );
    candidate.fields = withDerivedIndigencyFields(
        candidate.document_key,
        candidate.raw_text,
        candidate.fields
    );
    assertTextOnlyPayload(candidate);
    return candidate;
}

function validateConfirmedDocumentFields(documentKey, fields, candidateFields = null) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        throw buildHttpError(400, 'corrected_fields must be an object');
    }
    assertTextOnlyPayload(fields);

    const requiredByDocument = {
        birth_certificate: ['child_name', 'mother_maiden_name', 'father_name'],
        certificate_of_live_birth: ['child_name', 'mother_maiden_name', 'father_name'],
        certificate_of_indigency: [
            'certificate_subject_name',
            'residency_address',
        ],
        student_grade_forms: [
            'student_number',
            'academic_year',
            'subjects',
            'gwa',
        ],
    };
    const required = requiredByDocument[documentKey];
    if (!required) throw buildHttpError(400, 'Unsupported OCR document contract');
    const missing = required.filter((key) => (
        fields[key] === undefined
        || fields[key] === null
        || (
            key !== 'subjects'
            && ['certificate_of_indigency', 'student_grade_forms'].includes(documentKey)
            && !String(fieldValue(fields[key]) ?? '').trim()
        )
    ));
    if (missing.length) throw buildHttpError(400, `Missing confirmed OCR fields: ${missing.join(', ')}`);
    if (['birth_certificate', 'certificate_of_live_birth'].includes(documentKey)) {
        const fatherSource = fields.father_name;
        const fatherStatus = String(fatherSource?.section_status ?? '').toLowerCase();
        const fatherRequired = fatherStatus !== 'not_applicable';
        return {
            child_name: birthNameComponents(fields.child_name, {
                label: 'Child name',
            }),
            mother_maiden_name: birthNameComponents(fields.mother_maiden_name, {
                label: "Mother's maiden name",
            }),
            father_name: birthNameComponents(fields.father_name, {
                required: fatherRequired,
                label: "Father's name",
            }),
        };
    }
    if (documentKey === 'certificate_of_indigency') {
        return Object.fromEntries(required.map((key) => [key, fields[key]]));
    }
    if (documentKey === 'student_grade_forms' && !Array.isArray(fields.subjects)) {
        throw buildHttpError(400, 'subjects must be an array');
    }
    if (documentKey !== 'student_grade_forms') return fields;

    const candidateGwa = normalizeGwa(candidateFields?.gwa);
    const submittedGwa = normalizeGwa(fields.gwa);
    if (candidateGwa !== submittedGwa) {
        throw buildHttpError(409, 'GWA is read-only. Retry OCR if the detected value is incorrect.');
    }
    return {
        student_number: String(fieldValue(fields.student_number) ?? '').trim(),
        academic_year: normalizeAcademicYear(fields.academic_year),
        subjects: fields.subjects,
        gwa: candidateGwa.toFixed(2),
    };
}

async function resolveRequestContext(client, applicationId, documentKey) {
    const normalizedDocumentKey = documentTypes.normalizeDocumentType(documentKey);
    if (!applicationId || !normalizedDocumentKey) throw buildHttpError(400, 'Valid application and document are required');
    if (!isIotOcrDocumentEnabled(normalizedDocumentKey)) {
        throw buildHttpError(400, 'IoT OCR is unavailable for this document');
    }
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
            const heartbeat = await client.query(`
                UPDATE public.iot_ocr_requests
                SET processing_heartbeat_at = NOW(), updated_at = NOW()
                WHERE request_id = $1::uuid RETURNING *
            `, [requestId]);
            await client.query('COMMIT');
            return mapRequestRow(heartbeat.rows[0]);
        }
        if (!transitionAllowed(row.status, nextStatus) || nextStatus === 'review_required' || nextStatus === 'completed') {
            const error = buildHttpError(409, `Invalid IoT OCR transition: ${row.status} -> ${nextStatus}`);
            if (TERMINAL_STATUSES.includes(row.status) || row.status === 'review_required') {
                error.code = 'IOT_OCR_REQUEST_STOPPED';
                error.currentStatus = row.status;
                error.request = mapRequestRow(row);
            }
            throw error;
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

        if (TERMINAL_STATUSES.includes(row.status)) {
            const error = buildHttpError(409, `Cannot submit OCR result from ${row.status}`);
            error.code = 'IOT_OCR_REQUEST_STOPPED';
            error.currentStatus = row.status;
            error.request = mapRequestRow(row);
            throw error;
        }

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
                   c.validation_issues, c.processing, c.created_at AS candidate_created_at,
                   v.verified_fields
            FROM public.iot_ocr_requests r
            LEFT JOIN public.iot_ocr_candidates c ON c.request_id = r.request_id
            LEFT JOIN public.iot_ocr_reviews v ON v.request_id = r.request_id
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

exports.cancelRequest = async ({ applicationId, documentKey, requestId }) => {
    const normalizedDocumentKey = documentTypes.normalizeDocumentType(documentKey);
    if (!isUuid(requestId) || !isUuid(applicationId) || !normalizedDocumentKey) {
        throw buildHttpError(400, 'Valid application, document, and request are required');
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const selected = await client.query(`
            SELECT * FROM public.iot_ocr_requests
            WHERE request_id = $1::uuid AND application_id = $2::uuid AND document_key = $3
            FOR UPDATE
        `, [requestId, applicationId, normalizedDocumentKey]);
        const row = selected.rows[0];
        if (!row) throw buildHttpError(404, 'IoT OCR request not found');
        if (row.status === 'cancelled') {
            await client.query('COMMIT');
            return { request: mapRequestRow(row), idempotent: true };
        }
        if (!PI_ACTIVE_STATUSES.includes(row.status) || !transitionAllowed(row.status, 'cancelled')) {
            throw buildHttpError(409, `OCR request cannot be cancelled from ${row.status}`);
        }
        const updated = await client.query(`
            UPDATE public.iot_ocr_requests
            SET status = 'cancelled', error_code = 'ADMIN_CANCELLED',
                error_message = 'OCR capture cancelled by admin',
                completed_at = NOW(), updated_at = NOW()
            WHERE request_id = $1::uuid RETURNING *
        `, [requestId]);
        await client.query('COMMIT');
        return { request: mapRequestRow(updated.rows[0]), idempotent: false };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
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
            SELECT r.*, c.candidate_id, c.fields AS candidate_fields,
                   c.raw_text AS candidate_raw_text
            FROM public.iot_ocr_requests r
            JOIN public.iot_ocr_candidates c ON c.request_id = r.request_id
            WHERE r.request_id = $1::uuid AND r.application_id = $2::uuid AND r.document_key = $3
            FOR UPDATE OF r
        `, [requestId, applicationId, normalizedDocumentKey]);
        const row = selected.rows[0];
        if (!row) throw buildHttpError(404, 'IoT OCR candidate not found');
        if (row.status === 'completed') {
            const reviewResult = await client.query(`
                SELECT verified_fields FROM public.iot_ocr_reviews
                WHERE request_id = $1::uuid LIMIT 1
            `, [requestId]);
            const verifiedFields = reviewResult.rows[0]?.verified_fields || {};
            await client.query('COMMIT');
            return {
                request: mapRequestRow(row),
                verified_fields: verifiedFields,
                application_patch: buildVerifiedApplicationPatch(
                    normalizedDocumentKey,
                    verifiedFields
                ),
                idempotent: true,
            };
        }
        if (!transitionAllowed(row.status, 'completed')) throw buildHttpError(409, `OCR request cannot be confirmed from ${row.status}`);
        const verifiedFields = validateConfirmedDocumentFields(
            normalizedDocumentKey,
            correctedFields,
            withDerivedIndigencyFields(
                normalizedDocumentKey,
                row.candidate_raw_text,
                withDerivedGradeFields(
                    normalizedDocumentKey,
                    row.candidate_raw_text,
                    row.candidate_fields
                )
            )
        );
        await client.query(`
            INSERT INTO public.iot_ocr_reviews
                (request_id, application_id, document_key, verified_fields, reviewed_by)
            VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::uuid)
            ON CONFLICT (request_id) DO NOTHING
        `, [requestId, applicationId, normalizedDocumentKey, JSON.stringify(verifiedFields), reviewerId]);
        const applicationPatch = buildVerifiedApplicationPatch(
            normalizedDocumentKey,
            verifiedFields
        );
        if (normalizedDocumentKey === 'student_grade_forms') {
            await persistVerifiedGradeSummary(
                client,
                row.student_id,
                verifiedFields
            );
        }
        if (normalizedDocumentKey === 'birth_certificate') {
            await upsertVerifiedBirthParents(client, row.student_id, verifiedFields);
        }
        const updated = await client.query(`
            UPDATE public.iot_ocr_requests SET status = 'completed', reviewed_by = $2::uuid,
                reviewed_at = NOW(), completed_at = NOW(), updated_at = NOW()
            WHERE request_id = $1::uuid RETURNING *
        `, [requestId, reviewerId]);
        await client.query('COMMIT');
        return {
            request: mapRequestRow(updated.rows[0]),
            verified_fields: verifiedFields,
            application_patch: applicationPatch,
            idempotent: false,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
};

exports.retryRequest = async ({ applicationId, documentKey, requestId, requestedBy }) => {
    await ensureIotOcrSchema();
    const requesterId = normalizeUserId(requestedBy);
    const normalizedDocumentKey = documentTypes.normalizeDocumentType(documentKey);
    if (!isIotOcrDocumentEnabled(normalizedDocumentKey)) {
        throw buildHttpError(400, 'IoT OCR is unavailable for this document');
    }
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
    normalizeGwa,
    normalizeAcademicYear,
    birthNameComponents,
    upsertVerifiedBirthParents,
    buildVerifiedApplicationPatch,
    persistVerifiedGradeSummary,
    withDerivedGradeFields,
    withDerivedIndigencyFields,
    IOT_OCR_DISABLED_DOCUMENT_KEYS,
    isIotOcrDocumentEnabled,
};
