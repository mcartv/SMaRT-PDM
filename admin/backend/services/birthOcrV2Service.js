const crypto = require('crypto');

const pool = require('../config/db');
const supabase = require('../config/supabase');
const iotOcrRequestService = require('./iotOcrRequestService');

const BUCKET = String(process.env.IOT_OCR_CAPTURE_BUCKET || 'iot-ocr-captures').trim();
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
const GEMINI_TIMEOUT_MS = Math.max(5000, Number(process.env.GEMINI_TIMEOUT_MS || 30000));
const MAX_ARTIFACT_BYTES = 15 * 1024 * 1024;
const REVIEW_GROUPS = new Set([
    'ready_to_confirm', 'low_confidence', 'missing_field',
    'failed_validation', 'duplicate_suspicion', 'diagnostic_only',
]);
const REVIEW_PRIORITIES = new Set(['compliance_hold', 'customer_facing', 'standard']);
const CELL_KEYS = Object.freeze([
    'item1_first', 'item1_middle', 'item1_last',
    'item6_first', 'item6_middle', 'item6_last',
    'item13_first', 'item13_middle', 'item13_last',
]);
const RESPONSE_KEYS = Object.freeze([
    'child_first_name', 'child_middle_name', 'child_last_name',
    'mothers_maiden_first', 'mothers_maiden_middle', 'mothers_maiden_last',
    'father_first_name', 'father_middle_name', 'father_last_name',
]);
const RESPONSE_SCHEMA = Object.freeze({
    type: 'object',
    properties: {
        template_id: { type: 'string', enum: ['psa_birth_v1'] },
        raw_text: { type: 'string' },
        fields: {
            type: 'object',
            properties: Object.fromEntries(RESPONSE_KEYS.map((key) => [key, { type: 'string' }])),
            required: RESPONSE_KEYS,
            additionalProperties: false,
        },
    },
    required: ['template_id', 'raw_text', 'fields'],
    additionalProperties: false,
});

function httpError(statusCode, message, code = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

function normalizeHash(value) {
    const hash = String(value || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hash)) throw httpError(400, 'Invalid artifact hash');
    return hash;
}

function normalizeMime(value) {
    const mime = String(value || '').trim().toLowerCase();
    if (!['image/jpeg', 'image/png'].includes(mime)) throw httpError(400, 'Unsupported artifact MIME type');
    return mime;
}

function bytesMatchMime(bytes, mimeType) {
    if (mimeType === 'image/jpeg') {
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mimeType === 'image/png') {
        const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        return bytes.length >= signature.length && bytes.subarray(0, signature.length).equals(signature);
    }
    return false;
}

