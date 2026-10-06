// SMaRT-PDM: OCR — indigency Ocr V2 Service (admin backend service); contains business logic and data operations.
const crypto = require('crypto');
const pool = require('../config/db');
const supabase = require('../config/supabase');
const iotOcrRequestService = require('./iotOcrRequestService');

// getEnhancedOcrProvider: reads and returns get enhanced ocr provider for the OCR flow.
function getEnhancedOcrProvider() {
    try {
        return require('./indigencyEnhancedOcrProvider');
    } catch (error) {
        if (error?.code === 'MODULE_NOT_FOUND' || String(error?.message || '').startsWith('Unexpected dependency')) {
            return require('./enhancedOcrProvider');
        }
        throw error;
    }
}

const BUCKET = String(process.env.IOT_OCR_CAPTURE_BUCKET || 'iot-ocr-captures').trim();
const INDIGENCY_PROVIDER_TIMEOUT_MS = Math.min(25000, Math.max(8000, Number.parseInt(process.env.INDIGENCY_OCR_PROVIDER_TIMEOUT_MS || '15000', 10) || 15000));
const INDIGENCY_MAX_OUTPUT_TOKENS = Math.min(4096, Math.max(512, Number.parseInt(process.env.INDIGENCY_OCR_MAX_OUTPUT_TOKENS || '2048', 10) || 2048));
const INDIGENCY_RETRY_MAX_ATTEMPTS = Math.min(2, Math.max(1, Number.parseInt(process.env.INDIGENCY_OCR_RETRY_MAX_ATTEMPTS || '2', 10) || 2));
const INDIGENCY_RETRY_BACKOFF_SECONDS = [Math.min(5, Math.max(1, Number.parseInt(process.env.INDIGENCY_OCR_RETRY_BACKOFF_SECONDS || '1', 10) || 1))];
const VERIFIED_CAPTURE_CACHE_TTL_MS = Math.min(300000, Math.max(30000, Number.parseInt(process.env.INDIGENCY_VERIFIED_CAPTURE_CACHE_TTL_MS || '120000', 10) || 120000));
const verifiedCaptureCache = new Map();
const FIELD_KEYS = Object.freeze([
    'certificate_subject_name',
    'residency_address',
]);
const INDIGENCY_SCHEMA = {
    type: 'object',
    properties: {
        raw_text: { type: 'string' },
        fields: {
            type: 'object',
            properties: Object.fromEntries(FIELD_KEYS.map((key) => [key, { type: 'string' }])),
            required: FIELD_KEYS,
        },
    },
    required: ['raw_text', 'fields'],
};

// httpError: handles http error for the OCR flow.
function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// validateManifest: validates validate manifest for the OCR flow.
function validateManifest(artifacts) {
    if (!Array.isArray(artifacts) || artifacts.length !== 1) {
        throw httpError(400, 'Indigency Enhanced OCR requires one original capture');
    }
    const artifact = artifacts[0];
    if (artifact.artifact_kind !== 'original' || !['image/jpeg', 'image/png'].includes(artifact.mime_type)) {
        throw httpError(400, 'Indigency Enhanced OCR requires an original JPEG or PNG capture');
    }
    if (!Number.isInteger(Number(artifact.byte_count)) || Number(artifact.byte_count) <= 0
        || !/^[a-f0-9]{64}$/i.test(String(artifact.sha256 || ''))) {
        throw httpError(400, 'Indigency capture manifest is invalid');
    }
    return artifact;
}

// lockRequest: handles lock request for the OCR flow.
async function lockRequest(client, requestId, deviceId) {
    const result = await client.query(
        'SELECT * FROM public.iot_ocr_requests WHERE request_id = $1::uuid FOR UPDATE',
        [requestId]
    );
    const request = result.rows[0];
    if (!request) throw httpError(404, 'IoT OCR request not found');
    if (request.document_key !== 'certificate_of_indigency' || request.ocr_version !== 'v2') {
        throw httpError(409, 'Capture upload is only available for Indigency Enhanced OCR');
    }
    if (String(request.claimed_by || '') !== String(deviceId || '')) {
        throw httpError(409, 'Request belongs to another Pi device');
    }
    if (request.status !== 'processing') throw httpError(409, `Cannot upload artifacts from ${request.status}`);
    return request;
}

