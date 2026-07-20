const crypto = require('crypto');
const supabase = require('../config/supabase');

const RENEWAL_DOCUMENTS_BUCKET =
    process.env.RENEWAL_DOCUMENTS_BUCKET || 'renewal-documents';

const REQUIRED_RENEWAL_DOCUMENTS = [
    {
        key: 'copy_of_grades',
        documentType: 'Copy of Grades',
        label: 'Copy of Grades',
    },
    {
        key: 'certificate_of_enrollment_registration',
        documentType: 'Certificate of Enrollment / Registration',
        label: 'Certificate of Enrollment / Registration',
    },
];

const APPROVED_APPLICATION_STATUSES = [
    'Approved',
    'Approved Scholar',
    'Accepted',
];

const SUPPORTED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
]);

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function cleanText(value) {
    return String(value || '').trim();
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function getUserId(user = {}) {
    return user?.userId || user?.user_id || user?.id || user?.sub || null;
}

function documentKeyFromType(value) {
    const normalized = normalizeText(value);

    if (
        normalized.includes('grade') ||
        normalized.includes('transcript')
    ) {
        return 'copy_of_grades';
    }

    if (
        normalized.includes('registration') ||
        normalized.includes('enrollment') ||
        normalized.includes('cor') ||
        normalized.includes('coe')
    ) {
        return 'certificate_of_enrollment_registration';
    }

    return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function getRequiredDocumentByKey(keyOrType) {
    const key = documentKeyFromType(keyOrType);

    return (
        REQUIRED_RENEWAL_DOCUMENTS.find((item) => item.key === key) ||
        REQUIRED_RENEWAL_DOCUMENTS.find(
            (item) => normalizeText(item.documentType) === normalizeText(keyOrType)
        ) ||
        null
    );
}

function getDocumentStatus(document = {}) {
    const reviewStatus = normalizeText(document.review_status);

    if (reviewStatus === 'verified') return 'verified';
    if (reviewStatus === 'rejected') return 'rejected';
    if (reviewStatus === 'flagged') return 'flagged';
    if (reviewStatus === 'uploaded') return 'uploaded';

    if (document.is_submitted && document.file_url) {
        return 'uploaded';
    }

    return 'pending';
}

function deriveDocumentStatus(documents = [], renewalStatus = 'Pending Submission') {
    const normalizedRenewalStatus = normalizeText(renewalStatus);
    const statuses = documents.map(getDocumentStatus);

    if (normalizedRenewalStatus === 'approved') return 'Documents Verified';
    if (normalizedRenewalStatus === 'rejected') return 'Rejected';
    if (normalizedRenewalStatus === 'flagged' || statuses.includes('flagged')) return 'Flagged';
    if (normalizedRenewalStatus === 'needs reupload' || statuses.includes('rejected')) return 'Needs Reupload';
    if (statuses.every((status) => status === 'verified')) return 'Documents Verified';
    if (statuses.every((status) => ['uploaded', 'verified'].includes(status))) return 'Documents Uploaded';

    return 'Missing Docs';
}

function detectMimeTypeFromFileName(originalName = '') {
    const name = String(originalName).trim().toLowerCase();

    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';

    return null;
}

function detectMimeTypeFromBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

    if (
        buffer.length >= 4 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
    ) {
        return 'application/pdf';
    }

    if (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return 'image/jpeg';
    }

    if (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
    ) {
        return 'image/png';
    }

    if (
        buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
    ) {
        return 'image/webp';
    }

    return null;
}

function normalizeMimeType(file = {}) {
    const rawMime = String(file.mimetype || '').trim().toLowerCase();

    if (SUPPORTED_MIME_TYPES.has(rawMime)) {
        return rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    }

    const mimeFromBuffer = detectMimeTypeFromBuffer(file.buffer);
    if (mimeFromBuffer) return mimeFromBuffer;

    const mimeFromName = detectMimeTypeFromFileName(file.originalname);
    if (mimeFromName) return mimeFromName;

    throw createHttpError(
        400,
        `Unsupported file type. Allowed files are PDF, JPG, JPEG, PNG, and WEBP. Received MIME: ${rawMime || 'unknown'}.`
    );
}

function extensionFromMimeType(mimeType) {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    return 'jpg';
}

function sanitizeFileName(fileName = '') {
    return String(fileName)
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 180);
}