function normalizePolygon(value) {
    if (value == null) return null;
    if (!Array.isArray(value) || value.length !== 4) throw httpError(400, 'ROI polygon must have four points');
    return value.map((point) => {
        if (!Array.isArray(point) || point.length !== 2) throw httpError(400, 'Invalid ROI point');
        const x = Number(point[0]);
        const y = Number(point[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 1 || y > 1) {
            throw httpError(400, 'ROI coordinates must be normalized');
        }
        return [x, y];
    });
}

function validateManifest(artifacts) {
    if (!Array.isArray(artifacts) || artifacts.length !== 10) {
        throw httpError(400, 'Birth V2 requires one original and exactly nine cell artifacts');
    }
    const normalized = artifacts.map((artifact) => {
        const kind = String(artifact?.artifact_kind || '').trim();
        const cellKey = kind === 'cell' ? String(artifact?.cell_key || '').trim() : null;
        const byteCount = Number(artifact?.byte_count);
        if (!Number.isInteger(byteCount) || byteCount < 1 || byteCount > MAX_ARTIFACT_BYTES) {
            throw httpError(400, 'Invalid artifact size');
        }
        if (kind !== 'original' && kind !== 'cell') throw httpError(400, 'Invalid artifact kind');
        if (kind === 'cell' && !CELL_KEYS.includes(cellKey)) throw httpError(400, 'Invalid Birth cell key');
        if (kind === 'original' && artifact?.cell_key) throw httpError(400, 'Original artifact cannot have a cell key');
        const mimeType = normalizeMime(artifact?.mime_type);
        if (kind === 'original' && mimeType !== 'image/jpeg') throw httpError(400, 'Birth original must be JPEG');
        if (kind === 'cell' && mimeType !== 'image/png') throw httpError(400, 'Birth cells must be PNG');
        return {
            artifact_kind: kind,
            cell_key: cellKey,
            mime_type: mimeType,
            byte_count: byteCount,
            sha256: normalizeHash(artifact?.sha256),
            roi_polygon: kind === 'cell' ? normalizePolygon(artifact?.roi_polygon) : null,
        };
    });
    if (normalized.filter(({ artifact_kind }) => artifact_kind === 'original').length !== 1) {
        throw httpError(400, 'Birth V2 requires exactly one original artifact');
    }
    const cells = normalized.filter(({ artifact_kind }) => artifact_kind === 'cell').map(({ cell_key }) => cell_key);
    if (new Set(cells).size !== CELL_KEYS.length || CELL_KEYS.some((key) => !cells.includes(key))) {
        throw httpError(400, 'Birth V2 artifact manifest is incomplete');
    }
    return normalized;
}

async function ensurePrivateBucket() {
    const { data, error } = await supabase.storage.getBucket(BUCKET);
    if (error && !String(error.message || '').toLowerCase().includes('not found')) throw error;
    if (!data) {
        const created = await supabase.storage.createBucket(BUCKET, {
            public: false,
            allowedMimeTypes: ['image/jpeg', 'image/png'],
            fileSizeLimit: MAX_ARTIFACT_BYTES,
        });
        if (created.error) throw created.error;
        return;
    }
    if (data.public) throw new Error('IoT OCR capture bucket must remain private');
}

async function lockV2Request(client, requestId, deviceId) {
    const result = await client.query(
        'SELECT * FROM public.iot_ocr_requests WHERE request_id = $1::uuid FOR UPDATE',
        [requestId]
    );
    const request = result.rows[0];
    if (!request) throw httpError(404, 'IoT OCR request not found');
    if (request.document_key !== 'birth_certificate' || request.ocr_version !== 'v2') {
        throw httpError(409, 'Capture upload is only available for Birth OCR V2');
    }
    if (String(request.claimed_by || '') !== String(deviceId || '')) {
        throw httpError(409, 'Request belongs to another Pi device');
    }
    if (request.status !== 'processing') throw httpError(409, `Cannot upload artifacts from ${request.status}`);
    return request;
}

exports.authorizeUploads = async ({ requestId, deviceId, artifacts }) => {
    const manifest = validateManifest(artifacts);
    await ensurePrivateBucket();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await lockV2Request(client, requestId, deviceId);
        const authorizations = [];
        for (const artifact of manifest) {
            const artifactId = crypto.randomUUID();
            const extension = artifact.mime_type === 'image/png' ? 'png' : 'jpg';
            const objectPath = `${requestId}/${artifactId}.${extension}`;
            const inserted = await client.query(`
                INSERT INTO public.iot_ocr_capture_artifacts
                    (artifact_id, request_id, artifact_kind, cell_key, bucket_name,
                     object_path, mime_type, byte_count, sha256, roi_polygon, device_id)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::uuid)
                ON CONFLICT (request_id, artifact_kind, (coalesce(cell_key, '')))
                DO UPDATE SET
                    mime_type = EXCLUDED.mime_type,
                    byte_count = EXCLUDED.byte_count,
                    sha256 = EXCLUDED.sha256,
                    roi_polygon = EXCLUDED.roi_polygon,
                    updated_at = NOW()
                RETURNING artifact_id, object_path
            `, [artifactId, requestId, artifact.artifact_kind, artifact.cell_key, BUCKET,
                objectPath, artifact.mime_type, artifact.byte_count, artifact.sha256,
                JSON.stringify(artifact.roi_polygon), deviceId]);
            const row = inserted.rows[0];
            const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(row.object_path, { upsert: true });
            if (signed.error) throw signed.error;
            authorizations.push({
                artifact_id: row.artifact_id,
                artifact_kind: artifact.artifact_kind,
                cell_key: artifact.cell_key,
                signed_url: signed.data.signedUrl,
                token: signed.data.token,
            });
        }
        await client.query('COMMIT');
        return { request_id: requestId, artifacts: authorizations };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

async function downloadAndVerifyArtifacts(requestId) {
    const result = await pool.query(`
        SELECT * FROM public.iot_ocr_capture_artifacts
        WHERE request_id = $1::uuid ORDER BY artifact_kind, cell_key
    `, [requestId]);
    if (result.rows.length !== 10) throw httpError(409, 'Birth V2 artifacts are incomplete');
    const verified = [];
    for (const row of result.rows) {
        const downloaded = await supabase.storage.from(row.bucket_name).download(row.object_path);
        if (downloaded.error || !downloaded.data) throw httpError(409, 'Birth V2 artifact upload is incomplete');
        const bytes = Buffer.from(await downloaded.data.arrayBuffer());
        const digest = crypto.createHash('sha256').update(bytes).digest('hex');
        if (bytes.length !== Number(row.byte_count) || digest !== row.sha256
            || !bytesMatchMime(bytes, row.mime_type)) {
            throw httpError(409, 'Birth V2 artifact integrity check failed', 'ARTIFACT_INTEGRITY_FAILED');
        }
        verified.push({ ...row, bytes });
    }
    await pool.query(`
        UPDATE public.iot_ocr_capture_artifacts
        SET upload_status = 'available', uploaded_at = COALESCE(uploaded_at, NOW()), updated_at = NOW()
        WHERE request_id = $1::uuid
    `, [requestId]);
    return verified;
}

async function assertRequestStillProcessing(requestId, deviceId) {
    const result = await pool.query(`
        SELECT status, claimed_by
        FROM public.iot_ocr_requests
        WHERE request_id = $1::uuid
        LIMIT 1
    `, [requestId]);
    const request = result.rows[0];
    if (!request) throw httpError(404, 'IoT OCR request not found');
    if (String(request.claimed_by || '') !== String(deviceId || '')) {
        throw httpError(409, 'Request belongs to another Pi device');
    }
    if (request.status !== 'processing') {
        throw httpError(409, `Birth V2 extraction stopped from ${request.status}`, 'IOT_OCR_REQUEST_STOPPED');
    }
}

function validateGeminiPayload(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== 3 || value.template_id !== 'psa_birth_v1'
        || typeof value.raw_text !== 'string'
        || !value.fields || typeof value.fields !== 'object' || Array.isArray(value.fields)) return null;
    const keys = Object.keys(value.fields).sort();
    if (keys.length !== RESPONSE_KEYS.length || RESPONSE_KEYS.some((key) => !keys.includes(key))) return null;
    const normalized = {};
    for (const key of RESPONSE_KEYS) {
        if (typeof value.fields[key] !== 'string') return null;
        normalized[key] = value.fields[key];
    }
    return normalized;
}

function hasRequiredNames(value) {
    return [
        value?.child_first_name,
        value?.child_last_name,
        value?.mothers_maiden_first,
        value?.mothers_maiden_last,
    ].every((entry) => String(entry || '').trim());
}

function buildRawSnapshot(result) {
    if (String(result?.raw_text || '').trim()) {
        return String(result.raw_text).trim();
    }
    return [
        [result.child_first_name, result.child_middle_name, result.child_last_name],
        [result.mothers_maiden_first, result.mothers_maiden_middle, result.mothers_maiden_last],
        [result.father_first_name, result.father_middle_name, result.father_last_name],
    ].map((row) => row.join('\t')).join('\n');
}

async function callGemini(cells) {
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return { ok: false, code: 'GEMINI_KEY_MISSING' };
    let GoogleGenAI;
    try {
        ({ GoogleGenAI } = require('@google/genai'));
    } catch {
        return { ok: false, code: 'GEMINI_DEPENDENCY_MISSING' };
    }
    const client = new GoogleGenAI({ apiKey });
    const parts = [{ text: [
        'Extract text only from the nine PSA birth certificate name cells.',
        'The images follow Item 1, Item 6, Item 13 and First, Middle, Last order.',
        'Keep compound names inside their printed cell. Return empty string for blank cells.',
        'Also include raw_text as a best-effort transcription of the nine cells in physical order,',
        'using tabs between first, middle, and last, and newlines between rows.',
        'Return only the required JSON schema.',
    ].join(' ') }];
    for (const key of CELL_KEYS) {
        const artifact = cells.find((entry) => entry.cell_key === key);
        parts.push({ text: `Cell ${key}` });
        parts.push({ inlineData: { mimeType: artifact.mime_type, data: artifact.bytes.toString('base64') } });
    }
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(
            () => reject(Object.assign(new Error('timeout'), { code: 'GEMINI_TIMEOUT' })),
            GEMINI_TIMEOUT_MS
        );
    });
    try {
        const response = await Promise.race([
            client.models.generateContent({
                model: GEMINI_MODEL,
                contents: [{ role: 'user', parts }],
                config: { responseMimeType: 'application/json', responseJsonSchema: RESPONSE_SCHEMA },
            }),
            timeout,
        ]);
        const raw = typeof response.text === 'function' ? response.text() : response.text;
        const parsed = validateGeminiPayload(JSON.parse(String(raw || '')));
        if (!parsed) return { ok: false, code: 'GEMINI_INVALID_RESULT' };
        if (!hasRequiredNames(parsed)) {
            return { ok: false, code: 'GEMINI_REQUIRED_NAME_MISSING', value: parsed };
        }
        return { ok: true, value: parsed };
    } catch (error) {
        return { ok: false, code: error.code === 'GEMINI_TIMEOUT' ? 'GEMINI_TIMEOUT' : 'GEMINI_REQUEST_FAILED' };
    } finally {
        clearTimeout(timeoutId);
    }
}

