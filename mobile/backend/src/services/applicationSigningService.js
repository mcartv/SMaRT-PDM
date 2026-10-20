const crypto = require('crypto');
const supabase = require('../config/supabase');

const SIGNING_BUCKET = String(
    process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET || 'documents'
).trim().replace(/^\/+|\/+$/g, '').split('/')[0] || 'documents';
const SESSION_TTL_HOURS = Math.max(1, Math.min(72, Number(process.env.APPLICATION_SIGNING_SESSION_TTL_HOURS || 24)));
const TYPES = Object.freeze({
    student_signature: { path: 'student_signature', maxBytes: 2 * 1024 * 1024, mimes: new Set(['image/png']) },
    guardian_signature: { path: 'guardian_signature', maxBytes: 2 * 1024 * 1024, mimes: new Set(['image/png']) },
    guardian_id: { path: 'guardian_id', maxBytes: 8 * 1024 * 1024, mimes: new Set(['image/jpeg', 'image/png', 'application/pdf']) },
});
const APPLICATION_DOCUMENT_TYPES = Object.freeze({
    'Student Signature': 'student_signature',
    'Guardian Signature': 'guardian_signature',
    'Guardian ID': 'guardian_id',
});

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function text(value) { return value == null ? '' : String(value).trim(); }

function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

// The signing hash binds the applicant-visible form, not transport-only
// fields.  Normalize equivalent empty values before hashing so an optional
// family phone represented as null, whitespace, or N/A cannot create a false
// mismatch between session creation and final submission.  The submitted form
// itself is still validated and persisted unchanged by applicationService.
function canonicalizeApplicationForm(value, path = []) {
    if (Array.isArray(value)) {
        return value.map((item, index) => canonicalizeApplicationForm(item, [...path, String(index)]));
    }
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((output, key) => {
            output[key] = canonicalizeApplicationForm(value[key], [...path, key]);
            return output;
        }, {});
    }
    const isOptionalFamilyMobile = path.length >= 3 &&
        path[path.length - 1] === 'mobile' &&
        path[path.length - 3] === 'family' &&
        ['father', 'mother', 'guardian'].includes(path[path.length - 2]);
    if (value === null || value === undefined) {
        return isOptionalFamilyMobile ? 'N/A' : '';
    }
    if (typeof value !== 'string') return value;

    const normalized = value.trim();
    const isNumericFormField = ['age', 'gwa', 'parent_marilao_residency_duration']
        .includes(path[path.length - 1]);
    if (isOptionalFamilyMobile && (!normalized || normalized.toUpperCase() === 'N/A')) {
        return 'N/A';
    }
    if (isNumericFormField && /^[-+]?\d+(?:\.\d+)?$/.test(normalized)) {
        return Number(normalized);
    }
    return normalized;
}

function hashApplicationForm(payload = {}) {
    const copy = { ...payload };
    delete copy.signing_session_id;
    delete copy.signingSessionId;
    delete copy.edit_existing_application;
    return crypto.createHash('sha256')
        .update(stableJson(canonicalizeApplicationForm(copy)))
        .digest('hex');
}

function fileType(file) {
    const buffer = file?.buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
    return null;
}

function extension(mime) {
    return mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'pdf';
}

function signingTypeForApplicationDocument(documentType) {
    return APPLICATION_DOCUMENT_TYPES[text(documentType)] || null;
}

function validateSigningDocumentFile(type, file) {
    const config = TYPES[type];
    if (!config) throw httpError(400, 'Invalid signing document type.');
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
        throw httpError(400, 'File is required.');
    }
    if (file.buffer.length > config.maxBytes) {
        throw httpError(413, 'Signing file exceeds the allowed size.');
    }
    const detectedMime = fileType(file);
    if (!detectedMime || !config.mimes.has(detectedMime)) {
        throw httpError(400, 'The uploaded file content is not an allowed type for this document.');
    }
    return { config, detectedMime };
}

async function getOwnedSession(userId, sessionId, { forUpdate = false } = {}) {
    const { data, error } = await supabase.from('application_signing_sessions')
        .select('*').eq('signing_session_id', sessionId).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!data) throw httpError(404, 'Signing session not found.');
    if (new Date(data.expires_at).getTime() <= Date.now() && data.finalized_at == null) {
        await supabase.from('application_signing_sessions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('signing_session_id', sessionId);
        throw httpError(409, 'Signing session has expired.');
    }
    if (data.finalized_at || data.status === 'finalized') throw httpError(409, 'Signing session has already been finalized.');
    return data;
}

function complete(session) {
    return Boolean(session.consent_acknowledged_at && text(session.guardian_name) && text(session.guardian_relationship) && session.student_signature_path && session.guardian_signature_path && session.guardian_id_path);
}

async function presentSession(session) {
    const output = {
        signing_session_id: session.signing_session_id,
        application_form_hash: session.application_form_hash,
        guardian_name: session.guardian_name,
        guardian_relationship: session.guardian_relationship,
        consent_acknowledged_at: session.consent_acknowledged_at,
        expires_at: session.expires_at,
        status: session.status,
        complete: complete(session),
        documents: {},
    };
    for (const [type, config] of Object.entries(TYPES)) {
        const path = session[`${config.path}_path`];
        output.documents[type] = { uploaded: Boolean(path), preview_url: null };
        if (path) {
            const { data, error } = await supabase.storage.from(SIGNING_BUCKET).createSignedUrl(path, 60 * 10);
            if (error) throw error;
            output.documents[type].preview_url = data?.signedUrl || null;
        }
    }
    return output;
}

