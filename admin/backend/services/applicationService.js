const path = require('path');
const https = require('https');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const pool = require('../config/db');
const _ = require('lodash');
const iotOcrRequestService = require('./iotOcrRequestService');
const documentTypes = require('../utils/documentTypes');
const readinessQueueService = require('./readinessQueueService');
const { resolveMarilaoResidency } = require('../utils/marilaoResidency');
const {
    isRequestBoundSnapshotFresh,
} = require('../utils/iotOcrSnapshotFreshness');

function normalizeStorageBucketName(value, fallback = 'documents') {
    const normalized = String(value || fallback)
        .trim()
        .replace(/^\/+|\/+$/g, '');

    if (!normalized) return fallback;

    // Supabase Storage accepts a bucket name only. A value such as
    // "documents/applications" means bucket "documents" and folder
    // "applications"; the folder must remain in the object path.
    return normalized.split('/').filter(Boolean)[0] || fallback;
}

const STORAGE_BUCKET = normalizeStorageBucketName(
    process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET,
    'documents'
);
const STUDENT_BACKEND_BASE_URL =
    process.env.STUDENT_BACKEND_BASE_URL || 'http://127.0.0.1:3000';
const IOT_OCR_ENDPOINT_URL =
    (process.env.IOT_OCR_ENDPOINT_URL || '').trim();
const IOT_OCR_API_KEY =
    (process.env.IOT_OCR_API_KEY || '').trim();
const INTERNAL_NOTIFICATION_SECRET =
    (process.env.INTERNAL_NOTIFICATION_SECRET || '').trim();
const IOT_OCR_TIMEOUT_MS = Number(process.env.IOT_OCR_TIMEOUT_MS || 15000);
const BIRTH_STRUCTURED_FIELD_KEYS = Object.freeze([
    'child_name',
    'mother_maiden_name',
    'father_name',
]);

const APPROVED_SCHOLAR_NOTIFICATION = Object.freeze({
    type: 'Application',
    title: 'Scholarship Application Approved',
    message:
        'Congratulations! Your scholarship application has been approved. Scholar features are now available in your account.',
    referenceType: 'application',
});

const REJECTED_APPLICATION_NOTIFICATION = Object.freeze({
    type: 'Application Rejected',
    title: 'Application Rejected',
    message:
        'Your application verification is complete and your application has been rejected.',
    referenceType: 'application',
});

const APPLICATION_DOCUMENT_DEFINITIONS = [
    {
        id: 'birth_certificate',
        name: 'Birth Certificate / PSA',
        aliases: [
            'birth certificate',
            'birth certificate / psa',
            'psa birth certificate',
            'certificate of live birth',
            'psa',
            'nso',
        ],
    },
    {
        id: 'certificate_of_registration',
        name: 'Certificate of Registration',
        aliases: ['certificate of registration', 'cor', 'registration form', 'registration'],
    },
    {
        id: 'student_grade_forms',
        name: 'Grade Form',
        aliases: [
            'student grade forms',
            'grade forms',
            'grades',
            'grade card',
            'report card',
            'grade form',
            'grade report'
        ],
    },
    {
        id: 'certificate_of_indigency',
        name: 'Certificate of Indigency',
        aliases: ['certificate of indigency', 'indigency'],
    },
    {
        id: 'letter_of_request',
        name: 'Letter of Request',
        aliases: ['letter of request', 'request letter', 'lor'],
    },
    {
        id: 'application_form',
        name: 'Application Form',
        aliases: ['application form', 'application'],
    },
];

const DOCUMENT_TYPE_ALIASES = {
    birth_certificate: 'birth_certificate',
    birth_certificate_psa: 'birth_certificate',
    psa_birth_certificate: 'birth_certificate',
    certificate_of_live_birth: 'birth_certificate',
    certificate_of_live_birth_psa: 'birth_certificate',
    psa: 'birth_certificate',
    nso: 'birth_certificate',

    cor: 'certificate_of_registration',
    certificate_of_registration: 'certificate_of_registration',
    registration: 'certificate_of_registration',
    registration_form: 'certificate_of_registration',

    grade_card: 'student_grade_forms',
    grade_forms: 'student_grade_forms',
    grades: 'student_grade_forms',
    student_grade_forms: 'student_grade_forms',
    grade_form: 'student_grade_forms',
    grade_report: 'student_grade_forms',

    certificate_of_indigency: 'certificate_of_indigency',
    indigency: 'certificate_of_indigency',
    barangay_certificate: 'certificate_of_indigency',
    certificate_of_residency: 'certificate_of_indigency',
    barangay_clearance: 'certificate_of_indigency',

    lor: 'letter_of_request',
    letter_of_request: 'letter_of_request',
    request_letter: 'letter_of_request',

    application_form: 'application_form',
    application: 'application_form',

};

const DOCUMENT_TYPE_TO_NAME = {
    birth_certificate: 'Birth Certificate / PSA',
    certificate_of_registration: 'Certificate of Registration',
    student_grade_forms: 'Grade Report',
    certificate_of_indigency: 'Certificate of Indigency',
    letter_of_request: 'Letter of Request',
    application_form: 'Application Form',
};

const REQUIRED_REVIEW_DOCUMENT_KEYS = Object.freeze([
    'birth_certificate',
    'certificate_of_registration',
    'student_grade_forms',
    'certificate_of_indigency',
    'letter_of_request',
    'application_form',
]);

const REQUIRED_UPLOAD_DOCUMENT_NAMES = Object.freeze([
    'birth certificate / psa',
    'certificate of registration',
    'grade report',
    'certificate of indigency',
    'letter of request',
]);

async function resolveRequirementsCompletedAt(applicationId) {
    const result = await pool.query(
        `
        SELECT MAX(COALESCE(ad.submitted_at, ad.updated_at, ad.created_at)) AS completed_at
        FROM application_documents ad
        WHERE ad.application_id = $1
          AND COALESCE(ad.is_submitted, false) = true
          AND lower(trim(COALESCE(ad.document_type, ''))) = ANY($2::text[])
          AND (
            NULLIF(trim(COALESCE(ad.file_path, '')), '') IS NOT NULL
            OR NULLIF(trim(COALESCE(ad.file_url, '')), '') IS NOT NULL
          )
        `,
        [applicationId, REQUIRED_UPLOAD_DOCUMENT_NAMES]
    );

    return result.rows[0]?.completed_at || null;
}

function buildHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function isPrivateHostname(hostname = '') {
    const normalized = String(hostname || '').trim().toLowerCase();

    return (
        normalized === 'localhost' ||
        normalized === '127.0.0.1' ||
        normalized === '::1' ||
        normalized.startsWith('10.') ||
        normalized.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    );
}

function validateIotOcrEndpoint(rawUrl) {
    if (!rawUrl) {
        throw buildHttpError(500, 'IOT_OCR_ENDPOINT_URL is not configured.');
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(rawUrl);
    } catch (_error) {
        throw buildHttpError(500, 'IOT OCR endpoint URL is invalid.');
    }

    // Allow private IPs for local development
    const isLocalDevelopment = process.env.NODE_ENV === 'development' ||
        process.env.SUPABASE_URL?.includes('localhost') ||
        process.env.SUPABASE_URL?.includes('127.0.0.1') ||
        process.env.IOT_OCR_ALLOW_PRIVATE_IP === 'true';

    if (!isLocalDevelopment && isPrivateHostname(parsedUrl.hostname)) {
        throw buildHttpError(
            502,
            `IoT OCR endpoint is set to a private network address (${parsedUrl.hostname}) and is not reachable from deployed hosting.`
        );
    }

    // If the endpoint is configured as the device root URL, assume /scan.
    if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
        parsedUrl.pathname = '/scan';
    }

    return parsedUrl.toString();
}