function field(raw, first, middle, last, status = 'detected') {
    return {
        raw_text: raw,
        normalized_value: raw,
        components: { first_name: first || null, middle_name: middle || null, last_name: last || null },
        component_confidence: { first_name: null, middle_name: null, last_name: null },
        section_status: status,
    };
}

function buildCandidate(result) {
    const rows = [
        [result.child_first_name, result.child_middle_name, result.child_last_name].map((value) => String(value || '').replace(/\s+/g, ' ').trim()),
        [result.mothers_maiden_first, result.mothers_maiden_middle, result.mothers_maiden_last].map((value) => String(value || '').replace(/\s+/g, ' ').trim()),
        [result.father_first_name, result.father_middle_name, result.father_last_name].map((value) => String(value || '').replace(/\s+/g, ' ').trim()),
    ];
    const fatherBlank = rows[2].every((value) => !value || /^(?:N\s*[/.\-]?\s*A)$/i.test(value));
    return {
        raw_text: buildRawSnapshot(result),
        fields: {
            child_name: field(rows[0].join(' ').trim(), ...rows[0]),
            mother_maiden_name: field(rows[1].join(' ').trim(), ...rows[1]),
            father_name: fatherBlank
                ? field('', null, null, null, 'not_applicable')
                : field(rows[2].join(' ').trim(), ...rows[2]),
        },
    };
}

