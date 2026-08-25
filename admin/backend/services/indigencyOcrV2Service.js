const crypto = require('crypto');
const pool = require('../config/db');
const supabase = require('../config/supabase');
const iotOcrRequestService = require('./iotOcrRequestService');
const enhancedOcrProvider = require('./enhancedOcrProvider');

const BUCKET = String(process.env.IOT_OCR_CAPTURE_BUCKET || 'iot-ocr-captures').trim();
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

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

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

function toField(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return { raw_text: normalized, normalized_value: normalized, confidence: null };
}

function normalizeFields(value) {
    const fields = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(FIELD_KEYS.map((key) => [key, toField(fields[key])]));
}

exports.completeUploads = async ({ requestId, deviceId }) => {
    const request = await iotOcrRequestService.getRequestById({ requestId });
    if (!request || request.document_key !== 'certificate_of_indigency' || request.ocr_version !== 'v2') {
        throw httpError(409, 'Indigency Enhanced OCR request is not available');
    }
    if (String(request.claimed_by || '') !== String(deviceId || '')) throw httpError(409, 'Request belongs to another Pi device');
    if (request.status === 'review_required' || request.status === 'completed') {
        return iotOcrRequestService.getCandidate({ applicationId: request.application_id, documentKey: request.document_key, requestId });
    }
    if (request.status !== 'processing') throw httpError(409, `Cannot complete uploads from ${request.status}`);
    const original = await downloadOriginal(requestId);
    let result;
    try {
        result = await enhancedOcrProvider.extract({
            documentType: 'certificate_of_indigency',
            image: original,
            schema: INDIGENCY_SCHEMA,
            instruction: 'Read the Certificate of Indigency literally. Extract certificate_subject_name and residency_address exactly as printed. Do not guess, infer, or add fields.',
        });
    } catch (error) {
        await iotOcrRequestService.completeRequest({
            requestId,
            status: 'failed',
            errorCode: error.code || 'INDIGENCY_V2_EXTRACTION_FAILED',
            errorMessage: 'Enhanced Indigency OCR failed',
            claimedBy: deviceId,
        });
        throw error;
    }
    const fields = normalizeFields(result.fields);
    return iotOcrRequestService.completeRequest({
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
};

module.exports = { ...exports, FIELD_KEYS, INDIGENCY_SCHEMA, normalizeFields };
