const crypto = require('crypto');

const pool = require('../config/db');
const supabase = require('../config/supabase');
const iotOcrRequestService = require('./iotOcrRequestService');

function configuredTimeout(name, fallback, minimum) {
    const parsed = Number(process.env[name]);
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    return Math.min(300000, Math.max(minimum, Math.round(value)));
}

const BUCKET = String(process.env.IOT_OCR_CAPTURE_BUCKET || 'iot-ocr-captures').trim();
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
const GEMINI_MODELS = Object.freeze(Array.from(new Set([
    GEMINI_MODEL,
    ...String(process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.5-flash')
        .split(',').map((value) => value.trim()).filter(Boolean),
])));
const GEMINI_TIMEOUT_MS = configuredTimeout('GEMINI_TIMEOUT_MS', 45000, 15000);
const GEMINI_DIAGNOSTIC_TIMEOUT_MS = Math.max(
    GEMINI_TIMEOUT_MS,
    configuredTimeout('GEMINI_DIAGNOSTIC_TIMEOUT_MS', 90000, 30000)
);
const GEMINI_RETRY_ATTEMPTS = Math.min(5, Math.max(
    1,
    Number.parseInt(process.env.GEMINI_RETRY_ATTEMPTS || '4', 10) || 4
));
const GEMINI_RETRY_INITIAL_DELAY_SECONDS = Math.min(10, Math.max(
    0.5,
    Number(process.env.GEMINI_RETRY_INITIAL_DELAY_SECONDS || 2) || 2
));
const GEMINI_ENABLE_ROW_RECOVERY = String(
    process.env.GEMINI_ENABLE_ROW_RECOVERY || 'false'
).trim().toLowerCase() === 'true';
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
const DIAGNOSTIC_MESSAGES = Object.freeze({
    PSA_BIRTH_V2_TEMPLATE_MISMATCH: 'Approved Birth template registration failed.',
    PSA_BIRTH_V2_CALIBRATION_REQUIRED: 'Birth station calibration is required.',
    PSA_BIRTH_V2_TOPOLOGY_MISMATCH: 'Birth Items 1, 6, and 13 topology could not be validated.',
    PSA_BIRTH_V2_NINE_CELL_CROP_FAILED: 'Exactly nine Birth name cells could not be cropped.',
    PSA_BIRTH_V2_CELL_ENCODING_FAILED: 'A Birth name cell could not be encoded safely.',
});
const RESPONSE_SCHEMA = Object.freeze({
    type: 'object',
    properties: {
        template_id: { type: 'string', enum: ['psa_birth_v1'] },
        fields: {
            type: 'object',
            properties: Object.fromEntries(RESPONSE_KEYS.map((key) => [key, { type: 'string' }])),
            required: RESPONSE_KEYS,
            additionalProperties: false,
        },
    },
    required: ['template_id', 'fields'],
    additionalProperties: false,
});
const FULL_PAGE_RESPONSE_SCHEMA = Object.freeze({
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
const ROW_RECOVERY_SCHEMA = Object.freeze({
    type: 'object',
    properties: {
        first_name: { type: 'string' },
        middle_name: { type: 'string' },
        last_name: { type: 'string' },
    },
    required: ['first_name', 'middle_name', 'last_name'],
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
    if (!Array.isArray(artifacts) || ![1, 10].includes(artifacts.length)) {
        throw httpError(400, 'Birth V2 requires one original, optionally followed by exactly nine cell artifacts');
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
    if (cells.length && (
        new Set(cells).size !== CELL_KEYS.length
        || CELL_KEYS.some((key) => !cells.includes(key))
    )) {
        throw httpError(400, 'Birth V2 artifact manifest is incomplete');
    }
    return normalized;
}

function normalizeDiagnostic(value) {
    if (!value || typeof value !== 'object') return null;
    const code = String(value.code || '').trim().toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(DIAGNOSTIC_MESSAGES, code)) {
        throw httpError(400, 'Invalid Birth V2 diagnostic code');
    }
    const registrationStatus = String(value.registration_status || 'mismatch').trim().toLowerCase();
    const topologyStatus = String(value.topology_status || 'unknown').trim().toLowerCase();
    const registrationMode = String(value.registration_mode || 'unknown').trim().toLowerCase();
    const regionMode = String(value.region_mode || 'expected_calibration').trim().toLowerCase();
    const suppliedRegions = value.source_regions == null ? {} : value.source_regions;
    if (!suppliedRegions || typeof suppliedRegions !== 'object' || Array.isArray(suppliedRegions)) {
        throw httpError(400, 'Invalid diagnostic source regions');
    }
    const sourceRegions = {};
    for (const [key, polygon] of Object.entries(suppliedRegions)) {
        if (!CELL_KEYS.includes(key)) throw httpError(400, 'Invalid diagnostic source region key');
        sourceRegions[key] = normalizePolygon(polygon);
    }
    return {
        code,
        message: DIAGNOSTIC_MESSAGES[code],
        registration_status: ['matched', 'mismatch', 'failed'].includes(registrationStatus)
            ? registrationStatus
            : 'mismatch',
        topology_status: ['matched', 'mismatch', 'failed', 'unknown'].includes(topologyStatus)
            ? topologyStatus
            : 'unknown',
        registration_mode: [
            'strict_grid', 'relaxed_validated_grid', 'validated_grid_envelope',
            'manual_station_quad', 'unknown',
        ].includes(registrationMode) ? registrationMode : 'unknown',
        region_mode: regionMode === 'exact_cells' ? 'exact_cells' : 'expected_calibration',
        source_regions: sourceRegions,
    };
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
            const roiPolygonJson = artifact.roi_polygon == null
                ? null
                : JSON.stringify(artifact.roi_polygon);
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
                roiPolygonJson, deviceId]);
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

async function downloadAndVerifyArtifacts(requestId, { originalOnly = false } = {}) {
    const result = await pool.query(`
        SELECT * FROM public.iot_ocr_capture_artifacts
        WHERE request_id = $1::uuid
          AND ($2::boolean = false OR artifact_kind = 'original')
        ORDER BY artifact_kind, cell_key
    `, [requestId, originalOnly]);
    if (![1, 10].includes(result.rows.length)) throw httpError(409, 'Birth V2 artifacts are incomplete');
    const originals = result.rows.filter(({ artifact_kind: kind }) => kind === 'original');
    const cells = result.rows.filter(({ artifact_kind: kind }) => kind === 'cell');
    if (originals.length !== 1 || ![0, 9].includes(cells.length)) {
        throw httpError(409, 'Birth V2 artifacts are incomplete');
    }
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
          AND ($2::boolean = false OR artifact_kind = 'original')
    `, [requestId, originalOnly]);
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
        || Object.keys(value).length !== 2 || value.template_id !== 'psa_birth_v1'
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

function validateFullPageGeminiPayload(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== 3 || value.template_id !== 'psa_birth_v1'
        || typeof value.raw_text !== 'string'
        || !value.fields || typeof value.fields !== 'object' || Array.isArray(value.fields)) return null;
    const keys = Object.keys(value.fields).sort();
    if (keys.length !== RESPONSE_KEYS.length || RESPONSE_KEYS.some((key) => !keys.includes(key))) return null;
    const fields = {};
    for (const key of RESPONSE_KEYS) {
        if (typeof value.fields[key] !== 'string') return null;
        fields[key] = value.fields[key];
    }
    return { raw_text: value.raw_text, fields };
}

function hasRequiredNames(value) {
    return [
        value?.child_first_name,
        value?.child_last_name,
        value?.mothers_maiden_first,
        value?.mothers_maiden_last,
    ].every((entry) => String(entry || '').trim());
}

function isGeminiTimeout(error, controller) {
    if (controller.signal.aborted) return true;
    const code = String(error?.code || '').toUpperCase();
    const name = String(error?.name || '').toUpperCase();
    const message = String(error?.message || '').toUpperCase();
    return code.includes('TIMEOUT') || name.includes('TIMEOUT')
        || name === 'ABORTERROR' || message.includes('TIMEOUT')
        || message.includes('DEADLINE');
}

function geminiFailureCode(error, prefix) {
    const status = Number(
        error?.status || error?.statusCode || error?.code
        || error?.error?.code || error?.response?.status
    );
    const signal = [
        error?.code, error?.status, error?.name, error?.message,
        error?.error?.status, error?.error?.message,
    ]
        .map((value) => String(value || '').toUpperCase()).join(' ');
    if (status === 400 || signal.includes('INVALID_ARGUMENT')) return `${prefix}_INVALID_REQUEST`;
    if ([401, 403].includes(status) || signal.includes('PERMISSION_DENIED')
        || signal.includes('UNAUTHENTICATED')) return `${prefix}_AUTH_FAILED`;
    if (status === 404 || signal.includes('NOT_FOUND')) return `${prefix}_MODEL_UNAVAILABLE`;
    if (status === 429 || signal.includes('RESOURCE_EXHAUSTED')) return `${prefix}_RATE_LIMITED`;
    if (status >= 500 || signal.includes('UNAVAILABLE')) return `${prefix}_SERVICE_UNAVAILABLE`;
    return `${prefix}_REQUEST_FAILED`;
}

function isGeminiModelUnavailable(error) {
    const status = Number(error?.status || error?.statusCode || error?.code);
    const signal = [error?.code, error?.status, error?.name]
        .map((value) => String(value || '').toUpperCase()).join(' ');
    return status === 404 || signal.includes('NOT_FOUND');
}

function isGeminiTransient(error) {
    const status = Number(
        error?.status || error?.statusCode || error?.code
        || error?.error?.code || error?.response?.status
    );
    const signal = [error?.code, error?.status, error?.name, error?.message, error?.error?.status]
        .map((value) => String(value || '').toUpperCase()).join(' ');
    return [408, 429, 500, 502, 503, 504].includes(status)
        || signal.includes('RESOURCE_EXHAUSTED')
        || signal.includes('UNAVAILABLE');
}

async function generateGeminiContent(client, request, timeoutMs, timeoutCode) {
    let fallbackError = null;
    for (const model of GEMINI_MODELS) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await client.models.generateContent({
                ...request,
                model,
                config: {
                    ...(request.config || {}),
                    abortSignal: controller.signal,
                    httpOptions: {
                        timeout: timeoutMs,
                        retryOptions: {
                            attempts: GEMINI_RETRY_ATTEMPTS,
                            initialDelay: GEMINI_RETRY_INITIAL_DELAY_SECONDS,
                            maxDelay: 15,
                            expBase: 2,
                            jitter: 0.5,
                            httpStatusCodes: [408, 429, 500, 502, 503, 504],
                        },
                    },
                },
            });
            if (model !== GEMINI_MODEL) {
                console.info('BIRTH_V2_GEMINI_MODEL_FALLBACK', {
                    configured_model: GEMINI_MODEL,
                    selected_model: model,
                });
            }
            return response;
        } catch (error) {
            if (isGeminiTimeout(error, controller)) {
                throw Object.assign(new Error('Gemini request timed out'), { code: timeoutCode });
            }
            if (isGeminiModelUnavailable(error) || isGeminiTransient(error)) {
                fallbackError = error;
                continue;
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }
    throw fallbackError || Object.assign(new Error('No Gemini model is available'), {
        status: 404,
    });
}

async function readRequiredNameRow(client, cells, { item, person }) {
    const parts = [{ text: [
        `Read only PSA Certificate of Live Birth Item ${item}, the ${person} name row.`,
        'Three images follow in First, Middle, Last physical-column order.',
        'Transcribe the visible person name literally from each supplied image.',
        'Do not copy printed labels such as NAME, First, Middle, Last, MAIDEN, or item numbers.',
        'Keep compound names in their original cell. Return an empty string only when truly blank.',
        'Return only the required JSON schema.',
    ].join(' ') }];
    for (const component of ['first', 'middle', 'last']) {
        const cellKey = `item${item}_${component}`;
        const artifact = cells.find((entry) => entry.cell_key === cellKey);
        if (!artifact) return null;
        parts.push({ text: `${component}_name source cell` });
        parts.push({ inlineData: {
            mimeType: artifact.mime_type,
            data: artifact.bytes.toString('base64'),
        } });
    }
    try {
        const response = await generateGeminiContent(client, {
            model: GEMINI_MODEL,
            contents: [{ role: 'user', parts }],
            config: {
                responseMimeType: 'application/json',
                responseJsonSchema: ROW_RECOVERY_SCHEMA,
                maxOutputTokens: 512,
            },
        }, GEMINI_TIMEOUT_MS, 'GEMINI_RECOVERY_TIMEOUT');
        const raw = typeof response.text === 'function' ? response.text() : response.text;
        const parsed = JSON.parse(String(raw || ''));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
            || Object.keys(parsed).length !== 3
            || ['first_name', 'middle_name', 'last_name']
                .some((key) => typeof parsed[key] !== 'string')) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

async function recoverRequiredNames(client, cells, existing = {}) {
    const [child, mother] = await Promise.all([
        readRequiredNameRow(client, cells, { item: '1', person: 'Child' }),
        readRequiredNameRow(client, cells, { item: '6', person: "Mother's maiden" }),
    ]);
    const merged = Object.fromEntries(
        RESPONSE_KEYS.map((key) => [key, String(existing?.[key] || '')])
    );
    for (const [target, source] of [
        ['child_first_name', child?.first_name],
        ['child_middle_name', child?.middle_name],
        ['child_last_name', child?.last_name],
        ['mothers_maiden_first', mother?.first_name],
        ['mothers_maiden_middle', mother?.middle_name],
        ['mothers_maiden_last', mother?.last_name],
    ]) {
        if (!merged[target].trim() && String(source || '').trim()) merged[target] = source;
    }
    return hasRequiredNames(merged) ? merged : null;
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
        'Read the actual typed or printed name value from each of nine separately labelled',
        'PSA Certificate of Live Birth cells. The images follow Item 1 (Child), Item 6',
        '(Mother maiden name), Item 13 (Father), each in First, Middle, Last order.',
        'Ignore form labels, headings, grid lines, stamps, and neighboring text.',
        'Keep compound names inside their supplied cell. Do not move words between cells.',
        'Return an empty string only when that supplied cell is genuinely blank or N/A.',
        'Return only the required JSON schema.',
    ].join(' ') }];
    for (const key of CELL_KEYS) {
        const artifact = cells.find((entry) => entry.cell_key === key);
        parts.push({ text: `Cell ${key}` });
        parts.push({ inlineData: { mimeType: artifact.mime_type, data: artifact.bytes.toString('base64') } });
    }
    try {
        const response = await generateGeminiContent(client, {
            model: GEMINI_MODEL,
            contents: [{ role: 'user', parts }],
            config: {
                responseMimeType: 'application/json',
                responseJsonSchema: RESPONSE_SCHEMA,
                maxOutputTokens: 1536,
            },
        }, GEMINI_TIMEOUT_MS, 'GEMINI_TIMEOUT');
        const raw = typeof response.text === 'function' ? response.text() : response.text;
        const parsed = validateGeminiPayload(JSON.parse(String(raw || '')));
        if (!parsed) {
            if (!GEMINI_ENABLE_ROW_RECOVERY) {
                return { ok: false, code: 'GEMINI_INVALID_RESULT' };
            }
            const recovered = await recoverRequiredNames(client, cells);
            return recovered
                ? { ok: true, value: recovered, recovered: true }
                : { ok: false, code: 'GEMINI_INVALID_RESULT' };
        }
        if (!hasRequiredNames(parsed)) {
            if (!GEMINI_ENABLE_ROW_RECOVERY) {
                return { ok: false, code: 'GEMINI_REQUIRED_NAME_MISSING', value: parsed };
            }
            const recovered = await recoverRequiredNames(client, cells, parsed);
            if (!recovered) {
                return { ok: false, code: 'GEMINI_REQUIRED_NAME_MISSING', value: parsed };
            }
            return { ok: true, value: recovered, recovered: true };
        }
        return { ok: true, value: parsed };
    } catch (error) {
        const code = error.code === 'GEMINI_TIMEOUT'
            ? 'GEMINI_TIMEOUT'
            : geminiFailureCode(error, 'GEMINI');
        if (GEMINI_ENABLE_ROW_RECOVERY
            && !['GEMINI_AUTH_FAILED', 'GEMINI_MODEL_UNAVAILABLE', 'GEMINI_RATE_LIMITED']
            .includes(code)) {
            const recovered = await recoverRequiredNames(client, cells);
            if (recovered) return { ok: true, value: recovered, recovered: true };
        }
        return { ok: false, code };
    }
}

async function callGeminiFullPage(original) {
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return { ok: false, code: 'GEMINI_KEY_MISSING' };
    let GoogleGenAI;
    try {
        ({ GoogleGenAI } = require('@google/genai'));
    } catch {
        return { ok: false, code: 'GEMINI_DEPENDENCY_MISSING' };
    }
    const client = new GoogleGenAI({ apiKey });
    try {
        const response = await generateGeminiContent(client, {
            model: GEMINI_MODEL,
            contents: [{ role: 'user', parts: [
                { text: [
                    'Read this PSA Certificate of Live Birth as two separate outputs in one JSON object.',
                    'For raw_text, transcribe every legible printed or typed character from the certificate',
                    'literally and preserve reading order and line breaks. Do not summarize, correct,',
                    'normalize, or add commentary. For fields, propose only the values printed in Item 1',
                    'NAME, Item 6 MAIDEN NAME, and Item 13 NAME, preserving First, Middle, and Last printed',
                    'columns. Keep compound names inside their physical column. Use an empty string when a',
                    'component is blank or N/A. The raw_text string must remain a literal transcription and',
                    'must not be generated from or rewritten to match the fields. Return only the schema.',
                ].join(' ') },
                { inlineData: {
                    mimeType: original.mime_type,
                    data: original.bytes.toString('base64'),
                } },
            ] }],
            config: {
                responseMimeType: 'application/json',
                responseJsonSchema: FULL_PAGE_RESPONSE_SCHEMA,
                maxOutputTokens: 4096,
            },
        }, GEMINI_DIAGNOSTIC_TIMEOUT_MS, 'GEMINI_FULL_PAGE_TIMEOUT');
        const raw = typeof response.text === 'function' ? response.text() : response.text;
        let parsed;
        try {
            parsed = validateFullPageGeminiPayload(JSON.parse(String(raw || '')));
        } catch {
            parsed = null;
        }
        if (!parsed) return { ok: false, code: 'GEMINI_FULL_PAGE_INVALID_RESULT' };
        if (!String(parsed.raw_text).trim()) {
            return { ok: false, code: 'GEMINI_FULL_PAGE_EMPTY' };
        }
        return { ok: true, value: parsed };
    } catch (error) {
        return {
            ok: false,
            code: error.code === 'GEMINI_FULL_PAGE_TIMEOUT'
                ? 'GEMINI_FULL_PAGE_TIMEOUT'
                : geminiFailureCode(error, 'GEMINI_FULL_PAGE'),
        };
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
        fields: {
            child_name: field(rows[0].join(' ').trim(), ...rows[0]),
            mother_maiden_name: field(rows[1].join(' ').trim(), ...rows[1]),
            father_name: fatherBlank
                ? field('', null, null, null, 'not_applicable')
                : field(rows[2].join(' ').trim(), ...rows[2]),
        },
    };
}

function comparableName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function proposalDisagreementIssues(cellFields, fullPageFields) {
    if (!cellFields || !fullPageFields) return [];
    const groups = [
        ['child_name', ['child_first_name', 'child_middle_name', 'child_last_name']],
        ['mother_maiden_name', ['mothers_maiden_first', 'mothers_maiden_middle', 'mothers_maiden_last']],
        ['father_name', ['father_first_name', 'father_middle_name', 'father_last_name']],
    ];
    return groups
        .filter(([, keys]) => keys.some((key) => (
            comparableName(cellFields[key]) !== comparableName(fullPageFields[key])
        )))
        .map(([fieldKey]) => ({
            code: 'BIRTH_V2_SOURCE_DISAGREEMENT',
            field: fieldKey,
            message: 'Exact-cell and full-page Gemini proposals differ. Review this field against the private capture.',
        }));
}

function selectBirthV2Candidate({ cellGemini, fullPageGemini, diagnosticResult = null }) {
    const cellFields = cellGemini?.ok && hasRequiredNames(cellGemini.value)
        ? cellGemini.value
        : null;
    const fullPageFields = fullPageGemini?.ok && hasRequiredNames(fullPageGemini.value?.fields)
        ? fullPageGemini.value.fields
        : null;
    const rawText = fullPageGemini?.ok ? fullPageGemini.value.raw_text : '';
    const validationIssues = [];
    let selectedFields = null;
    let structuredValueSource = 'none';

    if (cellFields) {
        selectedFields = buildCandidate(cellFields).fields;
        structuredValueSource = 'birth_v2_exact_cells_gemini';
        validationIssues.push(...proposalDisagreementIssues(cellFields, fullPageFields));
    } else if (fullPageFields) {
        selectedFields = buildCandidate(fullPageFields).fields;
        structuredValueSource = 'birth_v2_full_page_gemini_recovery';
        validationIssues.push({
            code: 'BIRTH_V2_FULL_PAGE_RECOVERY_USED',
            message: 'Name fields were recovered from the full-page Gemini reading and require administrator review.',
        });
        if (cellGemini?.code) {
            validationIssues.push({
                code: cellGemini.code,
                message: diagnosticResult?.message || 'Exact-cell Birth extraction was unavailable.',
            });
        }
    } else {
        validationIssues.push({
            code: cellGemini?.code || 'BIRTH_V2_STRUCTURED_EXTRACTION_FAILED',
            message: diagnosticResult?.message || 'Gemini could not produce the required Child and Mother names.',
        });
        if (fullPageGemini?.ok) {
            validationIssues.push({
                code: 'BIRTH_V2_FULL_PAGE_REQUIRED_NAMES_MISSING',
                message: 'The full-page transcription was saved, but it did not provide all required Birth names.',
            });
        }
    }

    if (!fullPageGemini?.ok) {
        validationIssues.push({
            code: fullPageGemini?.code || 'GEMINI_FULL_PAGE_UNAVAILABLE',
            message: 'The immutable full-page Gemini transcription is unavailable; no replacement text was fabricated.',
        });
    }

    return {
        raw_text: rawText,
        fields: selectedFields || {},
        diagnostic_only: !selectedFields,
        structured_value_source: structuredValueSource,
        validation_issues: validationIssues,
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

exports.completeUploads = async ({ requestId, deviceId, diagnostic = null }) => {
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
    const diagnosticResult = normalizeDiagnostic(diagnostic);
    const artifacts = await downloadAndVerifyArtifacts(requestId, {
        originalOnly: Boolean(diagnosticResult),
    });
    await assertRequestStillProcessing(requestId, deviceId);
    const duplicate = await hasDuplicateCapture(request);
    const cells = artifacts.filter(({ artifact_kind }) => artifact_kind === 'cell');
    if (cells.length === 0 && !diagnosticResult) {
        throw httpError(400, 'Birth V2 original-only upload requires diagnostic metadata');
    }
    if (cells.length === 9 && diagnosticResult) {
        throw httpError(400, 'Birth V2 diagnostic metadata is only valid for original-only uploads');
    }
    const original = artifacts.find(({ artifact_kind: kind }) => kind === 'original');
    console.info('BIRTH_V2_GEMINI_STARTED', {
        request_id: String(requestId).slice(0, 8),
        model: GEMINI_MODEL,
        cell_extraction: cells.length === 9 ? 'requested' : 'skipped',
        full_page_extraction: 'requested',
    });
    const [cellSettlement, fullPageSettlement] = await Promise.allSettled([
        cells.length === 9
            ? callGemini(cells)
            : Promise.resolve({
                ok: false,
                code: diagnosticResult?.code || 'BIRTH_V2_EXACT_CELLS_UNAVAILABLE',
            }),
        callGeminiFullPage(original),
    ]);
    const cellGemini = cellSettlement.status === 'fulfilled'
        ? cellSettlement.value
        : { ok: false, code: 'GEMINI_CELL_REQUEST_FAILED' };
    const fullPageGemini = fullPageSettlement.status === 'fulfilled'
        ? fullPageSettlement.value
        : { ok: false, code: 'GEMINI_FULL_PAGE_REQUEST_FAILED' };
    const selected = selectBirthV2Candidate({
        cellGemini,
        fullPageGemini,
        diagnosticResult,
    });
    console.info('BIRTH_V2_GEMINI_FINISHED', {
        request_id: String(requestId).slice(0, 8),
        status: selected.diagnostic_only ? 'diagnostic_only' : 'structured_candidate',
        structured_value_source: selected.structured_value_source,
        cell_status: cellGemini.ok ? 'available' : 'unavailable',
        cell_error_code: cellGemini.ok ? null : cellGemini.code,
        full_page_status: fullPageGemini.ok ? 'available' : 'unavailable',
        full_page_error_code: fullPageGemini.ok ? null : fullPageGemini.code,
    });
    await assertRequestStillProcessing(requestId, deviceId);
    const sourceRegions = cells.length === 9
        ? Object.fromEntries(cells.map(({ cell_key, roi_polygon }) => [cell_key, roi_polygon]))
        : diagnosticResult.source_regions;
    const result = await iotOcrRequestService.completeRequest({
        requestId,
        status: 'review_required',
        rawText: selected.raw_text,
        templateId: 'psa_birth_v1',
        fields: selected.fields,
        fieldConfidence: { child_name: null, mother_maiden_name: null, father_name: null },
        validationIssues: selected.validation_issues,
        processing: {
            ocr_version: 'v2',
            pipeline_version: 'v2',
            registration_status: diagnosticResult?.registration_status || 'matched',
            topology_status: diagnosticResult?.topology_status || 'matched',
            ocr_engine: 'gemini',
            model: GEMINI_MODEL,
            diagnostic_only: selected.diagnostic_only,
            raw_text_source: 'birth_v2_full_page_gemini_literal',
            raw_text_status: fullPageGemini.ok ? 'available' : 'unavailable',
            raw_text_error_code: fullPageGemini.ok ? null : fullPageGemini.code,
            structured_value_source: selected.structured_value_source,
            cell_extraction_status: cells.length !== 9
                ? 'skipped'
                : cellGemini.ok ? 'available' : 'unavailable',
            cell_extraction_error_code: cellGemini.ok ? null : cellGemini.code,
            full_page_extraction_status: fullPageGemini.ok ? 'available' : 'unavailable',
            full_page_extraction_error_code: fullPageGemini.ok ? null : fullPageGemini.code,
            diagnostic_raw_status: fullPageGemini.ok ? 'available' : 'unavailable',
            diagnostic_raw_error_code: fullPageGemini.ok ? null : fullPageGemini.code,
            private_capture_available: true,
            source_regions: sourceRegions,
            region_mode: cells.length === 9
                ? 'exact_cells'
                : diagnosticResult.region_mode,
            registration_mode: diagnosticResult?.registration_mode || 'automatic',
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
exports.normalizeDiagnostic = normalizeDiagnostic;
exports.validateGeminiPayload = validateGeminiPayload;
exports.validateFullPageGeminiPayload = validateFullPageGeminiPayload;
exports.hasRequiredNames = hasRequiredNames;
exports.buildCandidate = buildCandidate;
exports.selectBirthV2Candidate = selectBirthV2Candidate;
exports.callGemini = callGemini;
exports.callGeminiFullPage = callGeminiFullPage;