async function addExceptions(request, candidate, duplicate) {
    if (duplicate) {
        await pool.query(`
            UPDATE public.iot_ocr_review_exceptions
            SET resolved_at = NOW()
            WHERE request_id = $1::uuid AND resolved_at IS NULL
              AND exception_group = 'ready_to_confirm'
        `, [request.request_id]);
    }
    const rows = duplicate
        ? [['duplicate_suspicion', 'compliance_hold', 'DUPLICATE_CAPTURE_HASH', null]]
        : [];
    for (const [group, priority, code, fieldKey] of rows) {
        await pool.query(`
            INSERT INTO public.iot_ocr_review_exceptions
                (request_id, candidate_id, field_key, exception_group, priority, rule_code)
            SELECT $1::uuid, $2::uuid, $3, $4, $5, $6
            WHERE NOT EXISTS (
                SELECT 1 FROM public.iot_ocr_review_exceptions
                WHERE request_id = $1::uuid AND exception_group = $4
                  AND rule_code = $6 AND resolved_at IS NULL
            )
        `, [request.request_id, candidate.candidate_id, fieldKey, group, priority, code]);
    }
}

async function hasDuplicateCapture(request) {
    const original = await pool.query(`
        SELECT sha256 FROM public.iot_ocr_capture_artifacts
        WHERE request_id = $1::uuid AND artifact_kind = 'original'
        LIMIT 1
    `, [request.request_id]);
    if (!original.rowCount) return false;
    const duplicate = await pool.query(`
        SELECT 1
        FROM public.iot_ocr_capture_artifacts a
        JOIN public.iot_ocr_requests r ON r.request_id = a.request_id
        WHERE a.artifact_kind = 'original'
          AND a.upload_status IN ('available', 'deletion_pending', 'deleted')
          AND a.sha256 = $1 AND r.application_id <> $2::uuid
        LIMIT 1
    `, [original.rows[0].sha256, request.application_id]);
    return Boolean(duplicate.rowCount);
}