async function createSigningSession(userId, body = {}) {
    const applicationForm = body.application_form;
    if (!applicationForm || typeof applicationForm !== 'object' || Array.isArray(applicationForm)) {
        throw httpError(400, 'application_form is required to create a signing session.');
    }
    const formHash = hashApplicationForm(applicationForm);
    const guardianName = text(body.guardian_name);
    const guardianRelationship = text(body.guardian_relationship);
    const consent = body.consent_acknowledged === true;
    const { data: existing, error: existingError } = await supabase.from('application_signing_sessions')
        .select('*').eq('user_id', userId).eq('application_form_hash', formHash)
        .in('status', ['draft', 'ready']).is('finalized_at', null).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return presentSession(existing);

    const now = new Date();
    const { data, error } = await supabase.from('application_signing_sessions').insert({
        user_id: userId, application_form_hash: formHash, guardian_name: guardianName,
        guardian_relationship: guardianRelationship,
        consent_acknowledged_at: consent ? now.toISOString() : null,
        expires_at: new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    }).select('*').single();
    if (error) throw error;
    return presentSession(data);
}

async function getSigningSession(userId, sessionId) {
    return presentSession(await getOwnedSession(userId, sessionId));
}

async function uploadSigningDocument(userId, sessionId, type, file) {
    const config = TYPES[type];
    if (!config) throw httpError(400, 'Invalid signing document type.');
    const session = await getOwnedSession(userId, sessionId);
    const { detectedMime } = validateSigningDocumentFile(type, file);
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    if (session[`${config.path}_sha256`] === sha256 && session[`${config.path}_path`]) return presentSession(session);

    const objectPath = `application-signing/${userId}/${sessionId}/${config.path}-${crypto.randomUUID()}.${extension(detectedMime)}`;
    const { error: storageError } = await supabase.storage.from(SIGNING_BUCKET).upload(objectPath, file.buffer, { contentType: detectedMime, upsert: false });
    if (storageError) throw storageError;
    const fields = {
        [`${config.path}_path`]: objectPath,
        [`${config.path}_name`]: `${config.path}.${extension(detectedMime)}`,
        [`${config.path}_sha256`]: sha256,
        [`${config.path}_size_bytes`]: file.buffer.length,
        status: complete({ ...session, [`${config.path}_path`]: objectPath }) ? 'ready' : 'draft',
        updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('application_signing_sessions').update(fields)
        .eq('signing_session_id', sessionId).eq('user_id', userId).is('finalized_at', null).select('*').single();
    if (error) {
        await supabase.storage.from(SIGNING_BUCKET).remove([objectPath]);
        throw error;
    }
    return presentSession(data);
}

async function finalizeSigningSession({ userId, studentId, applicationId, signingSessionId, applicationForm }) {
    if (!signingSessionId) throw httpError(400, 'Signing session is required.');
    const formHash = hashApplicationForm(applicationForm);
    const { data, error } = await supabase.rpc('finalize_application_signing_session', {
        p_signing_session_id: signingSessionId, p_user_id: userId, p_application_id: applicationId,
        p_application_form_hash: formHash, p_uploaded_by: studentId, p_created_by: userId,
    });
    if (error) {
        if (error.code === '42501') throw httpError(403, 'You do not own this signing session.');
        if (error.code === '23505') throw httpError(409, error.message);
        if (error.code === '22023') throw httpError(409, error.message);
        throw error;
    }
    return data;
}

async function submitApplicationWithSigning({
    userId,
    studentId,
    openingId,
    programId,
    applicationPayload,
    signingSessionId,
    applicationForm,
    editExistingApplication = false,
    applicationStatus = 'Pending Review',
    documentStatus = 'Missing Docs',
    verificationStatus = 'pending',
    gwa = null,
}) {
    if (!signingSessionId) throw httpError(400, 'Signing session is required.');
    const { data, error } = await supabase.rpc('submit_application_with_signing', {
        p_user_id: userId,
        p_student_id: studentId,
        p_opening_id: openingId,
        p_program_id: programId,
        p_application_payload: applicationPayload,
        p_application_form_hash: hashApplicationForm(applicationForm),
        p_signing_session_id: signingSessionId,
        p_edit_existing: editExistingApplication,
        p_application_status: applicationStatus,
        p_document_status: documentStatus,
        p_verification_status: verificationStatus,
        p_gwa: gwa,
    });
    if (error) {
        if (error.code === '42501') throw httpError(403, error.message || 'You are not allowed to submit this application.');
        if (error.code === '23505' || error.code === '22023') throw httpError(409, error.message);
        throw error;
    }
    if (!data?.application?.application_id) {
        throw httpError(500, 'The application signing transaction did not return an application.');
    }
    return data;
}

module.exports = {
    createSigningSession,
    getSigningSession,
    uploadSigningDocument,
    finalizeSigningSession,
    submitApplicationWithSigning,
    hashApplicationForm,
    canonicalizeApplicationForm,
    signingTypeForApplicationDocument,
    validateSigningDocumentFile,
    extension,
};