exports.authorizeUploads = async ({ requestId, deviceId, artifacts }) => {
    const manifest = validateManifest(artifacts);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await lockRequest(client, requestId, deviceId);
        const artifactId = crypto.randomUUID();
        const objectPath = `${requestId}/${artifactId}.${manifest.mime_type === 'image/png' ? 'png' : 'jpg'}`;
        const inserted = await client.query(`
            INSERT INTO public.iot_ocr_capture_artifacts
                (artifact_id, request_id, artifact_kind, bucket_name, object_path,
                 mime_type, byte_count, sha256, device_id)
            VALUES ($1::uuid, $2::uuid, 'original', $3, $4, $5, $6, $7, $8::uuid)
            ON CONFLICT (request_id, artifact_kind, (coalesce(cell_key, '')))
            DO UPDATE SET mime_type = EXCLUDED.mime_type, byte_count = EXCLUDED.byte_count,
                sha256 = EXCLUDED.sha256, updated_at = NOW()
            RETURNING artifact_id, object_path
        `, [artifactId, requestId, BUCKET, objectPath, manifest.mime_type,
            manifest.byte_count, manifest.sha256, deviceId]);
        const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(inserted.rows[0].object_path, { upsert: true });
        if (signed.error) throw signed.error;
        await client.query('COMMIT');
        return {
            request_id: requestId,
            artifacts: [{ ...inserted.rows[0], artifact_kind: 'original', signed_url: signed.data.signedUrl, token: signed.data.token }],
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// getCachedOriginal: reads and returns get cached original for the OCR flow.
function getCachedOriginal(requestId) {
    const key = String(requestId || '');
    const cached = verifiedCaptureCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.verifiedAt > VERIFIED_CAPTURE_CACHE_TTL_MS) {
        verifiedCaptureCache.delete(key);
        return null;
    }
    return cached.original;
}

// rememberVerifiedOriginal: handles remember verified original for the OCR flow.
function rememberVerifiedOriginal(requestId, original) {
    verifiedCaptureCache.set(String(requestId || ''), { verifiedAt: Date.now(), original });
}

// clearVerifiedOriginal: clears clear verified original for the OCR flow.
function clearVerifiedOriginal(requestId) {
    verifiedCaptureCache.delete(String(requestId || ''));
}

// markOriginalAvailable: marks mark original available for the OCR flow.
async function markOriginalAvailable(requestId) {
    await pool.query(`
        UPDATE public.iot_ocr_capture_artifacts SET upload_status = 'available', uploaded_at = COALESCE(uploaded_at, NOW()), updated_at = NOW()
        WHERE request_id = $1::uuid AND artifact_kind = 'original' AND upload_status = 'pending'
    `, [requestId]);
}

// downloadOriginal: downloads download original for the OCR flow.
async function downloadOriginal(requestId) {
    const result = await pool.query(`
        SELECT * FROM public.iot_ocr_capture_artifacts
        WHERE request_id = $1::uuid AND artifact_kind = 'original'
        LIMIT 1
    `, [requestId]);
    const row = result.rows[0];
    if (!row) throw httpError(409, 'Indigency Enhanced OCR capture is incomplete');
    const downloaded = await supabase.storage.from(row.bucket_name).download(row.object_path);
    if (downloaded.error || !downloaded.data) throw httpError(409, 'Indigency Enhanced OCR capture is unavailable');
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== Number(row.byte_count) || digest !== row.sha256) {
        throw httpError(409, 'Indigency capture integrity check failed');
    }
    return { ...row, bytes };
}

// toField: handles to field for the OCR flow.
function toField(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return { raw_text: normalized, normalized_value: normalized, confidence: null };
}

// normalizeFields: normalizes normalize fields for the OCR flow.
function normalizeFields(value) {
    const fields = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(FIELD_KEYS.map((key) => [key, toField(fields[key])]));
}