function extractStoragePath(value, bucketName) {
    const rawValue = String(value || '').trim();

    if (!rawValue) return null;

    if (!/^https?:\/\//i.test(rawValue)) {
        return rawValue
            .replace(new RegExp(`^${bucketName}/`), '')
            .replace(/^\/+/, '');
    }

    const markers = [
        `/storage/v1/object/public/${bucketName}/`,
        `/storage/v1/object/sign/${bucketName}/`,
        `/storage/v1/object/authenticated/${bucketName}/`,
    ];

    for (const marker of markers) {
        const markerIndex = rawValue.indexOf(marker);

        if (markerIndex >= 0) {
            return rawValue.slice(markerIndex + marker.length).split('?')[0];
        }
    }

    return null;
}

async function resolveRenewalDocumentUrl(fileUrl, filePath) {
    const rawFileUrl = String(fileUrl || '').trim();
    const rawFilePath = String(filePath || '').trim();

    const storagePath =
        extractStoragePath(rawFilePath, RENEWAL_DOCUMENTS_BUCKET) ||
        extractStoragePath(rawFileUrl, RENEWAL_DOCUMENTS_BUCKET);

    if (!storagePath) {
        return rawFileUrl || null;
    }

    const { data, error } = await supabase.storage
        .from(RENEWAL_DOCUMENTS_BUCKET)
        .createSignedUrl(storagePath, 60 * 60);

    if (error) {
        return rawFileUrl || rawFilePath || null;
    }

    return data?.signedUrl || rawFileUrl || rawFilePath || null;
}

async function getStudentByUserId(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const { data, error } = await supabase
        .from('students')
        .select(`
      student_id,
      user_id,
      pdm_id,
      first_name,
      middle_name,
      last_name,
      is_active_scholar,
      current_application_id
    `)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    if (!data) {
        throw createHttpError(404, 'Student profile not found.');
    }

    if (data.is_active_scholar !== true) {
        throw createHttpError(
            403,
            'Renewal documents are only available for active scholars.'
        );
    }

    return data;
}