function extractAvatarStoragePath(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return null;

    if (!/^https?:\/\//i.test(rawValue)) {
        return rawValue.replace(/^avatars\//, '');
    }

    const markers = [
        '/storage/v1/object/public/avatars/',
        '/storage/v1/object/sign/avatars/',
        '/storage/v1/object/authenticated/avatars/',
    ];

    for (const marker of markers) {
        const markerIndex = rawValue.indexOf(marker);
        if (markerIndex >= 0) {
            return rawValue.slice(markerIndex + marker.length).split('?')[0];
        }
    }

    return null;
}

async function resolveAvatarUrl(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return null;

    const storagePath = extractAvatarStoragePath(rawValue);
    if (!storagePath) {
        return rawValue;
    }

    const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    if (error) {
        return rawValue;
    }

    return data?.signedUrl || rawValue;
}

function getOrdinalSuffix(n) {
    const num = Number(n);
    if (num === 1) return 'st';
    if (num === 2) return 'nd';
    if (num === 3) return 'rd';
    return 'th';
}

function normalizeLookupValue(value) {
    return (value ?? '')
        .toString()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function deriveSlipCode(slipId) {
    const base = String(slipId || '').trim().split('-')[0].toUpperCase();
    return base ? `ES-${base}` : 'ES-PENDING';
}

function buildReadinessFlags(row = {}) {
    const verificationStatus = normalizeLookupValue(row.verification_status);
    const applicationStatus = normalizeLookupValue(row.application_status);
    const documentStatus = normalizeLookupValue(row.document_status);
    const endorsementStatusRaw = String(row.endorsement_overall_status || row.overall_status || '').trim().toLowerCase();
    // Downstream readiness trusts the coordinator's final requirements review.
    // Individual document-review counts are still surfaced for diagnostics, but
    // once verification_status is "verified" we do not re-litigate every
    // document row here.
    const requirementsVerifiedByCoordinator = verificationStatus === 'verified';
    const requirementsVerifiedByReviews =
        Number(row.verified_review_count || 0) >= REQUIRED_REVIEW_DOCUMENT_KEYS.length &&
        Number(row.uploaded_required_count || 0) >= REQUIRED_UPLOAD_DOCUMENT_NAMES.length;
    const endorsementComplete =
        endorsementStatusRaw === 'completed';
    const blockers = [];
    let requirementsStatus = 'under_review';
    let endorsementStatus = endorsementStatusRaw || null;

    if (
        verificationStatus === 'rejected' ||
        applicationStatus === 'rejected' ||
        applicationStatus === 'disqualified'
    ) {
        requirementsStatus = 'rejected';
    } else if (
        applicationStatus === 'requires reupload' ||
        documentStatus === 'requires reupload'
    ) {
        requirementsStatus = 'reupload_required';
    } else if (requirementsVerifiedByCoordinator) {
        requirementsStatus = 'verified';
    } else if (Number(row.uploaded_required_count || 0) < REQUIRED_UPLOAD_DOCUMENT_NAMES.length) {
        requirementsStatus = 'missing';
    } else if (requirementsVerifiedByReviews) {
        requirementsStatus = 'under_review';
    }

    const requirementsComplete = requirementsStatus === 'verified';
    const workflowComplete = requirementsComplete && endorsementComplete;
    const selectionStatus = normalizeLookupValue(row.selection_status);
    const queuePosition = row.queue_position == null ? null : Number(row.queue_position);
    const waitlistPosition = row.waitlist_position == null ? null : Number(row.waitlist_position);
    const fcfsQueued = workflowComplete && Number.isFinite(queuePosition) && queuePosition > 0;
    const waitlisted = selectionStatus === 'waitlisted';
    const holdsReservedSlot = ['reserved', 'promoted', 'selected'].includes(selectionStatus);
    const scholarActivationReady = fcfsQueued && holdsReservedSlot && !waitlisted;

    if (endorsementStatusRaw === 'disqualified_major') {
        endorsementStatus = 'major_offense';
    } else if (['rejected', 'guidance_rejected', 'disqualified_minor'].includes(endorsementStatusRaw)) {
        endorsementStatus = 'rejected';
    }

    if (requirementsStatus !== 'verified') blockers.push(`requirements.${requirementsStatus}`);
    if (!endorsementComplete && endorsementStatus) {
        blockers.push(
            ['pending_sdo', 'pending_guidance', 'pending_pd'].includes(endorsementStatus)
                ? endorsementStatus
                : `endorsement.${endorsementStatus}`
        );
    }

    return {
        requirements_complete: requirementsComplete,
        endorsement_complete: endorsementComplete,
        workflow_complete: workflowComplete,
        fcfs_queued: fcfsQueued,
        is_waitlisted: waitlisted,
        holds_reserved_slot: holdsReservedSlot,
        scholar_activation_ready: scholarActivationReady,
        requirements_incomplete: !requirementsComplete,
        endorsement_pending: !endorsementComplete,
        needs_activation_attention: workflowComplete && !scholarActivationReady,
        blockers,
        verified_review_count: Number(row.verified_review_count || 0),
        uploaded_required_count: Number(row.uploaded_required_count || 0),
        requirements_status: requirementsStatus,
        endorsement_status: row.endorsement_overall_status || row.overall_status || null,
        normalized_endorsement_status: endorsementStatus,
        endorsement_slip_id: row.endorsement_slip_id || row.slip_id || null,
        endorsement_slip_code: deriveSlipCode(row.endorsement_slip_id || row.slip_id || null),
        endorsement_current_stage: row.endorsement_current_stage || row.current_stage || null,
        selection_status: row.selection_status || null,
        queue_position: queuePosition,
        waitlist_position: waitlistPosition,
        fcfs_completed_at: row.fcfs_completed_at || null,
        requirements_completed_at: row.requirements_completed_at || null,
        requirements_verified_at: row.requirements_verified_at || null,
    };
}

async function fetchApplicationReadinessMap(applicationIds = []) {
    const normalizedIds = [...new Set((applicationIds || []).filter(Boolean))];
    if (!normalizedIds.length) {
        return new Map();
    }

    const { rows } = await pool.query(
        `
        with review_summary as (
            select
                adr.application_id,
                count(distinct case
                    when lower(coalesce(adr.document_key, '')) = any($2::text[])
                     and lower(coalesce(adr.review_status, '')) = 'verified'
                    then lower(adr.document_key)
                end) as verified_review_count
            from application_document_reviews adr
            where adr.application_id = any($1::uuid[])
            group by adr.application_id
        ),
        upload_summary as (
            select
                ad.application_id,
                count(distinct case
                    when lower(coalesce(ad.document_type, '')) = any($3::text[])
                     and coalesce(ad.is_submitted, false) = true
                     and (
                        nullif(trim(coalesce(ad.file_path, '')), '') is not null
                        or nullif(trim(coalesce(ad.file_url, '')), '') is not null
                     )
                    then lower(ad.document_type)
                end) as uploaded_required_count
            from application_documents ad
            where ad.application_id = any($1::uuid[])
            group by ad.application_id
        )
        select
            a.application_id,
            a.application_status,
            a.document_status,
            a.verification_status,
            a.selection_status,
            a.queue_position,
            a.waitlist_position,
            a.fcfs_completed_at,
            a.requirements_completed_at,
            a.requirements_verified_at,
            es.slip_id as endorsement_slip_id,
            es.overall_status as endorsement_overall_status,
            es.current_stage as endorsement_current_stage,
            coalesce(rs.verified_review_count, 0) as verified_review_count,
            coalesce(us.uploaded_required_count, 0) as uploaded_required_count
        from applications a
        left join endorsement_slips es
            on es.application_id = a.application_id
        left join review_summary rs
            on rs.application_id = a.application_id
        left join upload_summary us
            on us.application_id = a.application_id
        where a.application_id = any($1::uuid[])
        `,
        [normalizedIds, REQUIRED_REVIEW_DOCUMENT_KEYS, REQUIRED_UPLOAD_DOCUMENT_NAMES]
    );

    const readinessMap = new Map();
    rows.forEach((row) => {
        readinessMap.set(row.application_id, buildReadinessFlags(row));
    });

    normalizedIds.forEach((applicationId) => {
        if (!readinessMap.has(applicationId)) {
            readinessMap.set(applicationId, buildReadinessFlags({}));
        }
    });

    return readinessMap;
}

async function fetchApplicationReadiness(applicationId) {
    const readinessMap = await fetchApplicationReadinessMap([applicationId]);
    return readinessMap.get(applicationId) || buildReadinessFlags({});
}

async function decorateApplicationRecordsWithReadiness(records = []) {
    const readinessMap = await fetchApplicationReadinessMap(
        records.map((row) => row.application_id).filter(Boolean)
    );

    return records.map((row) => ({
        ...row,
        ...(readinessMap.get(row.application_id) || buildReadinessFlags({})),
    }));
}

function buildVerificationOutcomeNotification({
    outcome,
    applicationId,
    scholarId = null,
}) {
    if (outcome === 'approved') {
        return {
            ...APPROVED_SCHOLAR_NOTIFICATION,
            referenceId: scholarId,
        };
    }

    if (outcome === 'rejected') {
        return {
            ...REJECTED_APPLICATION_NOTIFICATION,
            referenceId: applicationId,
        };
    }

    return null;
}

async function relayStudentNotification({
    userId,
    type,
    title,
    message,
    referenceId = null,
    referenceType = null,
    createdAt = null,
}) {
    const endpoint = new URL('/api/internal/notifications/user', STUDENT_BACKEND_BASE_URL);
    const headers = {
        'Content-Type': 'application/json',
    };

    if (INTERNAL_NOTIFICATION_SECRET) {
        headers['x-internal-notification-secret'] = INTERNAL_NOTIFICATION_SECRET;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            userId,
            type,
            title,
            message,
            referenceId,
            referenceType,
            createdAt,
        }),
    });

    const rawBody = await response.text();
    let payload = {};

    if (rawBody) {
        try {
            payload = JSON.parse(rawBody);
        } catch (_error) {
            payload = {};
        }
    }

    if (!response.ok) {
        throw new Error(
            payload.error ||
            `Student backend notification relay failed with status ${response.status}.`
        );
    }

    return payload;
}

async function insertNotificationFallback({
    userId,
    type,
    title,
    message,
    referenceId = null,
    referenceType = null,
    createdAt = null,
}) {
    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            type,
            title,
            message,
            reference_id: referenceId,
            reference_type: referenceType,
            is_read: false,
            push_sent: false,
            created_at: createdAt || new Date().toISOString(),
        })
        .select(
            'notification_id, user_id, type, title, message, reference_id, reference_type, is_read, push_sent, created_at'
        )
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

async function deliverVerificationOutcomeNotification({
    outcome,
    applicationId,
    userId,
    scholarId = null,
}) {
    const notification = buildVerificationOutcomeNotification({
        outcome,
        applicationId,
        scholarId,
    });

    if (!notification || !userId) {
        return null;
    }

    const createdAt = new Date().toISOString();

    try {
        const relayPayload = await relayStudentNotification({
            userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            referenceId: notification.referenceId,
            referenceType: notification.referenceType,
            createdAt,
        });

        return {
            delivery: 'relay',
            notification:
                relayPayload.notification ||
                relayPayload.data ||
                null,
        };
    } catch (relayError) {
        console.error(
            'STUDENT NOTIFICATION RELAY ERROR:',
            relayError.message || relayError
        );

        try {
            const fallbackNotification = await insertNotificationFallback({
                userId,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                referenceId: notification.referenceId,
                referenceType: notification.referenceType,
                createdAt,
            });

            return {
                delivery: 'database_fallback',
                notification: fallbackNotification,
                relayError: relayError.message || String(relayError),
            };
        } catch (fallbackError) {
            console.error(
                'STUDENT NOTIFICATION FALLBACK ERROR:',
                fallbackError.message || fallbackError
            );

            return {
                delivery: 'failed',
                relayError: relayError.message || String(relayError),
                fallbackError: fallbackError.message || String(fallbackError),
            };
        }
    }
}

function normalizeDocumentType(value) {
    const normalized = (value || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');

    return DOCUMENT_TYPE_ALIASES[normalized] || normalized;
}

function getDocumentKey(document = {}) {
    const raw =
        document.document_type ||
        document.file_name ||
        document.document_name ||
        '';

    return normalizeDocumentType(raw);
}

function deriveReviewStatus(document = {}, review = null) {
    const preferredStatus = normalizeLookupValue(review?.review_status);

    if (preferredStatus === 'verified') return 'verified';
    if (preferredStatus === 'rejected' || preferredStatus === 're upload') return 'rejected';
    if (preferredStatus === 'uploaded' || preferredStatus === 'under review') return 'uploaded';

    return document.is_submitted || document.file_path || document.file_url ? 'uploaded' : 'pending';
}

function deriveAggregateDocumentStatus(summary = {}) {
    const verifiedCount = Number(summary?.verified || 0);
    const uploadedCount = Number(summary?.uploaded || 0);
    const rejectedCount = Number(summary?.rejected || summary?.reupload || 0);
    const pendingCount = Number(summary?.pending || 0);

    if (uploadedCount === 0) return 'Missing Docs';
    if (pendingCount > 0) return 'Under Review';
    if (rejectedCount > 0) return 'Under Review';
    if (verifiedCount > 0 && verifiedCount === uploadedCount) return 'Documents Ready';

    return 'Under Review';
}

function ensureDocumentCoverage(normalizedDocuments = []) {
    const documentMap = new Map(
        normalizedDocuments.map((document) => [document.id, document])
    );

    const requiredDocuments = APPLICATION_DOCUMENT_DEFINITIONS.map((definition) => {
        return (
            documentMap.get(definition.id) || {
                id: definition.id,
                document_key: definition.id,
                name: definition.name,
                document_type: definition.name,
                file_name: null,
                file_path: null,
                file_url: null,
                signed_url: null,
                status: 'pending',
                admin_comment: '',
                notes: null,
                ocr: {},
                ocr_confidence: null,
                submitted_at: null,
                reviewed_at: null,
            }
        );
    });

    const extraDocuments = normalizedDocuments.filter(
        (document) =>
            !APPLICATION_DOCUMENT_DEFINITIONS.some(
                (definition) => definition.id === document.id
            )
    );

    return [...requiredDocuments, ...extraDocuments];
}

function resolveStorageContentType(fileExt, fallbackMime = '') {
    const normalizedExt = (fileExt || '').toLowerCase();

    if (normalizedExt === '.pdf') return 'application/pdf';
    if (normalizedExt === '.jpg' || normalizedExt === '.jpeg') return 'image/jpeg';
    if (normalizedExt === '.png') return 'image/png';
    if (normalizedExt === '.webp') return 'image/webp';

    return fallbackMime || 'application/octet-stream';
}

function normalizeOcrPayload(payload = {}) {
    const confidence =
        payload?.ocr_confidence ??
        payload?.confidence ??
        payload?.ocr?.confidence ??
        null;

    const rawText =
        payload?.raw_text ??
        payload?.text ??
        payload?.ocr_text ??
        payload?.ocr?.raw_text ??
        payload?.ocr?.text ??
        '';

    const extractedFields =
        payload?.extracted_fields ??
        payload?.fields ??
        payload?.ocr?.extracted_fields ??
        {};

    const ocr =
        payload?.ocr && typeof payload.ocr === 'object'
            ? payload.ocr
            : {
                ...extractedFields,
                raw_text: rawText,
                confidence,
            };

    return {
        ocr,
        ocr_confidence: confidence,
        raw_text: rawText,
        extracted_fields: extractedFields,
        source_payload:
            payload?.source_payload && typeof payload.source_payload === 'object'
                ? payload.source_payload
                : payload,
    };
}

function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeIssueCodes(value) {
    if (!Array.isArray(value)) return [];

    return value
        .filter((code) => typeof code === 'string')
        .map((code) => code.trim())
        .filter(Boolean);
}

function sanitizeBirthStructuredFields(extractedFields = {}) {
    if (!isRecord(extractedFields)) return {};

    const sourceFields = isRecord(extractedFields.fields)
        ? extractedFields.fields
        : {};
    const fields = {};

    for (const fieldKey of BIRTH_STRUCTURED_FIELD_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(sourceFields, fieldKey)) continue;

        const sourceField = sourceFields[fieldKey];
        const normalizedField = isRecord(sourceField)
            ? sourceField
            : { raw_text: sourceField };
        const field = {
            raw_text:
                typeof normalizedField.raw_text === 'string'
                    ? normalizedField.raw_text
                    : '',
            review_required: normalizedField.review_required !== false,
        };

        if (typeof normalizedField.success === 'boolean') {
            field.success = normalizedField.success;
        }

        fields[fieldKey] = field;
    }

    const ocrAttempts = Number(extractedFields.ocr_attempts);
    const structured = {
        document_type: 'birth_certificate',
        fields,
    };

    if (Number.isFinite(ocrAttempts) && ocrAttempts >= 0) {
        structured.ocr_attempts = Math.trunc(ocrAttempts);
    }

    if (
        typeof extractedFields.preprocessing_variant === 'string' &&
        extractedFields.preprocessing_variant.trim()
    ) {
        structured.preprocessing_variant = extractedFields.preprocessing_variant.trim();
    }

    if (typeof extractedFields.review_required === 'boolean') {
        structured.review_required = extractedFields.review_required;
    }

    return structured;
}

