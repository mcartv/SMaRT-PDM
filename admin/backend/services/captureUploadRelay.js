const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// The existing worker PUTs raw image bytes to signed_url without Pi headers.
// A short-lived, artifact-scoped capability preserves that protocol.
function secret() {
    const value = String(process.env.PI_SHARED_TOKEN || '').trim();
    if (!value) throw new Error('Pi upload signing is not configured');
    return value;
}

function authorize(req, data) {
    return { ...data, artifacts: data.artifacts.map((artifact) => {
        const token = jwt.sign({ requestId: req.params.requestId, artifactId: artifact.artifact_id,
            deviceId: req.piAuth.deviceId }, secret(), {
            algorithm: 'HS256', audience: 'iot-capture-upload', expiresIn: '10m',
        });
        return { ...artifact, token, signed_url: `${req.protocol}://${req.get('host')}/api/pi/iot-ocr/${req.params.requestId}/capture-artifacts/${artifact.artifact_id}/upload?token=${encodeURIComponent(token)}` };
    }) };
}

function verify(req, res, next) {
    try {
        const claims = jwt.verify(String(req.query.token || ''), secret(), {
            algorithms: ['HS256'], audience: 'iot-capture-upload',
        });
        if (claims.requestId !== req.params.requestId || claims.artifactId !== req.params.artifactId) throw new Error();
        req.captureUpload = claims;
        next();
    } catch {
        res.status(403).json({ code: 'CAPTURE_UPLOAD_UNAUTHORIZED', error: 'Capture upload authorization is invalid or expired' });
    }
}

async function upload(req, res) {
    const pool = require('../config/db');
    const supabase = require('../config/supabase');
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const result = await client.query(`
            SELECT a.*, r.status AS request_status, r.claimed_by, r.document_key, r.ocr_version
            FROM public.iot_ocr_capture_artifacts a
            JOIN public.iot_ocr_requests r ON r.request_id = a.request_id
            WHERE a.request_id = $1::uuid AND a.artifact_id = $2::uuid
            FOR UPDATE OF r, a
        `, [req.params.requestId, req.params.artifactId]);
        const row = result.rows[0];
        if (!row || row.request_status !== 'processing' || row.ocr_version !== 'v2'
            || !['student_grade_forms', 'certificate_of_indigency'].includes(row.document_key)
            || String(row.claimed_by) !== req.captureUpload.deviceId
            || String(row.device_id) !== req.captureUpload.deviceId || row.artifact_kind !== 'original') {
            throw Object.assign(new Error('Capture request is no longer available for upload'), { statusCode: 409 });
        }
        const bytes = req.body;
        if (!Buffer.isBuffer(bytes) || bytes.length !== Number(row.byte_count)
            || req.get('content-type')?.split(';')[0].trim().toLowerCase() !== row.mime_type
            || crypto.createHash('sha256').update(bytes).digest('hex') !== row.sha256) {
            throw Object.assign(new Error('Capture does not match its authorized manifest'), { statusCode: 400 });
        }
        const stored = await supabase.storage.from(row.bucket_name).upload(row.object_path, bytes, {
            contentType: row.mime_type, upsert: true, cacheControl: '0',
        });
        if (stored.error) throw Object.assign(new Error('Private capture storage is temporarily unavailable'), { statusCode: 502 });
        await client.query(`UPDATE public.iot_ocr_capture_artifacts
            SET upload_status = 'available', uploaded_at = COALESCE(uploaded_at, NOW()), updated_at = NOW()
            WHERE artifact_id = $1::uuid`, [row.artifact_id]);
        await client.query('COMMIT');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ uploaded: true });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('CAPTURE_UPLOAD_RELAY_FAILED', { status: error.statusCode || 500, code: error.code || null });
        return res.status(error.statusCode || 500).json({ code: 'CAPTURE_UPLOAD_FAILED',
            error: error.statusCode ? error.message : 'Private capture upload failed' });
    } finally {
        client?.release();
    }
}

module.exports = { authorize, verify, upload };