async function getLatestApprovedApplication(student) {
    let query = supabase
        .from('applications')
        .select(`
      application_id,
      student_id,
      program_id,
      opening_id,
      application_status,
      submission_date
    `)
        .eq('student_id', student.student_id)
        .in('application_status', APPROVED_APPLICATION_STATUSES)
        .order('submission_date', { ascending: false })
        .limit(1);

    if (student.current_application_id) {
        query = query.eq('application_id', student.current_application_id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    if (data) {
        return data;
    }

    const fallback = await supabase
        .from('applications')
        .select(`
      application_id,
      student_id,
      program_id,
      opening_id,
      application_status,
      submission_date
    `)
        .eq('student_id', student.student_id)
        .in('application_status', APPROVED_APPLICATION_STATUSES)
        .order('submission_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (fallback.error) {
        throw createHttpError(500, fallback.error.message);
    }

    return fallback.data || null;
}

async function getCurrentPeriod() {
    const { data, error } = await supabase
        .from('academic_period')
        .select('*');

    if (error) {
        throw createHttpError(500, error.message);
    }

    const periods = data || [];

    if (!periods.length) {
        throw createHttpError(
            400,
            'No academic period exists. Please create an academic period first.'
        );
    }

    const activePeriod =
        periods.find((period) => period.is_active === true) ||
        periods.sort((a, b) => {
            const aDate = new Date(a.created_at || 0).getTime();
            const bDate = new Date(b.created_at || 0).getTime();
            return bDate - aDate;
        })[0];

    return activePeriod;
}

async function getAcademicYearLabel(academicYearId) {
    if (!academicYearId) return '';

    const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('academic_year_id', academicYearId)
        .maybeSingle();

    if (error || !data) return '';

    return (
        data.label ||
        (data.start_year && data.end_year
            ? `${data.start_year}-${data.end_year}`
            : '')
    );
}

async function getProgram(programId) {
    if (!programId) return null;

    const { data, error } = await supabase
        .from('scholarship_program')
        .select('program_id, program_name, benefactor_id')
        .eq('program_id', programId)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    return data || null;
}

async function getBenefactor(benefactorId) {
    if (!benefactorId) return null;

    const { data, error } = await supabase
        .from('benefactors')
        .select('benefactor_id, benefactor_name')
        .eq('benefactor_id', benefactorId)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    return data || null;
}

async function getOrCreateCurrentRenewal(student) {
    const application = await getLatestApprovedApplication(student);
    const period = await getCurrentPeriod();

    const { data: existingRenewal, error: existingError } = await supabase
        .from('renewals')
        .select('*')
        .eq('student_id', student.student_id)
        .eq('period_id', period.period_id)
        .maybeSingle();

    if (existingError) {
        throw createHttpError(500, existingError.message);
    }

    if (existingRenewal) {
        return {
            renewal: existingRenewal,
            application,
            period,
        };
    }

    const now = new Date().toISOString();

    const insertPayload = {
        student_id: student.student_id,
        application_id: application?.application_id || null,
        program_id: application?.program_id || null,
        academic_year_id: period.academic_year_id || null,
        period_id: period.period_id,
        status: 'Pending Submission',
        submitted_on: null,
        created_at: now,
        updated_at: now,
    };

    const { data: renewal, error: insertError } = await supabase
        .from('renewals')
        .insert(insertPayload)
        .select()
        .single();

    if (insertError) {
        if (insertError.code === '23505') {
            const retry = await supabase
                .from('renewals')
                .select('*')
                .eq('student_id', student.student_id)
                .eq('period_id', period.period_id)
                .maybeSingle();

            if (retry.error) {
                throw createHttpError(500, retry.error.message);
            }

            if (retry.data) {
                return {
                    renewal: retry.data,
                    application,
                    period,
                };
            }
        }

        throw createHttpError(500, insertError.message);
    }

    return {
        renewal,
        application,
        period,
    };
}

async function ensureRenewalDocuments(renewalId) {
    const { data: existingDocuments, error } = await supabase
        .from('renewal_documents')
        .select('*')
        .eq('renewal_id', renewalId);

    if (error) {
        throw createHttpError(500, error.message);
    }

    const byKey = new Map();

    for (const document of existingDocuments || []) {
        byKey.set(documentKeyFromType(document.document_type), document);
    }

    const missingDocuments = REQUIRED_RENEWAL_DOCUMENTS
        .filter((requiredDocument) => !byKey.has(requiredDocument.key))
        .map((requiredDocument) => ({
            renewal_id: renewalId,
            document_type: requiredDocument.documentType,
            is_submitted: false,
            review_status: 'pending',
            admin_comment: null,
            submitted_at: null,
            reviewed_at: null,
            remarks: null,
        }));

    if (missingDocuments.length) {
        const { error: insertError } = await supabase
            .from('renewal_documents')
            .insert(missingDocuments);

        if (insertError && insertError.code !== '23505') {
            throw createHttpError(500, insertError.message);
        }
    }

    const { data: finalDocuments, error: finalError } = await supabase
        .from('renewal_documents')
        .select('*')
        .eq('renewal_id', renewalId)
        .order('document_type', { ascending: true });

    if (finalError) {
        throw createHttpError(500, finalError.message);
    }

    const finalByKey = new Map();

    for (const document of finalDocuments || []) {
        finalByKey.set(documentKeyFromType(document.document_type), document);
    }

    return REQUIRED_RENEWAL_DOCUMENTS.map((requiredDocument) => {
        return (
            finalByKey.get(requiredDocument.key) || {
                renewal_document_id: null,
                renewal_id: renewalId,
                document_type: requiredDocument.documentType,
                is_submitted: false,
                file_url: null,
                file_path: null,
                file_name: null,
                mime_type: null,
                file_size_bytes: null,
                review_status: 'pending',
                admin_comment: '',
                submitted_at: null,
                reviewed_at: null,
                remarks: null,
            }
        );
    });
}

async function serializeDocument(document = {}) {
    const required = getRequiredDocumentByKey(document.document_type);
    const key = required?.key || documentKeyFromType(document.document_type);
    const resolvedUrl = await resolveRenewalDocumentUrl(
        document.file_url,
        document.file_path
    );

    return {
        id: document.renewal_document_id || key,
        renewal_document_id: document.renewal_document_id || null,
        route_param: key,
        document_type: required?.documentType || document.document_type,
        is_submitted: document.is_submitted === true,
        file_url: resolvedUrl,
        file_path: document.file_path || null,
        file_name: document.file_name || null,
        mime_type: document.mime_type || null,
        file_size_bytes: document.file_size_bytes || null,
        status: getDocumentStatus(document),
        review_status: document.review_status || 'pending',
        admin_comment: document.admin_comment || '',
        submitted_at: document.submitted_at || null,
        reviewed_at: document.reviewed_at || null,
        remarks: document.remarks || null,
    };
}

async function buildRenewalPackage(userId) {
    const student = await getStudentByUserId(userId);
    const { renewal, period } = await getOrCreateCurrentRenewal(student);
    const documents = await ensureRenewalDocuments(renewal.renewal_id);
    const program = await getProgram(renewal.program_id);
    const benefactor = await getBenefactor(program?.benefactor_id);
    const schoolYearLabel = await getAcademicYearLabel(
        renewal.academic_year_id || period.academic_year_id
    );

    const semesterLabel =
        period.semester ||
        period.term ||
        period.current_semester ||
        'Current Period';

    const documentStatus = deriveDocumentStatus(documents, renewal.status);
    const serializedDocuments = await Promise.all(
        documents.map(serializeDocument)
    );

    return {
        renewal: {
            renewal_id: renewal.renewal_id,
            scholar_id: '',
            student_id: renewal.student_id,
            program_id: renewal.program_id || '',
            semester_label: semesterLabel,
            school_year_label: schoolYearLabel,
            renewal_status: renewal.status || 'Pending Submission',
            document_status: documentStatus,
            admin_comment:
                renewal.decision_reason ||
                renewal.flagged_reason ||
                '',
            submitted_at: renewal.submitted_on || null,
            reviewed_at: renewal.reviewed_at || null,
        },

        scholar: {
            program_id: program?.program_id || '',
            program_name: program?.program_name || 'Scholarship Program',
            benefactor_name: benefactor?.benefactor_name || null,
        },

        student: {
            student_id: student.student_id,
            name:
                [student.first_name, student.middle_name, student.last_name]
                    .filter(Boolean)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim() || 'Scholar',
            pdm_id: student.pdm_id || '',
        },

        cycle: {
            period_id: period.period_id,
            semester_label: semesterLabel,
            school_year_label: schoolYearLabel,
        },

        documents: serializedDocuments,
    };
}

async function removeStorageObjectQuietly(filePath) {
    if (!filePath) return;

    try {
        const { error } = await supabase.storage
            .from(RENEWAL_DOCUMENTS_BUCKET)
            .remove([filePath]);

        if (error) {
            console.error('RENEWAL FILE CLEANUP ERROR:', error.message);
        }
    } catch (error) {
        console.error('RENEWAL FILE CLEANUP ERROR:', error.message);
    }
}

exports.fetchCurrentRenewal = async (userId) => {
    return buildRenewalPackage(userId);
};

exports.uploadDocument = async ({
    userId,
    routeParam,
    file,
}) => {
    if (
        !file ||
        !Buffer.isBuffer(file.buffer) ||
        file.buffer.length === 0
    ) {
        throw createHttpError(400, 'Please attach a renewal document.');
    }

    const requiredDocument = getRequiredDocumentByKey(routeParam);

    if (!requiredDocument) {
        throw createHttpError(400, 'Invalid renewal document type.');
    }

    const student = await getStudentByUserId(userId);
    const { renewal } = await getOrCreateCurrentRenewal(student);

    if (
        ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Flagged'].includes(
            renewal.status
        )
    ) {
        throw createHttpError(
            400,
            'This renewal package is locked and cannot accept uploads right now.'
        );
    }

    await ensureRenewalDocuments(renewal.renewal_id);

    const mimeType = normalizeMimeType(file);
    const extension = extensionFromMimeType(mimeType);
    const safeOriginalName = sanitizeFileName(file.originalname || '');
    const random = crypto.randomBytes(8).toString('hex');

    const fileName =
        safeOriginalName &&
            /\.(pdf|jpg|jpeg|png|webp)$/i.test(safeOriginalName)
            ? safeOriginalName
            : `${requiredDocument.key}-${Date.now()}.${extension}`;

    const filePath = [
        String(student.student_id),
        String(renewal.renewal_id),
        `${requiredDocument.key}-${Date.now()}-${random}.${extension}`,
    ].join('/');

    const { error: uploadError } = await supabase.storage
        .from(RENEWAL_DOCUMENTS_BUCKET)
        .upload(filePath, file.buffer, {
            contentType: mimeType,
            upsert: false,
            cacheControl: '3600',
        });

    if (uploadError) {
        throw createHttpError(
            500,
            `Failed to upload renewal document: ${uploadError.message}`
        );
    }

    const publicUrlResult = supabase.storage
        .from(RENEWAL_DOCUMENTS_BUCKET)
        .getPublicUrl(filePath);

    const fileUrl = publicUrlResult?.data?.publicUrl || filePath;
    const now = new Date().toISOString();

    const { data: oldDocument } = await supabase
        .from('renewal_documents')
        .select('renewal_document_id, file_path')
        .eq('renewal_id', renewal.renewal_id)
        .eq('document_type', requiredDocument.documentType)
        .maybeSingle();

    const updatePayload = {
        renewal_id: renewal.renewal_id,
        document_type: requiredDocument.documentType,
        file_url: fileUrl,
        file_path: filePath,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: file.size || file.buffer.length,
        is_submitted: true,
        review_status: 'uploaded',
        admin_comment: null,
        submitted_at: now,
        reviewed_at: null,
        remarks: null,
        updated_at: now,
    };

    const { error: upsertError } = await supabase
        .from('renewal_documents')
        .upsert(updatePayload, {
            onConflict: 'renewal_id,document_type',
        });

    if (upsertError) {
        await removeStorageObjectQuietly(filePath);
        throw createHttpError(500, upsertError.message);
    }

    if (oldDocument?.file_path && oldDocument.file_path !== filePath) {
        await removeStorageObjectQuietly(oldDocument.file_path);
    }

    await supabase
        .from('renewals')
        .update({
            status: 'Pending Submission',
            reviewed_at: null,
            reviewed_by: null,
            decision_reason: null,
            flagged_reason: null,
            updated_at: now,
        })
        .eq('renewal_id', renewal.renewal_id);

    return buildRenewalPackage(userId);
};

exports.submitRenewal = async (userId) => {
    const student = await getStudentByUserId(userId);
    const { renewal } = await getOrCreateCurrentRenewal(student);
    const documents = await ensureRenewalDocuments(renewal.renewal_id);

    if (
        ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Flagged'].includes(
            renewal.status
        )
    ) {
        throw createHttpError(
            400,
            'This renewal package is already submitted or locked.'
        );
    }

    const missingDocuments = documents.filter((document) => {
        return !document.is_submitted || !document.file_url;
    });

    if (missingDocuments.length) {
        throw createHttpError(
            400,
            'Please upload both required renewal documents before submitting.'
        );
    }

    const now = new Date().toISOString();

    const { error } = await supabase
        .from('renewals')
        .update({
            status: 'Submitted',
            submitted_on: now,
            updated_at: now,
        })
        .eq('renewal_id', renewal.renewal_id);

    if (error) {
        throw createHttpError(500, error.message);
    }

    return buildRenewalPackage(userId);
};