function sanitizeGenericStructuredFields(extractedFields = {}) {
    if (!isRecord(extractedFields)) return {};

    try {
        const cloned = JSON.parse(JSON.stringify(extractedFields));
        return isRecord(cloned) ? cloned : {};
    } catch {
        return {};
    }
}

function sanitizeStructuredOcrFields(documentKey, extractedFields = {}) {
    const normalizedDocumentKey = normalizeDocumentType(documentKey);
    const documentType = normalizeDocumentType(extractedFields?.document_type);
    const isBirthCertificate =
        normalizedDocumentKey === 'birth_certificate' ||
        documentType === 'birth_certificate';

    return isBirthCertificate
        ? sanitizeBirthStructuredFields(extractedFields)
        : sanitizeGenericStructuredFields(extractedFields);
}

function sanitizeOcrProcessingMetadata(sourcePayload = {}, structuredFields = {}) {
    if (!isRecord(sourcePayload)) return {};

    const metadata = {};
    const statusKeys = [
        'worker_status',
        'registration_status',
        'cropper_status',
        'ocr_status',
    ];
    const issueKeys = [
        'registration_issue_codes',
        'cropper_issue_codes',
        'ocr_issue_codes',
    ];

    for (const key of statusKeys) {
        if (typeof sourcePayload[key] === 'string' && sourcePayload[key].trim()) {
            metadata[key] = sourcePayload[key].trim();
        }
    }

    for (const key of issueKeys) {
        metadata[key] = sanitizeIssueCodes(sourcePayload[key]);
    }

    const actualFieldKeys = isRecord(structuredFields.fields)
        ? Object.keys(structuredFields.fields)
        : [];
    const requestedFieldKeys = Array.isArray(sourcePayload.structured_field_keys)
        ? sourcePayload.structured_field_keys.filter((key) => actualFieldKeys.includes(key))
        : actualFieldKeys;

    if (requestedFieldKeys.length > 0) {
        metadata.structured_field_keys = [...new Set(requestedFieldKeys)].sort();
    }

    const ocrAttempts = Number(
        sourcePayload.ocr_attempts ?? structuredFields.ocr_attempts
    );
    if (Number.isFinite(ocrAttempts) && ocrAttempts >= 0) {
        metadata.ocr_attempts = Math.trunc(ocrAttempts);
    }

    const preprocessingVariant =
        sourcePayload.preprocessing_variant ??
        structuredFields.preprocessing_variant;
    if (
        typeof preprocessingVariant === 'string' &&
        preprocessingVariant.trim()
    ) {
        metadata.preprocessing_variant = preprocessingVariant.trim();
    }

    return metadata;
}

function deriveOcrReviewRequired({
    structuredFields = {},
    sourcePayload = {},
    existingReviewRequired = false,
    hasNewOcrContext = true,
} = {}) {
    if (!hasNewOcrContext) return existingReviewRequired === true;

    return (
        structuredFields?.review_required === true ||
        sourcePayload?.manual_review_required === true ||
        sourcePayload?.worker_status === 'review_required'
    );
}

function buildStructuredOcrPersistence({
    documentKey,
    extractedFields,
    sourcePayload,
    existingStructuredFields = {},
    existingReviewRequired = false,
    existingProcessingMetadata = {},
} = {}) {
    const hasStructuredInput = extractedFields !== null && extractedFields !== undefined;
    const hasSourcePayload = sourcePayload !== null && sourcePayload !== undefined;
    const structuredFields = hasStructuredInput
        ? sanitizeStructuredOcrFields(documentKey, extractedFields)
        : sanitizeGenericStructuredFields(existingStructuredFields);
    const processingMetadata = hasSourcePayload
        ? sanitizeOcrProcessingMetadata(sourcePayload, structuredFields)
        : sanitizeGenericStructuredFields(existingProcessingMetadata);

    return {
        ocr_structured_fields: structuredFields,
        ocr_review_required: deriveOcrReviewRequired({
            structuredFields,
            sourcePayload: hasSourcePayload ? sourcePayload : {},
            existingReviewRequired,
            hasNewOcrContext: hasStructuredInput || hasSourcePayload,
        }),
        ocr_processing_metadata: processingMetadata,
    };
}

function buildOcrProjection(ocrRow = {}) {
    return {
        id: ocrRow.document_id || null,
        document_key: normalizeDocumentType(
            ocrRow.document_key || ocrRow.document_type || ''
        ),
        document_type: ocrRow.document_type || null,
        file_url: ocrRow.file_url || null,
        scanned_via_iot: !!ocrRow.scanned_via_iot,
        iot_device_id: ocrRow.iot_device_id || null,
        extracted_name: ocrRow.ocr_extracted_name || null,
        extracted_gwa: ocrRow.ocr_extracted_gwa ?? null,
        confidence: ocrRow.ocr_confidence ?? null,
        raw_text: ocrRow.ocr_raw_text || '',
        structured_fields: isRecord(ocrRow.ocr_structured_fields)
            ? ocrRow.ocr_structured_fields
            : {},
        review_required: ocrRow.ocr_review_required === true,
        processing_metadata: isRecord(ocrRow.ocr_processing_metadata)
            ? ocrRow.ocr_processing_metadata
            : {},
        scanned_at: ocrRow.scanned_at || null,
        updated_at: ocrRow.updated_at || null,
    };
}

function buildOcrOnlyDocument({
    documentKey,
    ocr,
    latestIotOcrRequest = null,
} = {}) {
    return {
        id: documentKey,
        document_key: documentKey,
        name: DOCUMENT_TYPE_TO_NAME[documentKey] || ocr?.document_type || 'Document',
        document_type: ocr?.document_type || null,
        file_name: null,
        file_path: null,
        url: ocr?.file_url || null,
        file_url: ocr?.file_url || null,
        signed_url: null,
        status: 'pending',
        admin_comment: '',
        notes: null,
        ocr: ocr || {},
        ocr_confidence: ocr?.confidence ?? null,
        iot_ocr_request: latestIotOcrRequest,
        ocr_job: latestIotOcrRequest,
        uploaded_at: null,
        submitted_at: null,
        reviewed_at: null,
    };
}

function resolveIotExtractedName(extractedFields = {}) {
    if (!extractedFields || typeof extractedFields !== 'object') return null;

    const nestedFields =
        extractedFields.fields && typeof extractedFields.fields === 'object'
            ? extractedFields.fields
            : {};
    const candidates = [
        extractedFields.extracted_name,
        extractedFields.student_name,
        extractedFields.name,
        nestedFields.extracted_name,
        nestedFields.student_name,
        nestedFields.name,
    ];

    for (const value of candidates) {
        if (typeof value !== 'string') continue;
        const normalized = value.trim();
        if (normalized) return normalized;
    }

    return null;
}

function resolveStoredExtractedName({
    extractedFields = {},
    scannedViaIot = false,
    existingExtractedName = null,
    studentName = null,
} = {}) {
    const extractedName = resolveIotExtractedName(extractedFields);
    if (scannedViaIot === true) return extractedName;
    return extractedName || existingExtractedName || studentName || null;
}

function isUuid(value) {
    if (!value) return false;

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(String(value).trim());
}

function isAsyncIotOcrStart(response, payload = {}) {
    return response.status === 202 || payload?.status === 'started';
}

async function getSignedFileUrl(filePath) {
    if (!filePath) return null;

    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(filePath, 60 * 60, {
            download: false,
        });

    if (error) {
        console.error(
            'SUPABASE SIGNED URL ERROR:',
            `bucket=${STORAGE_BUCKET}`,
            `path=${filePath}`,
            error.message
        );
        return null;
    }

    return data?.signedUrl || null;
}