exports.completeUploads = async ({ requestId, deviceId }) => {
    const request = await iotOcrRequestService.getRequestById({ requestId });
    if (!request || request.ocr_version !== 'v2' || request.document_key !== 'birth_certificate') {
        throw httpError(409, 'Birth V2 request is not available');
    }
    if (String(request.claimed_by || '') !== String(deviceId || '')) throw httpError(409, 'Request belongs to another Pi device');
    if (request.status === 'review_required' || request.status === 'completed') {
        const existing = await iotOcrRequestService.getCandidate({
            applicationId: request.application_id,
            documentKey: request.document_key,
            requestId,
        });
        if (request.status === 'review_required' && existing?.candidate) {
            await addExceptions(request, existing.candidate, await hasDuplicateCapture(request));
        }
        return existing;
    }
    if (request.status !== 'processing') throw httpError(409, `Cannot complete uploads from ${request.status}`);
    const artifacts = await downloadAndVerifyArtifacts(requestId);
    await assertRequestStillProcessing(requestId, deviceId);
    const duplicate = await hasDuplicateCapture(request);
    console.info('BIRTH_V2_GEMINI_STARTED', {
        request_id: String(requestId).slice(0, 8),
        model: GEMINI_MODEL,
    });
    const gemini = await callGemini(artifacts.filter(({ artifact_kind }) => artifact_kind === 'cell'));
    console.info('BIRTH_V2_GEMINI_FINISHED', {
        request_id: String(requestId).slice(0, 8),
        status: gemini.ok ? 'structured_candidate' : 'diagnostic_only',
        error_code: gemini.ok ? null : gemini.code,
    });
    await assertRequestStillProcessing(requestId, deviceId);
    const structured = gemini.ok
        ? buildCandidate(gemini.value)
        : { raw_text: gemini.value ? buildRawSnapshot(gemini.value) : '', fields: {} };
    const result = await iotOcrRequestService.completeRequest({
        requestId,
        status: 'review_required',
        rawText: structured.raw_text,
        templateId: 'psa_birth_v1',
        fields: structured.fields,
        fieldConfidence: { child_name: null, mother_maiden_name: null, father_name: null },
        validationIssues: gemini.ok ? [] : [{ code: gemini.code, message: 'Birth OCR requires a rescan or admin rejection.' }],
        processing: {
            ocr_version: 'v2',
            registration_status: 'matched',
            ocr_engine: 'gemini',
            model: GEMINI_MODEL,
            diagnostic_only: !gemini.ok,
            source_regions: Object.fromEntries(artifacts
                .filter(({ artifact_kind }) => artifact_kind === 'cell')
                .map(({ cell_key, roi_polygon }) => [cell_key, roi_polygon])),
        },
        claimedBy: deviceId,
    });
    await addExceptions(result.request, result.candidate, duplicate);
    return result;
};

