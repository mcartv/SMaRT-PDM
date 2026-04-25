const path = require('path');
const https = require('https');
const supabase = require('../config/supabase');
const pool = require('../config/db');
const _ = require('lodash');
const iotOcrRequestService = require('./iotOcrRequestService');
const documentTypes = require('../utils/documentTypes');

const STORAGE_BUCKET =
    process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET || 'application-documents';
const STUDENT_BACKEND_BASE_URL =
    process.env.STUDENT_BACKEND_BASE_URL || 'http://127.0.0.1:3000';
const IOT_OCR_ENDPOINT_URL =
    (process.env.IOT_OCR_ENDPOINT_URL || '').trim();
const IOT_OCR_API_KEY =
    (process.env.IOT_OCR_API_KEY || '').trim();
const INTERNAL_NOTIFICATION_SECRET =
    (process.env.INTERNAL_NOTIFICATION_SECRET || '').trim();
const IOT_OCR_TIMEOUT_MS = Number(process.env.IOT_OCR_TIMEOUT_MS || 15000);

const APPROVED_SCHOLAR_NOTIFICATION = Object.freeze({
    type: 'Scholar Approved',
    title: 'Scholarship Approved',
    message:
        'Your verification is complete and your scholarship has been approved.',
    referenceType: 'scholar',
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
        id: 'certificate_of_registration',
        name: 'Certificate of Registration',
        aliases: ['certificate of registration', 'cor', 'registration form', 'registration'],
    },
    {
        id: 'student_grade_forms',
        name: 'Grade Form',
        aliases: ['student grade forms', 'grade forms', 'grades', 'grade card', 'report card', 'grade form'],
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
    cor: 'certificate_of_registration',
    certificate_of_registration: 'certificate_of_registration',
    registration: 'certificate_of_registration',

    grade_card: 'student_grade_forms',
    grade_forms: 'student_grade_forms',
    grades: 'student_grade_forms',
    student_grade_forms: 'student_grade_forms',
    grade_form: 'student_grade_forms',

    certificate_of_indigency: 'certificate_of_indigency',
    indigency: 'certificate_of_indigency',

    lor: 'letter_of_request',
    letter_of_request: 'letter_of_request',
    request_letter: 'letter_of_request',

    application_form: 'application_form',
    application: 'application_form',
};

const DOCUMENT_TYPE_TO_NAME = {
    certificate_of_registration: 'Certificate of Registration',
    student_grade_forms: 'Student Grade Forms',
    certificate_of_indigency: 'Certificate of Indigency',
    letter_of_request: 'Letter of Request',
    application_form: 'Application Form',
};

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

function inferDocumentKey(document = {}) {
    const candidates = [
        document.document_type,
        document.file_name,
        document.document_name,
    ]
        .filter(Boolean)
        .map((value) => normalizeLookupValue(value));

    for (const definition of APPLICATION_DOCUMENT_DEFINITIONS) {
        if (
            candidates.some((candidate) =>
                definition.aliases.some((alias) => candidate.includes(alias))
            )
        ) {
            return definition.id;
        }
    }

    return document.requirement_id
        ? `requirement-${document.requirement_id}`
        : normalizeLookupValue(
            document.document_type || document.file_name || 'document'
        ).replace(/\s+/g, '_');
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
        source_payload: payload,
    };
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
            application_status,
            document_status,
            submission_date,
            is_disqualified,
            rejection_reason,
            evaluator_id,
            students (
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
        console.error('Supabase Application Detail Error:', applicationError);
        throw new Error(applicationError.message);
    }

    if (applicationRecord?.student_id) {
        const { data: existingScholar, error: scholarCheckError } = await supabase
            .from('scholars')
            .select('scholar_id, application_id')
            .eq('student_id', applicationRecord.student_id)
            .eq('status', 'Active')
            .eq('is_archived', false)
            .order('date_awarded', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

        if (scholarCheckError) {
            console.error('Supabase Scholar Check Error:', scholarCheckError);
            throw new Error(scholarCheckError.message);
        }

        if (existingScholar && existingScholar.application_id !== applicationId) {
            throw new Error(
                'This application has already been converted into an active scholar record.'
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
    ] = await Promise.all([
        supabase
            .from('student_profiles')
            .select('*')
            .eq('student_id', applicationRecord.student_id)
            .maybeSingle(),
        supabase
            .from('student_family')
            .select('*')
            .eq('student_id', applicationRecord.student_id)
            .order('relation', { ascending: true }),
        supabase
            .from('student_education')
            .select('*')
            .eq('student_id', applicationRecord.student_id)
            .order('education_level', { ascending: true }),
        supabase
            .from('application_documents')
            .select('*')
            .eq('application_id', applicationId)
            .order('submitted_at', { ascending: true }),
        supabase
            .from('application_document_reviews')
            .select('*')
            .eq('application_id', applicationId),
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
                scanned_at,
                updated_at
            `)
            .eq('linked_record_id', applicationId)
            .eq('student_id', applicationRecord.student_id)
            .eq('linked_record_type', 'application'),
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
            .eq('application_id', applicationId)
            .order('created_at', { ascending: false }),
    ]);

    const resultErrors = [
        profileResult.error,
        familyMembersResult.error,
        educationRecordsResult.error,
        documentsResult.error,
        reviewsResult.error,
        ocrResult.error,
        iotOcrRequestsResult.error,
    ].filter(Boolean);

    if (resultErrors.length > 0) {
        console.error('Supabase Application Detail Relation Error:', resultErrors[0]);
        throw new Error(resultErrors[0].message);
    }

    const student = applicationRecord.students || {};
    const scholarshipProgram = applicationRecord.scholarship_program || {};
    const benefactor = scholarshipProgram.benefactors || {};
    const profile = profileResult.data || null;

    let userContact = { email: 'N/A', phone_number: 'N/A' };

    if (student.user_id) {
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('email, phone_number')
            .eq('user_id', student.user_id)
            .maybeSingle();

        if (userError) {
            console.error('Supabase User Fetch Error:', userError);
            throw new Error(userError.message);
        }

        if (userData) userContact = userData;
    }

    let courseCode = 'N/A';
    if (student.course_id) {
        const { data: courseData, error: courseError } = await supabase
            .from('academic_course')
            .select('course_code')
            .eq('course_id', student.course_id)
            .maybeSingle();

        if (courseError) {
            console.error('Supabase Course Fetch Error:', courseError);
            throw new Error(courseError.message);
        }

        if (courseData) courseCode = courseData.course_code;
    }

    const reviewByKey = new Map(
        (reviewsResult.data || []).map((review) => [review.document_key, review])
    );
    const ocrByKey = new Map(
        (ocrResult.data || []).map((ocrRow) => {
            const resolvedKey = normalizeDocumentType(
                ocrRow.document_key || ocrRow.document_type || ''
            );

            return [
                resolvedKey,
                {
                    id: ocrRow.document_id || null,
                    document_key: resolvedKey,
                    document_type: ocrRow.document_type || null,
                    file_url: ocrRow.file_url || null,
                    scanned_via_iot: !!ocrRow.scanned_via_iot,
                    iot_device_id: ocrRow.iot_device_id || null,
                    extracted_name: ocrRow.ocr_extracted_name || null,
                    extracted_gwa: ocrRow.ocr_extracted_gwa ?? null,
                    confidence: ocrRow.ocr_confidence ?? null,
                    raw_text: ocrRow.ocr_raw_text || '',
                    scanned_at: ocrRow.scanned_at || null,
                    updated_at: ocrRow.updated_at || null,
                },
            ];
        })
    );
    const latestIotOcrRequestByKey = new Map();

    (iotOcrRequestsResult.data || []).forEach((requestRow) => {
        const resolvedKey = normalizeDocumentType(
            requestRow.document_key || requestRow.document_type || ''
        );

        if (!resolvedKey || latestIotOcrRequestByKey.has(resolvedKey)) {
            return;
        }

        latestIotOcrRequestByKey.set(resolvedKey, {
            request_id: requestRow.request_id,
            document_key: resolvedKey,
            document_type: requestRow.document_type || null,
            status: requestRow.status || 'pending',
            requested_by: requestRow.requested_by || null,
            claimed_by: requestRow.claimed_by || null,
            error_message: requestRow.error_message || null,
            created_at: requestRow.created_at || null,
            claimed_at: requestRow.claimed_at || null,
            completed_at: requestRow.completed_at || null,
            updated_at: requestRow.updated_at || null,
        });
    });

    const rawDocuments = documentsResult.data || [];

    const normalizedDocuments = await Promise.all(
        rawDocuments.map(async (document) => {
            const documentKey = inferDocumentKey(document);
            const review = reviewByKey.get(documentKey) || null;
            const ocr = ocrByKey.get(documentKey) || null;
            const latestIotOcrRequest = latestIotOcrRequestByKey.get(documentKey) || null;
            const filePath = document.file_path || null;
            const signedUrl = filePath ? await getSignedFileUrl(filePath) : null;

            return {
                id: documentKey,
                document_key: documentKey,
                name: DOCUMENT_TYPE_TO_NAME[documentKey] || document.document_type || 'Document',
                document_type: document.document_type || null,
                file_name: document.file_name || null,
                file_path: filePath,
                url: signedUrl || document.file_url || null,
                file_url: signedUrl || document.file_url || null,
                signed_url: signedUrl || null,
                status: deriveReviewStatus(document, review),
                admin_comment: review?.admin_comment || document.notes || '',
                notes: document.notes || null,
                ocr: ocr || {},
                ocr_confidence: ocr?.confidence ?? null,
                iot_ocr_request: latestIotOcrRequest,
                ocr_job: latestIotOcrRequest,
                uploaded_at: document.submitted_at || null,
                submitted_at: document.submitted_at || null,
                reviewed_at: review?.reviewed_at || null,
            };
        })
    );

    normalizedDocuments.push({
        id: 'application_form',
        document_key: 'application_form',
        name: 'Application Form',
        document_type: 'Application Form',
        file_name: null,
        file_path: null,
        url: null,
        file_url: null,
        signed_url: null,
        status: reviewByKey.get('application_form')?.review_status || 'pending',
        admin_comment: reviewByKey.get('application_form')?.admin_comment || '',
        notes: null,
        ocr: {},
        ocr_confidence: null,
        iot_ocr_request: latestIotOcrRequestByKey.get('application_form') || null,
        ocr_job: latestIotOcrRequestByKey.get('application_form') || null,
        uploaded_at: applicationRecord.submission_date || null,
        submitted_at: applicationRecord.submission_date || null,
        reviewed_at: reviewByKey.get('application_form')?.reviewed_at || null,
    });

    const documents = ensureDocumentCoverage(normalizedDocuments);

    return {
        id: applicationRecord.application_id,
        application: {
            application_id: applicationRecord.application_id,
            student_id: applicationRecord.student_id,
            program_id: applicationRecord.program_id,
            application_status: applicationRecord.application_status,
            document_status: applicationRecord.document_status,
            submission_date: applicationRecord.submission_date,
            is_disqualified: !!applicationRecord.is_disqualified,
            rejection_reason: applicationRecord.rejection_reason || null,
            evaluator_id: applicationRecord.evaluator_id || null,
        },
        application_status: applicationRecord.application_status,
        document_status: applicationRecord.document_status,
        submitted: applicationRecord.submission_date,
        disqualified: !!applicationRecord.is_disqualified,
        rejection_reason: applicationRecord.rejection_reason || null,
        student: {
            name:
                `${student.first_name || ''} ${student.last_name || ''}`.trim() ||
                'Unknown Student',
            initials:
                `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() ||
                'NA',
            avatar_url: await resolveAvatarUrl(student.profile_photo_url),
            pdm_id: student.pdm_id || 'N/A',
            email: userContact.email || 'N/A',
            phone: userContact.phone_number || 'N/A',
            year: student.year_level
                ? `${student.year_level}${getOrdinalSuffix(student.year_level)} Year`
                : 'N/A',
            gwa: student.gwa ?? 'N/A',
            program: scholarshipProgram.program_name || 'General',
            benefactor_name: benefactor.benefactor_name || 'N/A',
            course: courseCode,
            barangay: profile?.barangay || 'N/A',
        },
        student_profile: profile,
        family_members: familyMembersResult.data || [],
        education_records: educationRecordsResult.data || [],
        documents,
    };
}

exports.fetchApplications = async () => {
    const query = `
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
    LEFT JOIN students st
        ON a.student_id = st.student_id
    LEFT JOIN program_openings po
        ON a.opening_id = po.opening_id
    LEFT JOIN academic_years ay
        ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap
        ON po.period_id = ap.period_id
    LEFT JOIN scholarship_program sp
        ON a.program_id = sp.program_id
    LEFT JOIN scholars sc
        ON a.student_id = sc.student_id
        AND COALESCE(sc.is_archived, FALSE) = FALSE
        AND LOWER(COALESCE(sc.status, '')) = 'active'

    WHERE
        COALESCE(a.is_archived, FALSE) = FALSE
        AND COALESCE(po.is_archived, FALSE) = FALSE
        AND LOWER(COALESCE(po.posting_status, '')) <> 'closed'
        AND sc.student_id IS NULL
        AND COALESCE(a.is_disqualified, FALSE) = FALSE
        AND LOWER(COALESCE(a.application_status, '')) NOT IN ('approved')

    ORDER BY a.submission_date DESC
`;

    const { rows } = await pool.query(query);

    const processed = rows.map((row) => {
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
            sdo_status: row.sdo_status || 'clear',

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

    return _.orderBy(
        processed,
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

    if (normalizedDocumentKey === 'application_form') {
        throw new Error('IoT OCR is only available for camera-scannable documents');
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
            students (
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

exports.fetchApplicationDocumentOcrSnapshot = async ({
    applicationId,
    documentKey,
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
            students (
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
            scanned_via_iot,
            iot_device_id,
            scanned_at,
            updated_at
        `)
        .eq('linked_record_id', applicationId)
        .eq('student_id', applicationRow.student_id)
        .eq('linked_record_type', 'application')
        .eq('document_key', normalizedDocumentKey)
        .limit(1);

    if (ocrError) {
        console.error('SUPABASE OCR SNAPSHOT FETCH DOCUMENT ERROR:', ocrError);
        throw new Error(ocrError.message);
    }

    const ocrRow = ocrRows?.[0] || null;
    const latestRequest = await iotOcrRequestService.getLatestRequestForDocument({
        applicationId,
        documentKey: normalizedDocumentKey,
    });

    return {
        document_id: ocrRow?.document_id || null,
        application_id: applicationId,
        student_id: applicationRow.student_id,
        student_name: studentName || 'Unknown Student',
        document_key: normalizedDocumentKey,
        document_type: documentTypeName,
        ocr: {
            extracted_name: ocrRow?.ocr_extracted_name || null,
            extracted_gwa: ocrRow?.ocr_extracted_gwa ?? null,
            confidence: ocrRow?.ocr_confidence ?? null,
            raw_text: ocrRow?.ocr_raw_text || '',
        },
        ocr_confidence: ocrRow?.ocr_confidence ?? null,
        raw_text: ocrRow?.ocr_raw_text || '',
        scanned_via_iot: !!ocrRow?.scanned_via_iot,
        iot_device_id: ocrRow?.iot_device_id || null,
        scanned_at: ocrRow?.scanned_at || null,
        updated_at: ocrRow?.updated_at || null,
        iot_ocr_request: latestRequest,
    };
};

exports.saveApplicationDocumentOcrSnapshot = async ({
    applicationId,
    documentKey,
    rawText,
    ocrConfidence = null,
    extractedFields = null,
    scannedViaIot = null,
    iotDeviceId = null,
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
            students (
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
    const normalizedExtractedFields =
        extractedFields && typeof extractedFields === 'object'
            ? extractedFields
            : {};
    const extractedNameCandidate = [
        normalizedExtractedFields.extracted_name,
        normalizedExtractedFields.student_name,
        normalizedExtractedFields.name,
    ]
        .map((value) => (value === undefined || value === null ? '' : String(value).trim()))
        .find(Boolean);
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
            scanned_at,
            ocr_extracted_name,
            ocr_extracted_gwa,
            ocr_confidence
        `)
        .eq('linked_record_id', applicationId)
        .eq('student_id', applicationRow.student_id)
        .eq('linked_record_type', 'application')
        .eq('document_key', normalizedDocumentKey)
        .limit(1);

    if (existingOcrError) {
        console.error('SUPABASE OCR SNAPSHOT EXISTING FETCH ERROR:', existingOcrError);
        throw new Error(existingOcrError.message);
    }

    const existingRow = existingOcrRows?.[0] || null;
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
        ocr_extracted_name:
            extractedNameCandidate ||
            existingRow?.ocr_extracted_name ||
            studentName ||
            null,
        ocr_extracted_gwa:
            normalizedExtractedGwa !== null && Number.isFinite(normalizedExtractedGwa)
                ? normalizedExtractedGwa
                : existingRow?.ocr_extracted_gwa ?? null,
        ocr_confidence:
            normalizedConfidence !== null && Number.isFinite(normalizedConfidence)
                ? normalizedConfidence
                : existingRow?.ocr_confidence ?? null,
        ocr_raw_text: normalizedRawText,
        scanned_at: scannedAt || existingRow?.scanned_at || now,
        updated_at: now,
    };

    let result;

    if (existingRow?.document_id) {
        const { data, error } = await supabase
            .from('ocr_extracted_documents')
            .update(payload)
            .eq('document_id', existingRow.document_id)
            .select()
            .single();

        if (error) {
            console.error('SUPABASE OCR SNAPSHOT UPDATE ERROR:', error);
            throw new Error(error.message);
        }

        result = data;
    } else {
        const { data, error } = await supabase
            .from('ocr_extracted_documents')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('SUPABASE OCR SNAPSHOT INSERT ERROR:', error);
            throw new Error(error.message);
        }

        result = data;
    }

    return {
        document_id: result.document_id,
        application_id: applicationId,
        student_id: applicationRow.student_id,
        student_name: studentName || 'Unknown Student',
        document_key: normalizedDocumentKey,
        document_type: documentTypeName,
        ocr: {
            extracted_name: result.ocr_extracted_name || null,
            extracted_gwa: result.ocr_extracted_gwa ?? null,
            confidence: result.ocr_confidence ?? null,
            raw_text: result.ocr_raw_text || '',
        },
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

    const now = new Date().toISOString();
    const storageFileName = `${normalizedDocumentType}${fileExt}`;
    const storagePath = `applications/${applicationId}/${storageFileName}`;
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

    const signedUrl = await getSignedFileUrl(storagePath);

    const documentRow = {
        application_id: applicationId,
        document_type: DOCUMENT_TYPE_TO_NAME[normalizedDocumentType],
        file_name: file.originalname,
        file_path: storagePath,
        file_url: signedUrl,
        is_submitted: true,
        submitted_at: now,
        notes: null,
        uploaded_by: studentRecord.student_id,
        updated_at: now,
    };

    const { error: documentUpsertError } = await supabase
        .from('application_documents')
        .upsert(documentRow, {
            onConflict: 'application_id,document_type',
        });

    if (documentUpsertError) {
        console.error(
            'SUPABASE APPLICATION DOCUMENT UPSERT ERROR:',
            documentUpsertError
        );
        throw new Error(documentUpsertError.message);
    }

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
        document_name: DOCUMENT_TYPE_TO_NAME[normalizedDocumentType],
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

    const reviewedBy = user?.userId || user?.user_id || null;
    const reviewedAt = new Date().toISOString();

    const reviewRows = document_reviews.map((doc) => ({
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

        const { error: submittedDocumentError } = await supabase
            .from('application_documents')
            .update({
                is_submitted: !!doc.url,
                file_url: doc.url || null,
                notes: doc.comment || null,
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

    if (verification_status === 'verified') {
        const approvalResult = await exports.approveApplicationWithSlotCheck(applicationId);

        finalizedApplication = approvalResult.application || approvalResult;
        scholar = approvalResult.scholar || null;
        finalOutcome =
            approvalResult.outcome === 'approved' || approvalResult.outcome === 'already_approved'
                ? 'approved'
                : 'verified';

        if (approvalResult.notificationShouldSend && approvalResult.student_user_id) {
            notification = await deliverVerificationOutcomeNotification({
                outcome: approvalResult.outcome,
                applicationId,
                userId: approvalResult.student_user_id,
                scholarId: scholar?.scholar_id || null,
            });
        }
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

    return {
        application: finalizedApplication,
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

exports.approveApplicationWithSlotCheck = async (applicationId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const applicationQuery = `
            SELECT
                a.application_id,
                a.student_id,
                a.program_id,
                a.opening_id,
                a.application_status,
                a.submission_date,
                st.user_id AS student_user_id,
                po.allocated_slots,
                po.filled_slots,
                po.posting_status,
                po.is_archived AS opening_is_archived,
                po.academic_year_id,
                po.period_id,
                COUNT(a2.application_id) FILTER (
                    WHERE LOWER(COALESCE(a2.application_status, '')) = 'approved'
                )::int AS approved_count
            FROM applications a
            INNER JOIN students st
                ON st.student_id = a.student_id
            INNER JOIN program_openings po
                ON po.opening_id = a.opening_id
            LEFT JOIN applications a2
                ON a2.opening_id = po.opening_id
            WHERE a.application_id = $1
            GROUP BY
                a.application_id,
                a.student_id,
                a.program_id,
                a.opening_id,
                a.application_status,
                a.submission_date,
                st.user_id,
                po.allocated_slots,
                po.filled_slots,
                po.posting_status,
                po.is_archived,
                po.academic_year_id,
                po.period_id
        `;

        const applicationResult = await client.query(applicationQuery, [applicationId]);

        if (!applicationResult.rows.length) {
            throw new Error('Application not found');
        }

        const row = applicationResult.rows[0];
        const slotCount = Number(row.allocated_slots || 0);
        const approvedCount = Number(row.approved_count || 0);
        const openingStatus = String(row.posting_status || '').toLowerCase();
        const currentApplicationStatus = String(row.application_status || '').toLowerCase();
        const openingIsArchived = !!row.opening_is_archived;

        if (!row.student_id || !row.program_id) {
            throw new Error('Application is missing student_id or program_id');
        }

        if (openingIsArchived) {
            throw new Error('This opening is already archived.');
        }

        const existingScholarResult = await client.query(
            `
            SELECT scholar_id, application_id
            FROM scholars
            WHERE COALESCE(is_archived, FALSE) = FALSE
              AND LOWER(COALESCE(status, '')) = 'active'
              AND (application_id = $1 OR student_id = $2)
            LIMIT 1
            `,
            [applicationId, row.student_id]
        );

        if (existingScholarResult.rows.length > 0) {
            const existingApplicationResult = await client.query(
                `SELECT * FROM applications WHERE application_id = $1`,
                [applicationId]
            );

            await client.query('COMMIT');

            return {
                application: existingApplicationResult.rows[0],
                scholar: existingScholarResult.rows[0],
                outcome: 'already_approved',
                notificationShouldSend: false,
                student_user_id: row.student_user_id || null,
            };
        }

        if (currentApplicationStatus === 'approved') {
            const existingApplicationResult = await client.query(
                `SELECT * FROM applications WHERE application_id = $1`,
                [applicationId]
            );

            await client.query('COMMIT');

            return {
                application: existingApplicationResult.rows[0],
                scholar: null,
                outcome: 'already_approved',
                notificationShouldSend: false,
                student_user_id: row.student_user_id || null,
            };
        }

        // Manual close should block approvals.
        if (openingStatus === 'closed') {
            throw new Error('This opening is already closed.');
        }
        // If slots are already exhausted, finalize the opening.
        if (slotCount > 0 && approvedCount >= slotCount) {
            await client.query(
                `
                UPDATE program_openings
                SET posting_status = 'closed',
                    filled_slots = GREATEST(COALESCE(filled_slots, 0), $2),
                    updated_at = NOW()
                WHERE opening_id = $1
                `,
                [row.opening_id, approvedCount]
            );

            throw new Error('No available slots left for this opening.');
        }

        const updateApplicationResult = await client.query(
            `
            UPDATE applications
            SET application_status = 'Approved',
                is_disqualified = FALSE,
                rejection_reason = NULL
            WHERE application_id = $1
            RETURNING *
            `,
            [applicationId]
        );

        const approvedApplication = updateApplicationResult.rows[0];

        const insertScholarResult = await client.query(
            `
            INSERT INTO scholars (
                student_id,
                program_id,
                application_id,
                academic_year_id,
                period_id,
                date_awarded,
                status,
                ro_progress,
                remarks,
                is_archived
            )
            VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'Active', 0, NULL, FALSE)
            RETURNING *
            `,
            [row.student_id, row.program_id, applicationId, row.academic_year_id, row.period_id]
        );

        const newApprovedCount = approvedCount + 1;
        const nextFilledSlots = newApprovedCount;
        const shouldFinalizeOpening = slotCount > 0 && newApprovedCount >= slotCount;

        await client.query(
            `
            UPDATE program_openings
            SET filled_slots = $2,
                posting_status = CASE
                    WHEN $3 = TRUE THEN 'closed'
                    ELSE posting_status
                END,
                updated_at = NOW()
            WHERE opening_id = $1
            `,
            [row.opening_id, nextFilledSlots, shouldFinalizeOpening]
        );

        await client.query('COMMIT');

        return {
            application: approvedApplication,
            scholar: insertScholarResult.rows[0],
            outcome: 'approved',
            notificationShouldSend: true,
            student_user_id: row.student_user_id || null,
            opening_auto_closed: shouldFinalizeOpening,
            opening_archived: false,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = {
    fetchApplications: exports.fetchApplications,
    fetchApplicationDetailsById: exports.fetchApplicationDetailsById,
    fetchApplicationDocumentsById: exports.fetchApplicationDocumentsById,
    runApplicationDocumentIotOcr: exports.runApplicationDocumentIotOcr,
    fetchApplicationDocumentOcrSnapshot: exports.fetchApplicationDocumentOcrSnapshot,
    saveApplicationDocumentOcrSnapshot: exports.saveApplicationDocumentOcrSnapshot,
    uploadStudentApplicationDocument: exports.uploadStudentApplicationDocument,
    markApplicationDisqualified: exports.markApplicationDisqualified,
    saveApplicationVerification: exports.saveApplicationVerification,
    markApplicationReviewed: exports.markApplicationReviewed,
    saveApplicationRemarks: exports.saveApplicationRemarks,
    assignApplicationProgram: exports.assignApplicationProgram,
    moveApplicationToWaiting: exports.moveApplicationToWaiting,
    approveApplicationWithSlotCheck: exports.approveApplicationWithSlotCheck,
    normalizeDocumentType,
    getDocumentTypeName: (documentKey) => DOCUMENT_TYPE_TO_NAME[documentKey] || null,
    normalizeOcrPayload,
};