async function buildApplicationDetails(applicationId) {
    const { data: applicationRecord, error: applicationError } = await supabase
        .from('applications')
        .select(`
        application_id,
        student_id,
        program_id,
        opening_id,

        application_status,
        document_status,

        verification_status,
        requirements_completed_at,
        requirements_verified_at,

        selection_status,
        queue_position,
        waitlist_position,
        fcfs_completed_at,

        activation_status,
        activated_at,

        submission_date,
        created_at,
        updated_at,

        is_archived,
        is_disqualified,
        rejection_reason,
        remarks,
        evaluator_id,

        students!applications_student_id_fkey (
            user_id,
            first_name,
            middle_name,
            last_name,
            pdm_id,
            profile_photo_url,
            gwa,
            year_level,
            course_id
        ),

        scholarship_program (
            program_id,
            benefactor_id,
            program_name,
            benefactors (
                benefactor_id,
                benefactor_name
            )
        )
    `)
        .eq('application_id', applicationId)
        .single();

    if (applicationError) {
        console.error(
            'Supabase Application Detail Error:',
            applicationError
        );
        throw new Error(applicationError.message);
    }

    if (applicationRecord?.student_id) {
        const {
            data: studentScholarState,
            error: studentScholarError,
        } = await supabase
            .from('students')
            .select(
                'scholarship_status, current_application_id'
            )
            .eq(
                'student_id',
                applicationRecord.student_id
            )
            .maybeSingle();

        if (studentScholarError) {
            console.error(
                'Supabase Student Scholar State Error:',
                studentScholarError
            );
            throw new Error(studentScholarError.message);
        }

        if (
            studentScholarState?.scholarship_status ===
            'Active' &&
            studentScholarState?.current_application_id &&
            studentScholarState.current_application_id !==
            applicationId
        ) {
            throw new Error(
                'This student already has another active scholarship application.'
            );
        }
    }

    const [
        profileResult,
        familyMembersResult,
        educationRecordsResult,
        documentsResult,
        reviewsResult,
        ocrResult,
        iotOcrRequestsResult,
        iotOcrReviewsResult,
    ] = await Promise.all([
        supabase
            .from('student_profiles')
            .select('*')
            .eq(
                'student_id',
                applicationRecord.student_id
            )
            .maybeSingle(),

        supabase
            .from('student_family')
            .select('*')
            .eq(
                'student_id',
                applicationRecord.student_id
            )
            .order('relation', {
                ascending: true,
            }),

        supabase
            .from('student_education')
            .select('*')
            .eq(
                'student_id',
                applicationRecord.student_id
            )
            .order('education_level', {
                ascending: true,
            }),

        supabase
            .from('application_documents')
            .select('*')
            .eq(
                'application_id',
                applicationId
            )
            .order('submitted_at', {
                ascending: true,
            }),

        supabase
            .from('application_document_reviews')
            .select('*')
            .eq(
                'application_id',
                applicationId
            ),

        supabase
            .from('ocr_extracted_documents')
            .select(`
                document_id,
                student_id,
                linked_record_id,
                linked_record_type,
                document_key,
                document_type,
                file_url,
                scanned_via_iot,
                iot_device_id,
                ocr_extracted_name,
                ocr_extracted_gwa,
                ocr_confidence,
                ocr_raw_text,
                ocr_structured_fields,
                ocr_review_required,
                ocr_processing_metadata,
                scanned_at,
                updated_at
            `)
            .eq(
                'linked_record_id',
                applicationId
            )
            .eq(
                'student_id',
                applicationRecord.student_id
            )
            .eq(
                'linked_record_type',
                'application'
            )
            .order('scanned_at', {
                ascending: false,
            })
            .order('updated_at', {
                ascending: false,
            }),

        supabase
            .from('iot_ocr_requests')
            .select(`
                request_id,
                application_id,
                student_id,
                student_name,
                document_key,
                document_type,
                status,
                requested_by,
                claimed_by,
                error_message,
                created_at,
                claimed_at,
                completed_at,
                updated_at
            `)
            .eq(
                'application_id',
                applicationId
            )
            .order('created_at', {
                ascending: false,
            }),

        supabase
            .from('iot_ocr_reviews')
            .select(
                'document_key, verified_fields, reviewed_at'
            )
            .eq(
                'application_id',
                applicationId
            )
            .order('reviewed_at', {
                ascending: false,
            }),

    ]);

    const resultErrors = [
        profileResult.error,
        familyMembersResult.error,
        educationRecordsResult.error,
        documentsResult.error,
        reviewsResult.error,
        ocrResult.error,
        iotOcrRequestsResult.error,
        iotOcrReviewsResult.error,
    ].filter(Boolean);

    if (resultErrors.length > 0) {
        console.error(
            'Supabase Application Detail Relation Error:',
            resultErrors[0]
        );

        throw new Error(
            resultErrors[0].message
        );
    }

    const student =
        applicationRecord.students || {};

    const scholarshipProgram =
        applicationRecord.scholarship_program || {};

    const benefactor =
        scholarshipProgram.benefactors || {};

    const profile =
        profileResult.data || null;

    let userContact = {
        email: 'N/A',
        phone_number: 'N/A',
    };

    if (student.user_id) {
        const {
            data: userData,
            error: userError,
        } = await supabase
            .from('users')
            .select(
                'email, phone_number'
            )
            .eq(
                'user_id',
                student.user_id
            )
            .maybeSingle();

        if (userError) {
            console.error(
                'Supabase User Fetch Error:',
                userError
            );

            throw new Error(
                userError.message
            );
        }

        if (userData) {
            userContact = userData;
        }
    }

    let courseCode = 'N/A';

    if (student.course_id) {
        const {
            data: courseData,
            error: courseError,
        } = await supabase
            .from('academic_course')
            .select('course_code')
            .eq(
                'course_id',
                student.course_id
            )
            .maybeSingle();

        if (courseError) {
            console.error(
                'Supabase Course Fetch Error:',
                courseError
            );

            throw new Error(
                courseError.message
            );
        }

        if (courseData) {
            courseCode =
                courseData.course_code;
        }
    }

    const reviewByKey = new Map(
        (reviewsResult.data || []).map(
            (review) => [
                review.document_key,
                review,
            ]
        )
    );

    const ocrByKey = new Map();

    (ocrResult.data || []).forEach(
        (ocrRow) => {
            const resolvedKey =
                normalizeDocumentType(
                    ocrRow.document_key ||
                    ocrRow.document_type ||
                    ''
                );

            if (
                !resolvedKey ||
                ocrByKey.has(resolvedKey)
            ) {
                return;
            }

            ocrByKey.set(
                resolvedKey,
                buildOcrProjection(ocrRow)
            );
        }
    );

    const latestIotOcrRequestByKey =
        new Map();

    (
        iotOcrRequestsResult.data || []
    ).forEach((requestRow) => {
        const resolvedKey =
            normalizeDocumentType(
                requestRow.document_key ||
                requestRow.document_type ||
                ''
            );

        if (
            !resolvedKey ||
            latestIotOcrRequestByKey.has(
                resolvedKey
            )
        ) {
            return;
        }

        latestIotOcrRequestByKey.set(
            resolvedKey,
            {
                request_id:
                    requestRow.request_id,

                document_key:
                    resolvedKey,

                document_type:
                    requestRow.document_type ||
                    null,

                status:
                    requestRow.status ||
                    'pending',

                requested_by:
                    requestRow.requested_by ||
                    null,

                claimed_by:
                    requestRow.claimed_by ||
                    null,

                error_message:
                    requestRow.error_message ||
                    null,

                created_at:
                    requestRow.created_at ||
                    null,

                claimed_at:
                    requestRow.claimed_at ||
                    null,

                completed_at:
                    requestRow.completed_at ||
                    null,

                updated_at:
                    requestRow.updated_at ||
                    null,
            }
        );
    });

    const rawDocuments =
        documentsResult.data || [];

    const normalizedDocuments =
        await Promise.all(
            rawDocuments.map(
                async (document) => {
                    const documentKey =
                        getDocumentKey(
                            document
                        );

                    const review =
                        reviewByKey.get(
                            documentKey
                        ) || null;

                    const ocr =
                        ocrByKey.get(
                            documentKey
                        ) || null;

                    const latestIotOcrRequest =
                        latestIotOcrRequestByKey.get(
                            documentKey
                        ) || null;

                    const filePath =
                        document.file_path ||
                        null;

                    const signedUrl =
                        filePath
                            ? await getSignedFileUrl(
                                filePath
                            )
                            : null;

                    return {
                        id: documentKey,

                        document_key:
                            documentKey,

                        name:
                            DOCUMENT_TYPE_TO_NAME[
                            documentKey
                            ] ||
                            document.document_type ||
                            'Document',

                        document_type:
                            document.document_type ||
                            null,

                        file_name:
                            document.file_name ||
                            null,

                        file_path:
                            filePath,

                        url:
                            signedUrl ||
                            document.file_url ||
                            null,

                        file_url:
                            signedUrl ||
                            document.file_url ||
                            null,

                        signed_url:
                            signedUrl ||
                            null,

                        status:
                            deriveReviewStatus(
                                document,
                                review
                            ),

                        admin_comment:
                            review?.admin_comment ||
                            document.notes ||
                            '',

                        notes:
                            document.notes ||
                            null,

                        ocr:
                            ocr || {},

                        ocr_confidence:
                            ocr?.confidence ??
                            null,

                        iot_ocr_request:
                            latestIotOcrRequest,

                        ocr_job:
                            latestIotOcrRequest,

                        uploaded_at:
                            document.submitted_at ||
                            null,

                        submitted_at:
                            document.submitted_at ||
                            null,

                        reviewed_at:
                            review?.reviewed_at ||
                            null,
                    };
                }
            )
        );

    const projectedDocumentKeys =
        new Set(
            normalizedDocuments.map(
                (document) =>
                    document.document_key
            )
        );

    for (
        const [documentKey, ocr]
        of ocrByKey
    ) {
        if (
            !documentKey ||
            projectedDocumentKeys.has(
                documentKey
            )
        ) {
            continue;
        }

        normalizedDocuments.push(
            buildOcrOnlyDocument({
                documentKey,
                ocr,

                latestIotOcrRequest:
                    latestIotOcrRequestByKey.get(
                        documentKey
                    ) || null,
            })
        );
    }

    normalizedDocuments.push({
        id: 'application_form',

        document_key:
            'application_form',

        name:
            'Application Form',

        document_type:
            'Application Form',

        file_name:
            null,

        file_path:
            null,

        url:
            null,

        file_url:
            null,

        signed_url:
            null,

        status:
            reviewByKey.get(
                'application_form'
            )?.review_status ||
            'pending',

        admin_comment:
            reviewByKey.get(
                'application_form'
            )?.admin_comment ||
            '',

        notes:
            null,

        ocr:
            {},

        ocr_confidence:
            null,

        iot_ocr_request:
            latestIotOcrRequestByKey.get(
                'application_form'
            ) || null,

        ocr_job:
            latestIotOcrRequestByKey.get(
                'application_form'
            ) || null,

        uploaded_at:
            applicationRecord.submission_date ||
            null,

        submitted_at:
            applicationRecord.submission_date ||
            null,

        reviewed_at:
            reviewByKey.get(
                'application_form'
            )?.reviewed_at ||
            null,
    });

    const documents =
        ensureDocumentCoverage(
            normalizedDocuments
        );

    const readiness =
        await fetchApplicationReadiness(
            applicationId
        );

    const marilaoResident =
        resolveMarilaoResidency(
            iotOcrReviewsResult.data || []
        );

    return {
        /*
         * Keep the important application workflow fields
         * at the TOP LEVEL because the admin frontend
         * consumes the response returned by
         * GET /api/applications/:id/documents directly.
         */
        id:
            applicationRecord.application_id,

        application_id:
            applicationRecord.application_id,

        student_id:
            applicationRecord.student_id,

        program_id:
            applicationRecord.program_id,

        opening_id:
            applicationRecord.opening_id ||
            null,

        application_status:
            applicationRecord.application_status,

        document_status:
            applicationRecord.document_status,

        /*
         * CRITICAL:
         * DocumentVerification.jsx reads this field to
         * determine whether "Save Requirements Review"
         * has already been finalized.
         */
        verification_status:
            applicationRecord.verification_status ||
            'pending',

        requirements_completed_at:
            applicationRecord.requirements_completed_at ||
            null,

        requirements_verified_at:
            applicationRecord.requirements_verified_at ||
            null,

        selection_status:
            applicationRecord.selection_status ||
            'Unranked',

        queue_position:
            applicationRecord.queue_position ??
            null,

        waitlist_position:
            applicationRecord.waitlist_position ??
            null,

        fcfs_completed_at:
            applicationRecord.fcfs_completed_at ||
            null,

        activation_status:
            applicationRecord.activation_status ||
            'Not Activated',

        activated_at:
            applicationRecord.activated_at ||
            null,

        submitted:
            applicationRecord.submission_date,

        submission_date:
            applicationRecord.submission_date,

        created_at:
            applicationRecord.created_at ||
            null,

        updated_at:
            applicationRecord.updated_at ||
            null,

        is_archived:
            applicationRecord.is_archived ===
            true,

        disqualified:
            !!applicationRecord.is_disqualified,

        is_disqualified:
            !!applicationRecord.is_disqualified,

        rejection_reason:
            applicationRecord.rejection_reason ||
            null,

        remarks:
            applicationRecord.remarks ||
            null,

        evaluator_id:
            applicationRecord.evaluator_id ||
            null,

        /*
         * Keep the same values nested too. Other
         * consumers may use response.application.*
         */
        application: {
            application_id:
                applicationRecord.application_id,

            student_id:
                applicationRecord.student_id,

            program_id:
                applicationRecord.program_id,

            opening_id:
                applicationRecord.opening_id ||
                null,

            application_status:
                applicationRecord.application_status,

            document_status:
                applicationRecord.document_status,

            verification_status:
                applicationRecord.verification_status ||
                'pending',

            requirements_completed_at:
                applicationRecord.requirements_completed_at ||
                null,

            requirements_verified_at:
                applicationRecord.requirements_verified_at ||
                null,

            selection_status:
                applicationRecord.selection_status ||
                'Unranked',

            queue_position:
                applicationRecord.queue_position ??
                null,

            waitlist_position:
                applicationRecord.waitlist_position ??
                null,

            fcfs_completed_at:
                applicationRecord.fcfs_completed_at ||
                null,

            activation_status:
                applicationRecord.activation_status ||
                'Not Activated',

            activated_at:
                applicationRecord.activated_at ||
                null,

            submission_date:
                applicationRecord.submission_date,

            created_at:
                applicationRecord.created_at ||
                null,

            updated_at:
                applicationRecord.updated_at ||
                null,

            is_archived:
                applicationRecord.is_archived ===
                true,

            is_disqualified:
                !!applicationRecord.is_disqualified,

            rejection_reason:
                applicationRecord.rejection_reason ||
                null,

            remarks:
                applicationRecord.remarks ||
                null,

            evaluator_id:
                applicationRecord.evaluator_id ||
                null,
        },

        student: {
            name:
                `${student.first_name || ''
                    } ${student.last_name || ''
                    }`
                    .trim() ||
                'Unknown Student',

            initials:
                `${student.first_name?.[0] ||
                    ''
                    }${student.last_name?.[0] ||
                    ''
                    }`
                    .toUpperCase() ||
                'NA',

            avatar_url:
                await resolveAvatarUrl(
                    student.profile_photo_url
                ),

            pdm_id:
                student.pdm_id ||
                'N/A',

            email:
                userContact.email ||
                'N/A',

            phone:
                userContact.phone_number ||
                'N/A',

            year:
                student.year_level
                    ? `${student.year_level
                    }${getOrdinalSuffix(
                        student.year_level
                    )} Year`
                    : 'N/A',

            academic_year:
                student.year_level
                    ? `${student.year_level}${getOrdinalSuffix(student.year_level)}`
                    : 'N/A',

            gwa:
                student.gwa ??
                'N/A',

            program:
                scholarshipProgram.program_name ||
                'General',

            benefactor_name:
                benefactor.benefactor_name ||
                'N/A',

            course:
                courseCode,

            barangay:
                profile?.barangay ||
                'N/A',

            marilao_resident:
                marilaoResident,
        },

        student_profile:
            profile,

        family_members:
            familyMembersResult.data || [],

        education_records:
            educationRecordsResult.data || [],

        documents,

        readiness,
    };
}