exports.completeUploads = async ({ requestId, deviceId }) => {
    const startedAt = Date.now();
    const request = await iotOcrRequestService.getRequestById({ requestId });
    if (!request || request.document_key !== 'certificate_of_indigency' || request.ocr_version !== 'v2') {
        throw httpError(409, 'Indigency Enhanced OCR request is not available');
    }
    if (String(request.claimed_by || '') !== String(deviceId || '')) throw httpError(409, 'Request belongs to another Pi device');
    if (request.status === 'review_required' || request.status === 'completed') {
        return iotOcrRequestService.getCandidate({ applicationId: request.application_id, documentKey: request.document_key, requestId });
    }
    if (request.status !== 'processing') throw httpError(409, `Cannot complete uploads from ${request.status}`);
    const attempt = Number(request.processing_attempt_count || 0) + 1;
    console.info('INDIGENCY_V2_PROVIDER_STARTED', {
        request_id: String(requestId).slice(0, 8), attempt, status: request.status,
    });
    let original = getCachedOriginal(requestId);
    if (!original) {
        original = await downloadOriginal(requestId);
        await markOriginalAvailable(requestId);
        rememberVerifiedOriginal(requestId, original);
    }
    let result;
    try {
        result = await getEnhancedOcrProvider().extract({
            documentType: 'certificate_of_indigency',
            image: original,
            schema: INDIGENCY_SCHEMA,
            instruction: 'Read the Certificate of Indigency literally. Extract certificate_subject_name and residency_address exactly as printed. Do not guess, infer, or add fields.',
            timeoutMs: INDIGENCY_PROVIDER_TIMEOUT_MS,
            maxOutputTokens: INDIGENCY_MAX_OUTPUT_TOKENS,
        });
        console.info('INDIGENCY_V2_PROVIDER_COMPLETED', {
            request_id: String(requestId).slice(0, 8), attempt,
            duration_ms: Date.now() - startedAt, status: 'completed',
        });
    } catch (error) {
        const failure = require('./enhancedOcrErrors').normalizeEnhancedOcrError(error);
        console.error('INDIGENCY_V2_PROVIDER_FAILED', {
            request_id: String(requestId).slice(0, 8), attempt,
            duration_ms: Date.now() - startedAt, error_code: failure.code,
            provider_status: failure.providerStatus || null,
        });
        if (failure.retryable) {
            const scheduled = await iotOcrRequestService.scheduleProcessingRetry({
                requestId,
                errorCode: failure.code,
                errorMessage: failure.message,
                maxAttempts: INDIGENCY_RETRY_MAX_ATTEMPTS,
                delays: INDIGENCY_RETRY_BACKOFF_SECONDS,
            });
            failure.request = scheduled.request;
        } else {
            const failed = await iotOcrRequestService.completeRequest({ requestId, status: 'failed', errorCode: failure.code, errorMessage: failure.message, claimedBy: deviceId });
            failure.request = failed.request;
        }
        throw failure;
    }
    const fields = normalizeFields(result.fields);
    const completed = await iotOcrRequestService.completeRequest({
        requestId,
        status: 'review_required',
        rawText: String(result.raw_text || ''),
        templateId: 'indigency_v2',
        fields,
        fieldConfidence: Object.fromEntries(FIELD_KEYS.map((key) => [key, null])),
        validationIssues: [],
        processing: {
            ocr_version: 'v2',
            pipeline_version: 'indigency_v2',
            ocr_engine: 'enhanced_ocr',
            model: result.model,
            confidence_policy: 'nullable',
        },
        claimedBy: deviceId,
    });
    console.info('INDIGENCY_V2_CANDIDATE_PERSISTED', {
        request_id: String(requestId).slice(0, 8), attempt,
        duration_ms: Date.now() - startedAt, status: completed.request?.status || 'review_required',
    });
    clearVerifiedOriginal(requestId);
    if (completed.request?.status === 'review_required') {
        console.info('INDIGENCY_V2_REVIEW_REQUIRED', {
            request_id: String(requestId).slice(0, 8), attempt,
            duration_ms: Date.now() - startedAt, status: completed.request.status,
        });
    }
    return completed;
};

exports.acceptUploads = async ({ requestId, deviceId }) => {
    const request = await iotOcrRequestService.getRequestById({ requestId });
    if (!request || request.document_key !== 'certificate_of_indigency' || request.ocr_version !== 'v2') throw httpError(409, 'Indigency Enhanced OCR request is not available');
    if (String(request.claimed_by || '') !== String(deviceId || '')) throw httpError(409, 'Request belongs to another Pi device');
    if (['review_required', 'completed'].includes(request.status)) return { accepted: false, idempotent: true, request, candidate: await iotOcrRequestService.getCandidate({ applicationId: request.application_id, documentKey: request.document_key, requestId }) };
    if (request.status !== 'processing') throw httpError(409, `Cannot accept uploads from ${request.status}`);
    const original = await downloadOriginal(requestId);
    await markOriginalAvailable(requestId);
    rememberVerifiedOriginal(requestId, original);
    const claim = await iotOcrRequestService.claimAsyncProcessing({ requestId, owner: `backend:${process.pid}:${crypto.randomUUID()}` });
    console.info('INDIGENCY_V2_ACCEPTED', {
        request_id: String(requestId).slice(0, 8),
        attempt: Number(claim.request?.processing_attempt_count || 0),
        status: claim.request?.status || 'processing',
    });
    return claim.claimed ? { accepted: true, request: claim.request, artifacts_preserved: true } : { accepted: false, idempotent: true, request: await iotOcrRequestService.getRequestById({ requestId }) };
};

module.exports = { ...exports, FIELD_KEYS, INDIGENCY_SCHEMA, normalizeFields };

module.exports.streamOriginal = async ({ requestId, applicationId }) => {
    const request = await iotOcrRequestService.getRequestById({ requestId });
    if (!request || String(request.application_id) !== String(applicationId)
        || request.document_key !== 'certificate_of_indigency' || request.ocr_version !== 'v2'
        || !['review_required', 'completed', 'failed'].includes(request.status)) {
        throw httpError(404, 'Captured image not found');
    }
    const image = await downloadOriginal(requestId);
    if (!['image/jpeg', 'image/png'].includes(image.mime_type)) {
        throw httpError(415, 'Unsupported captured image type');
    }
    return { mime_type: image.mime_type, bytes: image.bytes };
};