exports.streamOriginal = async ({ requestId, applicationId }) => {
    const result = await pool.query(`
        SELECT a.bucket_name, a.object_path, a.mime_type
        FROM public.iot_ocr_capture_artifacts a
        JOIN public.iot_ocr_requests r ON r.request_id = a.request_id
        WHERE a.request_id = $1::uuid AND r.application_id = $2::uuid
          AND r.ocr_version = 'v2' AND a.artifact_kind = 'original'
          AND a.upload_status IN ('available', 'deletion_pending')
        LIMIT 1
    `, [requestId, applicationId]);
    if (!result.rows.length) throw httpError(404, 'Birth review image not found');
    const row = result.rows[0];
    const downloaded = await supabase.storage.from(row.bucket_name).download(row.object_path);
    if (downloaded.error || !downloaded.data) throw httpError(404, 'Birth review image not found');
    return { mime_type: row.mime_type, bytes: Buffer.from(await downloaded.data.arrayBuffer()) };
};

exports.markArtifactsForDeletion = async (requestId) => {
    await pool.query(`
        UPDATE public.iot_ocr_capture_artifacts
        SET upload_status = 'deletion_pending', deletion_pending_at = COALESCE(deletion_pending_at, NOW()), updated_at = NOW()
        WHERE request_id = $1::uuid
          AND upload_status IN ('pending', 'available', 'failed')
    `, [requestId]);
};

exports.cleanupArtifacts = async (requestId) => {
    const rows = await pool.query(`
        SELECT artifact_id, bucket_name, object_path
        FROM public.iot_ocr_capture_artifacts
        WHERE request_id = $1::uuid AND upload_status = 'deletion_pending'
    `, [requestId]);
    if (!rows.rowCount) return;
    const grouped = new Map();
    for (const artifact of rows.rows) {
        const bucketArtifacts = grouped.get(artifact.bucket_name) || [];
        bucketArtifacts.push(artifact);
        grouped.set(artifact.bucket_name, bucketArtifacts);
    }
    for (const [bucket, artifacts] of grouped) {
        const removed = await supabase.storage.from(bucket).remove(artifacts.map(({ object_path }) => object_path));
        if (removed.error) continue;
        await pool.query(`
            UPDATE public.iot_ocr_capture_artifacts
            SET upload_status = 'deleted', deleted_at = NOW(), updated_at = NOW()
            WHERE artifact_id = ANY($1::uuid[])
        `, [artifacts.map(({ artifact_id }) => artifact_id)]);
    }
};

exports.cleanupPendingArtifacts = async () => {
    const pending = await pool.query(`
        SELECT DISTINCT request_id
        FROM public.iot_ocr_capture_artifacts
        WHERE upload_status = 'deletion_pending'
        ORDER BY request_id
        LIMIT 50
    `);
    for (const { request_id: requestId } of pending.rows) {
        await exports.cleanupArtifacts(requestId);
    }
};

exports.listReviewQueue = async ({ documentKey = null, group = null, priority = null } = {}) => {
    if (group && !REVIEW_GROUPS.has(group)) throw httpError(400, 'Invalid OCR review exception group');
    if (priority && !REVIEW_PRIORITIES.has(priority)) throw httpError(400, 'Invalid OCR review priority');
    const params = [];
    const filters = ['e.resolved_at IS NULL'];
    if (documentKey) { params.push(documentKey); filters.push(`r.document_key = $${params.length}`); }
    if (group) { params.push(group); filters.push(`e.exception_group = $${params.length}`); }
    if (priority) { params.push(priority); filters.push(`e.priority = $${params.length}`); }
    const result = await pool.query(`
        SELECT e.exception_id, e.request_id, e.field_key, e.exception_group,
               e.priority, e.rule_code, e.created_at, r.application_id,
               r.document_key, r.ocr_version, r.status
        FROM public.iot_ocr_review_exceptions e
        JOIN public.iot_ocr_requests r ON r.request_id = e.request_id
        WHERE ${filters.join(' AND ')}
        ORDER BY CASE e.priority WHEN 'compliance_hold' THEN 1 WHEN 'customer_facing' THEN 2 ELSE 3 END,
                 e.created_at ASC
        LIMIT 200
    `, params);
    return result.rows;
};

exports.CELL_KEYS = CELL_KEYS;
exports.RESPONSE_KEYS = RESPONSE_KEYS;
exports.validateManifest = validateManifest;
exports.validateGeminiPayload = validateGeminiPayload;
exports.hasRequiredNames = hasRequiredNames;
exports.buildRawSnapshot = buildRawSnapshot;
exports.buildCandidate = buildCandidate;