exports.fetchApplications = async () => {
    // Self-heal the FCFS readiness queue so previously completed
    // requirements and endorsements appear immediately in Readiness.
    await readinessQueueService.syncAllReadyApplications();

    const primaryQuery = `
    SELECT
      a.application_id,
      a.student_id,
      a.program_id,
      a.opening_id,
      a.application_status,
      a.evaluator_id,
      a.submission_date,
      a.is_disqualified,
      a.rejection_reason,
      a.document_status,
      a.remarks,
      a.is_archived,

      st.first_name,
      st.last_name,
      st.pdm_id,
      st.gwa,
      st.sdo_status,
      st.scholarship_status,
      st.current_application_id,

      po.opening_title,
      po.allocated_slots,
      po.filled_slots,
      po.financial_allocation,
      po.per_scholar_amount,
      po.posting_status,
      po.is_archived AS opening_is_archived,

      ay.label AS academic_year,
      ap.term AS semester,

      sp.program_name

    FROM applications a
    INNER JOIN students st
      ON a.student_id = st.student_id
    INNER JOIN users u
      ON st.user_id = u.user_id
    LEFT JOIN program_openings po
      ON a.opening_id = po.opening_id
    LEFT JOIN academic_years ay
      ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap
      ON po.period_id = ap.period_id
    LEFT JOIN scholarship_program sp
      ON a.program_id = sp.program_id

    WHERE
      COALESCE(a.is_archived, FALSE) = FALSE
      AND COALESCE(st.is_archived, FALSE) = FALSE
      AND st.user_id IS NOT NULL
      AND COALESCE(u.is_otp_verified, FALSE) = TRUE
      AND LOWER(COALESCE(u.username, '')) NOT LIKE 'deleted-%'
      AND LOWER(COALESCE(u.email, '')) NOT LIKE 'deleted-%'
      AND COALESCE(po.is_archived, FALSE) = FALSE
      AND LOWER(COALESCE(po.posting_status, '')) <> 'closed'
      AND COALESCE(a.is_disqualified, FALSE) = FALSE
      AND LOWER(COALESCE(a.application_status, '')) NOT IN ('approved')
      AND NOT (
        COALESCE(st.scholarship_status, 'None') = 'Active'
        AND st.current_application_id IS NOT NULL
        AND st.current_application_id <> a.application_id
      )

    ORDER BY a.submission_date DESC
  `;

    const fallbackQuery = `
    SELECT
      a.application_id,
      a.student_id,
      a.program_id,
      a.opening_id,
      a.application_status,
      a.evaluator_id,
      a.submission_date,
      a.is_disqualified,
      a.rejection_reason,
      a.document_status,
      a.remarks,
      a.is_archived,

      st.first_name,
      st.last_name,
      st.pdm_id,
      st.gwa,
      st.sdo_status,

      po.opening_title,
      po.allocated_slots,
      po.filled_slots,
      po.financial_allocation,
      po.per_scholar_amount,
      po.posting_status,
      po.is_archived AS opening_is_archived,

      ay.label AS academic_year,
      ap.term AS semester,

      sp.program_name

    FROM applications a
    INNER JOIN students st
      ON a.student_id = st.student_id
    INNER JOIN users u
      ON st.user_id = u.user_id
    LEFT JOIN program_openings po
      ON a.opening_id = po.opening_id
    LEFT JOIN academic_years ay
      ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap
      ON po.period_id = ap.period_id
    LEFT JOIN scholarship_program sp
      ON a.program_id = sp.program_id

    WHERE
      COALESCE(a.is_archived, FALSE) = FALSE
      AND COALESCE(st.is_archived, FALSE) = FALSE
      AND st.user_id IS NOT NULL
      AND COALESCE(u.is_otp_verified, FALSE) = TRUE
      AND LOWER(COALESCE(u.username, '')) NOT LIKE 'deleted-%'
      AND LOWER(COALESCE(u.email, '')) NOT LIKE 'deleted-%'
      AND COALESCE(po.is_archived, FALSE) = FALSE
      AND LOWER(COALESCE(po.posting_status, '')) <> 'closed'
      AND COALESCE(a.is_disqualified, FALSE) = FALSE
      AND LOWER(COALESCE(a.application_status, '')) NOT IN ('approved')

    ORDER BY a.submission_date DESC
  `;

    let rows;

    try {
        ({ rows } = await pool.query(primaryQuery));
    } catch (err) {
        const msg = String(err.message || '').toLowerCase();

        const isMissingNewColumn =
            msg.includes('scholarship_status') ||
            msg.includes('current_application_id');

        if (!isMissingNewColumn) {
            throw err;
        }

        console.warn('FETCH APPLICATIONS FALLBACK MODE:', err.message);
        ({ rows } = await pool.query(fallbackQuery));
    }

    const mappedRows = rows.map((row) => {
        const firstName = row.first_name || '';
        const lastName = row.last_name || '';
        const fullName =
            `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim() || 'Unnamed Applicant';

        return {
            application_id: row.application_id,
            student_id: row.student_id,
            program_id: row.program_id,
            opening_id: row.opening_id,
            evaluator_id: row.evaluator_id,

            first_name: firstName,
            last_name: lastName,
            student_name: fullName,
            applicant_name: fullName,
            pdm_id: row.pdm_id || 'N/A',
            gwa: row.gwa ?? null,
            sdo_status: row.sdo_status || 'Clear',

            program_name: row.program_name || 'No Program',

            opening_title: row.opening_title || 'Untitled Opening',
            semester: row.semester || null,
            academic_year: row.academic_year || null,
            allocated_slots: Number(row.allocated_slots || 0),
            filled_slots: Number(row.filled_slots || 0),
            financial_allocation: row.financial_allocation ?? null,
            per_scholar_amount: row.per_scholar_amount ?? null,
            posting_status: row.posting_status || 'Open',
            opening_status: row.posting_status || 'Open',
            opening_is_archived: !!row.opening_is_archived,

            application_status: row.application_status || 'Pending Review',
            status: row.application_status || 'Pending Review',

            document_status: row.document_status || 'Missing Docs',
            remarks: row.remarks || null,

            is_disqualified: !!row.is_disqualified,
            rejection_reason: row.rejection_reason || null,

            submission_date: row.submission_date || null,
            submitted_at: row.submission_date || null,
            is_archived: !!row.is_archived,
        };
    });

    const readinessRows = await decorateApplicationRecordsWithReadiness(mappedRows);

    return _.orderBy(
        readinessRows,
        [(row) => new Date(row.submission_date || 0).getTime()],
        ['desc']
    );
};

exports.fetchApplicationDetailsById = async (id) => buildApplicationDetails(id);
exports.fetchApplicationDocumentsById = async (id) => buildApplicationDetails(id);

exports.runApplicationDocumentIotOcr = async ({
    applicationId,
    documentKey,
    requestedBy = null,
}) => {
    if (!applicationId) {
        throw new Error('applicationId is required');
    }

    const normalizedDocumentKey = documentTypes.normalizeDocumentType(documentKey);

    if (!normalizedDocumentKey) {
        throw new Error('documentKey is required');
    }

    if (!iotOcrRequestService.isIotOcrDocumentEnabled(normalizedDocumentKey)) {
        const error = new Error('IoT OCR is unavailable for this document');
        error.statusCode = 400;
        error.code = 'IOT_OCR_DOCUMENT_DISABLED';
        throw error;
    }

    const availability = require('./iotOcrPresenceService').getAvailability();
    if (!availability.online) {
        const error = new Error('Raspberry Pi OCR scanner is offline. Start the Pi worker and try again.');
        error.statusCode = 503;
        error.code = 'PI_OFFLINE';
        throw error;
    }

    const documentTypeName =
        documentTypes.DOCUMENT_TYPE_TO_NAME[normalizedDocumentKey];

    if (!documentTypeName) {
        throw new Error('Invalid documentKey');
    }

    const { data: applicationRow, error: applicationError } = await supabase
        .from('applications')
        .select(`
            application_id,
            student_id,
            students!applications_student_id_fkey (
                first_name,
                middle_name,
                last_name
            )
        `)
        .eq('application_id', applicationId)
        .maybeSingle();

    if (applicationError) {
        console.error('SUPABASE IOT OCR APPLICATION FETCH ERROR:', applicationError);
        throw new Error(applicationError.message);
    }

    if (!applicationRow) {
        throw new Error('Application not found');
    }

    if (!applicationRow.student_id) {
        throw new Error('Application is missing student_id');
    }

    const student = applicationRow.students || {};
    const studentName = [
        student.first_name,
        student.middle_name,
        student.last_name,
    ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const result = await iotOcrRequestService.createRequest({
        application_id: applicationId,
        document_key: normalizedDocumentKey,
        requested_by: requestedBy,
    });

    const request = result.request || result.data || result;

    return {
        application_id: applicationId,
        student_id: applicationRow.student_id,
        student_name: studentName || 'Unknown Student',
        document_key: normalizedDocumentKey,
        document_name: documentTypeName,
        status: request.status || 'pending',
        async: true,
        request,
        ...request,
    };
};

exports.getApplicationDocumentIotOcr = async ({ applicationId, documentKey, requestId = null }) =>
    iotOcrRequestService.getCandidate({ applicationId, documentKey, requestId });

exports.confirmApplicationDocumentIotOcr = async ({
    applicationId,
    documentKey,
    requestId,
    correctedFields,
    reviewedBy,
}) => iotOcrRequestService.confirmCandidate({
    applicationId,
    documentKey,
    requestId,
    correctedFields,
    reviewedBy,
});

exports.retryApplicationDocumentIotOcr = async ({
    applicationId,
    documentKey,
    requestId,
    requestedBy,
}) => iotOcrRequestService.retryRequest({
    applicationId,
    documentKey,
    requestId,
    requestedBy,
});

exports.cancelApplicationDocumentIotOcr = async ({
    applicationId,
    documentKey,
    requestId,
}) => iotOcrRequestService.cancelRequest({ applicationId, documentKey, requestId });

exports.fetchApplicationDocumentOcrSnapshot = async ({
    applicationId,
    documentKey,
    requestId = null,
}) => {
    if (!applicationId) {
        throw new Error('applicationId is required');
    }

    const normalizedDocumentKey = normalizeDocumentType(documentKey);
    if (!normalizedDocumentKey) {
        throw new Error('documentKey is required');
    }

    if (normalizedDocumentKey === 'application_form') {
        throw new Error('OCR snapshot is only available for uploaded documents');
    }

    const documentTypeName = DOCUMENT_TYPE_TO_NAME[normalizedDocumentKey];
    if (!documentTypeName) {
        throw new Error('Invalid documentKey');
    }

    const { data: applicationRow, error: applicationError } = await supabase
        .from('applications')
        .select(`
            application_id,
            student_id,
            students!applications_student_id_fkey (
                first_name,
                middle_name,
                last_name
            )
        `)
        .eq('application_id', applicationId)
        .maybeSingle();

    if (applicationError) {
        console.error('SUPABASE OCR SNAPSHOT FETCH APPLICATION ERROR:', applicationError);
        throw new Error(applicationError.message);
    }

    if (!applicationRow) {
        throw new Error('Application not found');
    }

    const student = applicationRow.students || {};
    const studentName = [
        student.first_name,
        student.middle_name,
        student.last_name,
    ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    const { data: ocrRows, error: ocrError } = await supabase
        .from('ocr_extracted_documents')
        .select(`
            document_id,
            ocr_extracted_name,
            ocr_extracted_gwa,
            ocr_confidence,
            ocr_raw_text,
            ocr_structured_fields,
            ocr_review_required,
            ocr_processing_metadata,
            scanned_via_iot,
            iot_device_id,
            scanned_at,
            updated_at
        `)
        .eq('linked_record_id', applicationId)
        .eq('student_id', applicationRow.student_id)
        .eq('linked_record_type', 'application')
        .eq('document_key', normalizedDocumentKey)
        .order('scanned_at', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1);

    if (ocrError) {
        console.error('SUPABASE OCR SNAPSHOT FETCH DOCUMENT ERROR:', ocrError);
        throw new Error(ocrError.message);
    }

    const ocrRow = ocrRows?.[0] || null;
    const requestedRequest = requestId
        ? await iotOcrRequestService.getRequestById({
            requestId,
            applicationId,
            documentKey: normalizedDocumentKey,
        })
        : null;

    if (requestId && !requestedRequest) {
        throw buildHttpError(
            404,
            'IoT OCR request not found for this application document'
        );
    }

    const latestRequest =
        requestedRequest ||
        await iotOcrRequestService.getLatestRequestForDocument({
            applicationId,
            documentKey: normalizedDocumentKey,
        });
    const snapshotFresh = requestId
        ? isRequestBoundSnapshotFresh({
            request: latestRequest,
            ocrRow,
        })
        : !!ocrRow;
    const visibleOcrRow = snapshotFresh ? ocrRow : null;

    return {
        document_id: visibleOcrRow?.document_id || null,
        application_id: applicationId,
        student_id: applicationRow.student_id,
        student_name: studentName || 'Unknown Student',
        document_key: normalizedDocumentKey,
        document_type: documentTypeName,
        ocr: buildOcrProjection(visibleOcrRow || {}),
        ocr_confidence: visibleOcrRow?.ocr_confidence ?? null,
        raw_text: visibleOcrRow?.ocr_raw_text || '',
        scanned_via_iot: !!visibleOcrRow?.scanned_via_iot,
        iot_device_id: visibleOcrRow?.iot_device_id || null,
        scanned_at: visibleOcrRow?.scanned_at || null,
        updated_at: visibleOcrRow?.updated_at || null,
        requested_request_id: requestId ? String(requestId) : null,
        snapshot_fresh: snapshotFresh,
        iot_ocr_request: latestRequest,
    };
};

exports.saveApplicationDocumentOcrSnapshot = async ({
    applicationId,
    documentKey,
    rawText,
    ocrConfidence = null,
    extractedFields = null,
    sourcePayload = null,
    scannedViaIot = null,
    iotDeviceId = null,
    iotRequestId = null,
    scannedAt = null,
}) => {
    if (!applicationId) {
        throw new Error('applicationId is required');
    }

    const normalizedDocumentKey = normalizeDocumentType(documentKey);

    if (!normalizedDocumentKey) {
        throw new Error('documentKey is required');
    }

    if (normalizedDocumentKey === 'application_form') {
        throw new Error('OCR snapshot is only available for uploaded documents');
    }

    const documentTypeName = DOCUMENT_TYPE_TO_NAME[normalizedDocumentKey];

    if (!documentTypeName) {
        throw new Error('Invalid documentKey');
    }

    const { data: applicationRow, error: applicationError } = await supabase
        .from('applications')
        .select(`
            application_id,
            student_id,
            students!applications_student_id_fkey (
                first_name,
                middle_name,
                last_name
            )
        `)
        .eq('application_id', applicationId)
        .maybeSingle();

    if (applicationError) {
        console.error('SUPABASE OCR SNAPSHOT APPLICATION FETCH ERROR:', applicationError);
        throw new Error(applicationError.message);
    }

    if (!applicationRow) {
        throw new Error('Application not found');
    }

    const student = applicationRow.students || {};
    const studentName = [
        student.first_name,
        student.middle_name,
        student.last_name,
    ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    const now = new Date().toISOString();
    const normalizedRawText = String(rawText || '');
    const normalizedIotDeviceId = isUuid(iotDeviceId) ? String(iotDeviceId).trim() : null;
    const normalizedIotRequestId = isUuid(iotRequestId)
        ? String(iotRequestId).trim()
        : null;

    if (scannedViaIot === true && !normalizedIotDeviceId) {
        throw new Error('A valid IoT device UUID is required for an IoT OCR snapshot');
    }

    if (scannedViaIot === true && !normalizedIotRequestId) {
        throw new Error('A valid IoT request UUID is required for an IoT OCR snapshot');
    }
    const normalizedExtractedFields =
        extractedFields && typeof extractedFields === 'object'
            ? extractedFields
            : {};
    const extractedGwaCandidate =
        normalizedExtractedFields.extracted_gwa ??
        normalizedExtractedFields.gwa ??
        null;
    const normalizedConfidence =
        ocrConfidence === null || ocrConfidence === undefined || ocrConfidence === ''
            ? null
            : Number(ocrConfidence);
    const normalizedExtractedGwa =
        extractedGwaCandidate === null ||
            extractedGwaCandidate === undefined ||
            extractedGwaCandidate === ''
            ? null
            : Number(extractedGwaCandidate);
    const { data: sourceDocumentRow, error: sourceDocumentError } = await supabase
        .from('application_documents')
        .select('file_path, file_url')
        .eq('application_id', applicationId)
        .eq('document_type', documentTypeName)
        .maybeSingle();

    if (sourceDocumentError) {
        console.error('SUPABASE OCR SNAPSHOT SOURCE DOCUMENT FETCH ERROR:', sourceDocumentError);
        throw new Error(sourceDocumentError.message);
    }

    const sourceFileUrl = sourceDocumentRow?.file_path
        ? await getSignedFileUrl(sourceDocumentRow.file_path)
        : sourceDocumentRow?.file_url || null;

    const { data: existingOcrRows, error: existingOcrError } = await supabase
        .from('ocr_extracted_documents')
        .select(`
            document_id,
            scanned_via_iot,
            file_url,
            iot_device_id,
            iot_request_id,
            scanned_at,
            ocr_extracted_name,
            ocr_extracted_gwa,
            ocr_confidence,
            ocr_structured_fields,
            ocr_review_required,
            ocr_processing_metadata
        `)
        .eq('linked_record_id', applicationId)
        .eq('student_id', applicationRow.student_id)
        .eq('linked_record_type', 'application')
        .eq('document_key', normalizedDocumentKey)
        .order('scanned_at', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1);

    if (existingOcrError) {
        console.error('SUPABASE OCR SNAPSHOT EXISTING FETCH ERROR:', existingOcrError);
        throw new Error(existingOcrError.message);
    }

    const existingRow = existingOcrRows?.[0] || null;

    if (normalizedIotRequestId) {
        const { data: requestSnapshot, error: requestSnapshotError } = await supabase
            .from('ocr_extracted_documents')
            .select('*')
            .eq('iot_request_id', normalizedIotRequestId)
            .maybeSingle();

        if (requestSnapshotError) {
            console.error('SUPABASE OCR SNAPSHOT REQUEST FETCH ERROR:', requestSnapshotError);
            throw new Error(requestSnapshotError.message);
        }

        if (requestSnapshot) {
            return {
                document_id: requestSnapshot.document_id,
                application_id: applicationId,
                student_id: applicationRow.student_id,
                student_name: studentName || 'Unknown Student',
                document_key: normalizedDocumentKey,
                document_type: documentTypeName,
                ocr: buildOcrProjection(requestSnapshot),
                ocr_confidence: requestSnapshot.ocr_confidence ?? null,
                raw_text: requestSnapshot.ocr_raw_text || '',
                idempotent: true,
            };
        }
    }

    const structuredPersistence = buildStructuredOcrPersistence({
        documentKey: normalizedDocumentKey,
        extractedFields,
        sourcePayload,
        existingStructuredFields: existingRow?.ocr_structured_fields,
        existingReviewRequired: existingRow?.ocr_review_required,
        existingProcessingMetadata: existingRow?.ocr_processing_metadata,
    });
    const payload = {
        student_id: applicationRow.student_id,
        linked_record_id: applicationId,
        linked_record_type: 'application',
        document_key: normalizedDocumentKey,
        document_type: documentTypeName,
        file_url: existingRow?.file_url || sourceFileUrl,
        scanned_via_iot:
            typeof scannedViaIot === 'boolean'
                ? scannedViaIot
                : existingRow?.scanned_via_iot ?? false,
        iot_device_id:
            normalizedIotDeviceId ||
            (isUuid(existingRow?.iot_device_id) ? existingRow.iot_device_id : null),
        iot_request_id: normalizedIotRequestId,
        ocr_extracted_name: resolveStoredExtractedName({
            extractedFields: normalizedExtractedFields,
            scannedViaIot,
            existingExtractedName: existingRow?.ocr_extracted_name,
            studentName,
        }),
        ocr_extracted_gwa:
            normalizedExtractedGwa !== null && Number.isFinite(normalizedExtractedGwa)
                ? normalizedExtractedGwa
                : existingRow?.ocr_extracted_gwa ?? null,
        ocr_confidence:
            normalizedConfidence !== null && Number.isFinite(normalizedConfidence)
                ? normalizedConfidence
                : existingRow?.ocr_confidence ?? null,
        ocr_raw_text: normalizedRawText,
        ...structuredPersistence,
        scanned_at: scannedAt || existingRow?.scanned_at || now,
        updated_at: now,
    };

    const { data: result, error: insertError } = await supabase
        .from('ocr_extracted_documents')
        .insert(payload)
        .select()
        .single();

    if (insertError) {
        if (insertError.code === '23505' && normalizedIotRequestId) {
            const { data: duplicateSnapshot, error: duplicateError } = await supabase
                .from('ocr_extracted_documents')
                .select('*')
                .eq('iot_request_id', normalizedIotRequestId)
                .maybeSingle();

            if (!duplicateError && duplicateSnapshot) {
                return {
                    document_id: duplicateSnapshot.document_id,
                    application_id: applicationId,
                    student_id: applicationRow.student_id,
                    student_name: studentName || 'Unknown Student',
                    document_key: normalizedDocumentKey,
                    document_type: documentTypeName,
                    ocr: buildOcrProjection(duplicateSnapshot),
                    ocr_confidence: duplicateSnapshot.ocr_confidence ?? null,
                    raw_text: duplicateSnapshot.ocr_raw_text || '',
                    idempotent: true,
                };
            }
        }

        console.error('SUPABASE OCR SNAPSHOT INSERT ERROR:', insertError);
        throw new Error(insertError.message);
    }

    return {
        document_id: result.document_id,
        application_id: applicationId,
        student_id: applicationRow.student_id,
        student_name: studentName || 'Unknown Student',
        document_key: normalizedDocumentKey,
        document_type: documentTypeName,
        ocr: buildOcrProjection(result),
        ocr_confidence: result.ocr_confidence ?? null,
        raw_text: result.ocr_raw_text || '',
    };
};

exports.uploadStudentApplicationDocument = async ({
    applicationId,
    documentType,
    file,
    user,
}) => {
    if (!applicationId) {
        throw new Error('applicationId is required');
    }

    if (!documentType) {
        throw new Error('documentType is required');
    }

    if (!file) {
        throw new Error('No file uploaded');
    }

    const normalizedDocumentType = normalizeDocumentType(documentType);

    if (normalizedDocumentType === 'application_form') {
        throw new Error('Application Form is text-based and cannot be uploaded as a file');
    }

    if (!DOCUMENT_TYPE_TO_NAME[normalizedDocumentType]) {
        throw new Error('Invalid documentType');
    }

    const uploaderId = user?.userId || user?.user_id || null;
    if (!uploaderId) {
        throw new Error('Unauthorized upload');
    }

    const { data: applicationRecord, error: applicationError } = await supabase
        .from('applications')
        .select('application_id, student_id')
        .eq('application_id', applicationId)
        .single();

    if (applicationError) {
        console.error('Supabase Application Upload Check Error:', applicationError);
        throw new Error(applicationError.message);
    }

    const { data: studentRecord, error: studentError } = await supabase
        .from('students')
        .select('student_id, user_id')
        .eq('user_id', uploaderId)
        .maybeSingle();

    if (studentError) {
        console.error('Supabase Student Upload Check Error:', studentError);
        throw new Error(studentError.message);
    }

    if (!studentRecord || studentRecord.student_id !== applicationRecord.student_id) {
        throw new Error('You are not allowed to upload documents for this application');
    }

    const fileExt = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

    if (!allowedExtensions.includes(fileExt)) {
        throw new Error('Invalid file type. Allowed types: PDF, JPG, JPEG, PNG, WEBP');
    }

    const storageFileName = `${Date.now()}_${normalizedDocumentType}${fileExt}`;
    const storagePath = `applications/${applicationId}/${normalizedDocumentType}/${storageFileName}`;
    const resolvedContentType = resolveStorageContentType(fileExt, file.mimetype);

    const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file.buffer, {
            contentType: resolvedContentType,
            upsert: true,
        });

    if (uploadError) {
        console.error('SUPABASE STORAGE UPLOAD ERROR:', uploadError);
        throw new Error(uploadError.message);
    }

    const documentName = DOCUMENT_TYPE_TO_NAME[normalizedDocumentType];
    const { data: documentSlot, error: documentSlotError } = await supabase
        .from('application_documents')
        .select('document_id, file_path')
        .eq('application_id', applicationId)
        .eq('document_type', documentName)
        .maybeSingle();

    if (documentSlotError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw new Error(documentSlotError.message);
    }

    if (!documentSlot?.document_id) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw new Error('Document slot not found. Refresh the application and try again.');
    }

    const contentSha256 = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');

    const { error: finalizeError } = await supabase.rpc(
        'finalize_application_document_upload',
        {
            p_document_id: documentSlot.document_id,
            p_uploaded_by: studentRecord.student_id,
            p_created_by: uploaderId,
            p_file_path: storagePath,
            p_file_url: null,
            p_file_name: file.originalname,
            p_content_sha256: contentSha256,
            p_file_size_bytes: file.buffer.length,
        }
    );

    if (finalizeError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        console.error('SUPABASE APPLICATION DOCUMENT FINALIZE ERROR:', finalizeError);
        throw new Error(finalizeError.message);
    }

    if (documentSlot.file_path && documentSlot.file_path !== storagePath) {
        const { error: oldFileDeleteError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([documentSlot.file_path]);

        if (oldFileDeleteError) {
            console.warn('OLD APPLICATION DOCUMENT CLEANUP ERROR:', oldFileDeleteError);
        }
    }

    const signedUrl = await getSignedFileUrl(storagePath);

    const { data: existingDocuments, error: docsError } = await supabase
        .from('application_documents')
        .select('document_type, file_path, is_submitted')
        .eq('application_id', applicationId);

    if (docsError) {
        console.error('SUPABASE DOCUMENT STATUS CHECK ERROR:', docsError);
        throw new Error(docsError.message);
    }

    const requiredDocumentNames = Object.values(DOCUMENT_TYPE_TO_NAME).filter(
        (name) => name !== 'Application Form'
    );

    const uploadedNames = new Set(
        (existingDocuments || [])
            .filter((d) => d.is_submitted && d.file_path)
            .map((d) => d.document_type)
    );

    const allUploaded = requiredDocumentNames.every((name) => uploadedNames.has(name));
    const nextDocumentStatus = allUploaded ? 'Under Review' : 'Missing Docs';

    const { error: applicationUpdateError } = await supabase
        .from('applications')
        .update({
            document_status: nextDocumentStatus,
        })
        .eq('application_id', applicationId);

    if (applicationUpdateError) {
        console.error(
            'SUPABASE APPLICATION STATUS UPDATE ERROR:',
            applicationUpdateError
        );
        throw new Error(applicationUpdateError.message);
    }

    return {
        application_id: applicationId,
        document_key: normalizedDocumentType,
        document_name: documentName,
        file_name: file.originalname,
        file_path: storagePath,
        file_url: signedUrl,
        document_status: nextDocumentStatus,
    };
};

exports.markApplicationDisqualified = async (id, reason) => {
    const { data, error } = await supabase
        .from('applications')
        .update({
            is_disqualified: true,
            rejection_reason: reason || null,
            application_status: 'Rejected',
        })
        .eq('application_id', id)
        .select();

    if (error) {
        console.error('Supabase Update Error:', error);
        throw new Error(error.message);
    }

    return data;
};

exports.attemptScholarActivationIfReady = async (applicationId) => {
    const readiness = await fetchApplicationReadiness(applicationId);

    return {
        activated: false,
        readiness,
        outcome: readiness.scholar_activation_ready
            ? 'ready_for_explicit_activation'
            : 'pending_activation',
        application: null,
        scholar: null,
        notification: null,
        opening_auto_closed: false,
    };
};

function normalizeReviewDecision(value = 'pending') {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');

    switch (normalized) {
        case 'verified':
        case 'approved':
        case 'accepted':
            return 'verified';

        case 'rejected':
        case 'flagged':
        case 'needs_reupload':
        case 'reupload_required':
            return 'rejected';

        case 'uploaded':
        case 'under_review':
        case 'review':
            return 'uploaded';

        case 'pending':
        case '':
        default:
            return 'pending';
    }
}

exports.saveApplicationVerification = async (applicationId, payload, user) => {
    const {
        document_reviews = [],
        summary = {},
        final_comment = '',
        verification_status = null,
    } = payload || {};

    if (!Array.isArray(document_reviews)) {
        throw new Error('document_reviews must be an array');
    }

    let reviewedBy = user?.admin_id || null;

    if (!reviewedBy && (user?.user_id || user?.userId)) {
        const authUserId = user.user_id || user.userId;

        const { data: adminProfile, error: adminProfileError } = await supabase
            .from('admin_profiles')
            .select('admin_id')
            .eq('user_id', authUserId)
            .maybeSingle();

        if (adminProfileError) {
            throw new Error(adminProfileError.message);
        }

        reviewedBy = adminProfile?.admin_id || null;
    }
    const reviewedAt = new Date().toISOString();

    const reviewRows = document_reviews
        .map((doc) => ({
            application_id: applicationId,
            document_key: doc.document_key || doc.document_id || doc.id,
            document_name: doc.name,
            review_status: doc.status || 'pending',
            admin_comment: doc.comment || '',
            file_url: doc.url || null,
            reviewed_by: reviewedBy,
            reviewed_at: reviewedAt,
            updated_at: reviewedAt,
        }));

    if (reviewRows.length > 0) {
        const { error: reviewError } = await supabase
            .from('application_document_reviews')
            .upsert(reviewRows, {
                onConflict: 'application_id,document_key',
            });

        if (reviewError) {
            console.error('Supabase Review Upsert Error:', reviewError);
            throw new Error(reviewError.message);
        }
    }

    for (const doc of document_reviews) {
        const normalizedDocumentType = normalizeDocumentType(
            doc.document_key || doc.document_type || doc.id || doc.name
        );

        if (normalizedDocumentType === 'application_form') {
            continue;
        }

        const documentTypeName =
            DOCUMENT_TYPE_TO_NAME[normalizedDocumentType] || doc.document_type || doc.name;

        if (!documentTypeName) continue;

        const normalizedReviewStatus =
            normalizeReviewDecision(
                doc.status || 'pending'
            );

        const { error: submittedDocumentError } = await supabase
            .from('application_documents')
            .update({
                is_submitted: !!doc.url,
                file_url: doc.url || null,

                review_status: normalizedReviewStatus,

                notes: doc.comment || null,
                remarks: doc.comment || null,

                updated_at: reviewedAt,
            })
            .eq('application_id', applicationId)
            .eq('document_type', documentTypeName);

        if (submittedDocumentError) {
            console.error(
                'Supabase Submitted Document Update Error:',
                submittedDocumentError
            );
            throw new Error(submittedDocumentError.message);
        }
    }

    const nextDocumentStatus = deriveAggregateDocumentStatus(summary);

    const applicationUpdatePayload = {
        document_status: nextDocumentStatus,
    };

    if (verification_status) {
        applicationUpdatePayload.verification_status = verification_status;
    }

    if (verification_status === 'rejected') {
        applicationUpdatePayload.application_status = 'Rejected';
        applicationUpdatePayload.is_disqualified = true;
        applicationUpdatePayload.rejection_reason = final_comment || null;
    }

    const { data: updatedApplication, error: applicationUpdateError } = await supabase
        .from('applications')
        .update(applicationUpdatePayload)
        .eq('application_id', applicationId)
        .select()
        .single();

    if (applicationUpdateError) {
        console.error('Supabase Application Update Error:', applicationUpdateError);
        throw new Error(applicationUpdateError.message);
    }

    let finalOutcome = verification_status;
    let finalizedApplication = updatedApplication;
    let scholar = null;
    let notification = null;
    let activation = null;

    if (verification_status === 'verified') {
        const requirementsCompletedAt = await resolveRequirementsCompletedAt(applicationId);

        const { data: qualifiedApplication, error: qualifiedUpdateError } = await supabase
            .from('applications')
            .update({
                requirements_completed_at:
                    requirementsCompletedAt || updatedApplication?.submission_date || reviewedAt,
                requirements_verified_at: reviewedAt,
                selection_status: 'Requirements Verified',
                queue_position: null,
                waitlist_position: null,
                activation_status: 'Not Activated',
            })
            .eq('application_id', applicationId)
            .select()
            .single();

        if (qualifiedUpdateError) {
            console.error('SUPABASE QUALIFIED APPLICATION UPDATE ERROR:', qualifiedUpdateError);
            throw new Error(qualifiedUpdateError.message);
        }

        finalizedApplication = qualifiedApplication;
        finalOutcome = 'requirements_complete';
    } else if (verification_status === 'rejected') {
        if (updatedApplication?.student_id) {
            const { data: studentRow } = await supabase
                .from('students')
                .select('user_id')
                .eq('student_id', updatedApplication.student_id)
                .maybeSingle();

            if (studentRow?.user_id) {
                notification = await deliverVerificationOutcomeNotification({
                    outcome: 'rejected',
                    applicationId,
                    userId: studentRow.user_id,
                    scholarId: null,
                });
            }
        }
    }

    if (verification_status === 'verified') {
        await readinessQueueService.syncApplicationReadiness(applicationId);
    }

    const readiness = await fetchApplicationReadiness(applicationId);
    const detailedApplication = await buildApplicationDetails(applicationId);

    return {
        application: finalizedApplication,
        application_detail: detailedApplication,
        readiness,
        activation,
        verification_status,
        final_outcome: finalOutcome,
        scholar,
        notification,
        summary: {
            verified: Number(summary?.verified || 0),
            uploaded: Number(summary?.uploaded || 0),
            rejected: Number(summary?.rejected || summary?.reupload || 0),
            pending: Number(summary?.pending || 0),
            progress: Number(summary?.progress || 0),
        },
        final_comment,
    };
};

exports.markApplicationReviewed = async (applicationId) => {
    const { data, error } = await supabase
        .from('applications')
        .update({
            application_status: 'Pending Review',
        })
        .eq('application_id', applicationId)
        .select()
        .single();

    if (error) {
        console.error('Supabase Mark Reviewed Error:', error);
        throw new Error(error.message);
    }

    return data;
};

exports.saveApplicationRemarks = async (applicationId, remarks) => {
    const { data, error } = await supabase
        .from('applications')
        .update({
            remarks: remarks || null,
        })
        .eq('application_id', applicationId)
        .select()
        .single();

    if (error) {
        console.error('Supabase Save Remarks Error:', error);
        throw new Error(error.message);
    }

    return data;
};

exports.assignApplicationProgram = async (applicationId, programId) => {
    const { data, error } = await supabase
        .from('applications')
        .update({
            program_id: programId,
        })
        .eq('application_id', applicationId)
        .select()
        .single();

    if (error) {
        console.error('Supabase Assign Program Error:', error);
        throw new Error(error.message);
    }

    return data;
};

exports.moveApplicationToWaiting = async (_applicationId) => {
    throw new Error('Waiting status is not supported by the current applications schema');
};

exports.approveApplicationWithSlotCheck = async (applicationId, actor = {}) => {
    const readiness = await fetchApplicationReadiness(applicationId);
    if (!readiness.scholar_activation_ready) {
        throw buildHttpError(
            409,
            `Scholar activation is blocked: ${readiness.blockers.join(', ') || 'requirements or endorsement is incomplete'}.`
        );
    }

    const client = await pool.connect();
    let activationResult;

    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `
            SELECT
                a.application_id,
                a.student_id,
                a.program_id,
                a.opening_id,
                a.application_status,
                a.activation_status,
                a.selection_status,
                a.queue_position,
                a.fcfs_completed_at,
                st.user_id AS student_user_id,
                st.is_active_scholar,
                st.scholarship_status,
                st.current_application_id,
                po.allocated_slots,
                po.posting_status,
                po.academic_year_id,
                po.period_id
            FROM applications a
            JOIN students st ON st.student_id = a.student_id
            JOIN program_openings po ON po.opening_id = a.opening_id
            WHERE a.application_id = $1
            FOR UPDATE OF a, st, po
            `,
            [applicationId]
        );

        if (!rows.length) throw buildHttpError(404, 'Application not found.');
        const row = rows[0];

        if (!row.student_id || !row.program_id || !row.opening_id) {
            throw buildHttpError(409, 'Application is missing its student, program, or opening assignment.');
        }

        if (
            String(row.activation_status || '').toLowerCase() === 'activated' ||
            (row.is_active_scholar === true && String(row.current_application_id || '') === String(applicationId))
        ) {
            await client.query('COMMIT');
            return {
                activated: false,
                already_activated: true,
                outcome: 'already_activated',
                readiness,
                application_id: applicationId,
                student_id: row.student_id,
            };
        }

        if (
            row.is_active_scholar === true ||
            String(row.scholarship_status || '').toLowerCase() === 'active' ||
            (row.current_application_id && String(row.current_application_id) !== String(applicationId))
        ) {
            throw buildHttpError(409, 'This student already has a different active scholarship record.');
        }

        const openingStatus = String(row.posting_status || '').toLowerCase();
        if (['archived', 'filled'].includes(openingStatus)) {
            throw buildHttpError(409, 'This scholarship opening is no longer available for activation.');
        }

        const capacity = Number(row.allocated_slots || 0);

        // FCFS is authoritative: only applicants inside the opening's reserved
        // positions may be activated as scholars. Different openings maintain
        // independent queues.
        const queuePosition = Number(row.queue_position || 0);
        const selectionStatus = String(row.selection_status || '').trim().toLowerCase();

        if (!row.fcfs_completed_at || queuePosition <= 0) {
            throw buildHttpError(
                409,
                'This applicant is not yet ranked. Requirements and endorsement must both be complete.'
            );
        }

        if (selectionStatus === 'waitlisted') {
            throw buildHttpError(
                409,
                `This applicant is waitlisted at FCFS position #${queuePosition}.`
            );
        }

        if (!['reserved', 'selected', 'promoted'].includes(selectionStatus)) {
            throw buildHttpError(
                409,
                'This applicant does not currently hold a reserved scholarship slot.'
            );
        }

        const countResult = await client.query(
            `
            SELECT count(*)::int AS occupied_slots
            FROM applications
            WHERE opening_id = $1
              AND lower(coalesce(activation_status, '')) = 'activated'
              AND application_id <> $2
            `,
            [row.opening_id, applicationId]
        );
        const occupiedSlots = Number(countResult.rows[0]?.occupied_slots || 0);

        if (capacity > 0 && occupiedSlots >= capacity) {
            throw buildHttpError(409, 'No available slots remain for this scholarship opening.');
        }

        const actorId = actor.user_id || actor.userId || actor.admin_id || actor.id || null;
        const applicationResult = await client.query(
            `
            UPDATE applications
            SET application_status = 'Approved',
                selection_status = 'Selected',
                activation_status = 'Activated',
                selected_at = coalesce(selected_at, now()),
                finalized_at = now(),
                finalized_by = $2,
                activated_at = now(),
                is_disqualified = false,
                rejection_reason = null
            WHERE application_id = $1
            RETURNING *
            `,
            [applicationId, actorId]
        );

        const studentResult = await client.query(
            `
            UPDATE students
            SET is_active_scholar = true,
                scholarship_status = 'Active',
                current_program_id = $2,
                current_application_id = $3,
                active_academic_year_id = $4,
                active_period_id = $5,
                date_awarded = CURRENT_DATE,
                scholar_is_archived = false,
                updated_at = now()
            WHERE student_id = $1
            RETURNING *
            `,
            [row.student_id, row.program_id, applicationId, row.academic_year_id, row.period_id]
        );

        const nextFilledSlots = occupiedSlots + 1;
        await client.query(
            `
            UPDATE program_openings
            SET filled_slots = $2,
                posting_status = CASE
                    WHEN allocated_slots > 0 AND $2 >= allocated_slots THEN 'filled'
                    ELSE posting_status
                END,
                updated_at = now()
            WHERE opening_id = $1
            `,
            [row.opening_id, nextFilledSlots]
        );

        await client.query('COMMIT');
        activationResult = {
            activated: true,
            already_activated: false,
            outcome: 'activated',
            readiness,
            application: applicationResult.rows[0],
            scholar: studentResult.rows[0],
            student_user_id: row.student_user_id || null,
            opening_id: row.opening_id,
            occupied_slots: nextFilledSlots,
            capacity,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    if (activationResult?.student_user_id) {
        try {
            activationResult.notification = await deliverVerificationOutcomeNotification({
                outcome: 'approved',
                applicationId,
                userId: activationResult.student_user_id,
                scholarId: activationResult.scholar?.student_id || null,
            });
        } catch (notificationError) {
            console.error('SCHOLAR ACTIVATION NOTIFICATION ERROR:', notificationError.message);
            activationResult.notification_error = notificationError.message;
        }
    }

    return activationResult;
};

module.exports = {
    fetchApplications: exports.fetchApplications,
    fetchApplicationDetailsById: exports.fetchApplicationDetailsById,
    fetchApplicationDocumentsById: exports.fetchApplicationDocumentsById,
    runApplicationDocumentIotOcr: exports.runApplicationDocumentIotOcr,
    fetchApplicationDocumentOcrSnapshot: exports.fetchApplicationDocumentOcrSnapshot,
    saveApplicationDocumentOcrSnapshot: exports.saveApplicationDocumentOcrSnapshot,
    getApplicationDocumentIotOcr: exports.getApplicationDocumentIotOcr,
    confirmApplicationDocumentIotOcr: exports.confirmApplicationDocumentIotOcr,
    retryApplicationDocumentIotOcr: exports.retryApplicationDocumentIotOcr,
    cancelApplicationDocumentIotOcr: exports.cancelApplicationDocumentIotOcr,
    uploadStudentApplicationDocument: exports.uploadStudentApplicationDocument,
    markApplicationDisqualified: exports.markApplicationDisqualified,
    saveApplicationVerification: exports.saveApplicationVerification,
    fetchApplicationReadiness,
    fetchApplicationReadinessMap,
    decorateApplicationRecordsWithReadiness,
    attemptScholarActivationIfReady: exports.attemptScholarActivationIfReady,
    markApplicationReviewed: exports.markApplicationReviewed,
    saveApplicationRemarks: exports.saveApplicationRemarks,
    assignApplicationProgram: exports.assignApplicationProgram,
    moveApplicationToWaiting: exports.moveApplicationToWaiting,
    approveApplicationWithSlotCheck: exports.approveApplicationWithSlotCheck,
    normalizeDocumentType,
    getDocumentTypeName: (documentKey) => DOCUMENT_TYPE_TO_NAME[documentKey] || null,
    normalizeOcrPayload,
    sanitizeStructuredOcrFields,
    sanitizeOcrProcessingMetadata,
    deriveOcrReviewRequired,
    buildStructuredOcrPersistence,
    buildOcrProjection,
    buildOcrOnlyDocument,
    resolveIotExtractedName,
    resolveStoredExtractedName,
};

