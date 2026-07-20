const supabase = require('../config/supabase');
const notificationService = require('./notificationService');

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

function fullName(student = {}) {
    return [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildInitials(student = {}) {
    const first = String(student.first_name || '').trim();
    const last = String(student.last_name || '').trim();

    return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'NA';
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

    if (document.is_submitted === true && document.file_url) {
        return 'uploaded';
    }

    return 'pending';
}

function deriveDocumentStatus(documents = [], renewalStatus = 'Pending Submission') {
    const normalizedRenewalStatus = normalizeText(renewalStatus);
    const statuses = documents.map(getDocumentStatus);

    if (normalizedRenewalStatus === 'approved') {
        return 'Documents Verified';
    }

    if (
        normalizedRenewalStatus === 'rejected' ||
        normalizedRenewalStatus === 'failed'
    ) {
        return 'Rejected';
    }

    if (
        normalizedRenewalStatus === 'flagged' ||
        statuses.includes('flagged')
    ) {
        return 'Flagged';
    }

    if (
        normalizedRenewalStatus === 'needs reupload' ||
        statuses.includes('rejected')
    ) {
        return 'Needs Reupload';
    }

    if (
        statuses.length > 0 &&
        statuses.every((status) => status === 'verified')
    ) {
        return 'Documents Verified';
    }

    if (
        statuses.length > 0 &&
        statuses.every((status) => ['uploaded', 'verified'].includes(status))
    ) {
        return 'Documents Uploaded';
    }

    return 'Missing Docs';
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
        console.error('RENEWAL DOCUMENT SIGNED URL ERROR:', error.message);
        return rawFileUrl || rawFilePath || null;
    }

    return data?.signedUrl || rawFileUrl || rawFilePath || null;
}

async function getRowsByIds(tableName, idColumn, ids = [], select = '*') {
    const uniqueIds = [...new Set(ids.filter(Boolean))];

    if (!uniqueIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from(tableName)
        .select(select)
        .in(idColumn, uniqueIds);

    if (error) {
        throw createHttpError(500, error.message);
    }

    return data || [];
}

function mapBy(rows = [], key) {
    return new Map(rows.map((row) => [row[key], row]));
}

async function loadRenewalDocuments(renewalIds = []) {
    const ids = [...new Set(renewalIds.filter(Boolean))];

    if (!ids.length) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('renewal_documents')
        .select('*')
        .in('renewal_id', ids)
        .order('document_type', { ascending: true });

    if (error) {
        throw createHttpError(500, error.message);
    }

    const map = new Map();

    for (const document of data || []) {
        const current = map.get(document.renewal_id) || [];
        current.push(document);
        map.set(document.renewal_id, current);
    }

    return map;
}

async function getAcademicPeriodMap(periodIds = []) {
    const rows = await getRowsByIds(
        'academic_period',
        'period_id',
        periodIds,
        '*'
    );

    const yearIds = [
        ...new Set(rows.map((row) => row.academic_year_id).filter(Boolean)),
    ];

    const academicYears = await getRowsByIds(
        'academic_years',
        'academic_year_id',
        yearIds,
        '*'
    );

    const yearMap = mapBy(academicYears, 'academic_year_id');
    const result = new Map();

    for (const period of rows) {
        const academicYear = yearMap.get(period.academic_year_id) || {};

        const schoolYearLabel =
            academicYear.label ||
            (
                academicYear.start_year && academicYear.end_year
                    ? `${academicYear.start_year}-${academicYear.end_year}`
                    : ''
            );

        result.set(period.period_id, {
            ...period,
            semester_label:
                period.semester ||
                period.term ||
                period.current_semester ||
                'Current Period',
            school_year_label:
                schoolYearLabel ||
                period.current_academic_year ||
                '',
        });
    }

    return result;
}

function ensureDocumentCoverage(documents = []) {
    const byKey = new Map();

    for (const document of documents) {
        byKey.set(documentKeyFromType(document.document_type), document);
    }

    return REQUIRED_RENEWAL_DOCUMENTS.map((requiredDocument) => {
        const existing = byKey.get(requiredDocument.key);

        if (existing) {
            return existing;
        }

        return {
            renewal_document_id: null,
            renewal_id: null,
            document_type: requiredDocument.documentType,
            file_url: null,
            file_path: null,
            file_name: null,
            mime_type: null,
            file_size_bytes: null,
            is_submitted: false,
            review_status: 'pending',
            admin_comment: '',
            submitted_at: null,
            reviewed_at: null,
            remarks: null,
            created_at: null,
            updated_at: null,
        };
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
        renewalDocumentId: document.renewal_document_id || null,

        document_key: key,
        documentKey: key,
        route_param: key,
        routeParam: key,

        name: required?.label || document.document_type,
        document_type: required?.documentType || document.document_type,
        documentType: required?.documentType || document.document_type,

        url: resolvedUrl,
        file_url: resolvedUrl,
        fileUrl: resolvedUrl,

        file_path: document.file_path || null,
        filePath: document.file_path || null,

        file_name: document.file_name || null,
        fileName: document.file_name || null,

        mime_type: document.mime_type || null,
        mimeType: document.mime_type || null,

        file_size_bytes: document.file_size_bytes || null,
        fileSizeBytes: document.file_size_bytes || null,

        status: getDocumentStatus(document),

        review_status: document.review_status || 'pending',
        reviewStatus: document.review_status || 'pending',

        is_submitted: document.is_submitted === true,
        isSubmitted: document.is_submitted === true,

        admin_comment: document.admin_comment || '',
        adminComment: document.admin_comment || '',

        submitted_at: document.submitted_at || null,
        submittedAt: document.submitted_at || null,

        reviewed_at: document.reviewed_at || null,
        reviewedAt: document.reviewed_at || null,

        remarks: document.remarks || null,
    };
}

async function sendRenewalNotification({
    studentId,
    renewal,
    type,
    title,
    message,
}) {
    try {
        if (typeof notificationService?.createUserNotification !== 'function') {
            return null;
        }

        const { data: student, error } = await supabase
            .from('students')
            .select('student_id, user_id')
            .eq('student_id', studentId)
            .maybeSingle();

        if (error || !student?.user_id) {
            return null;
        }

        return await notificationService.createUserNotification({
            userId: student.user_id,
            type,
            title,
            message,
            referenceId: renewal?.renewal_id || null,
            referenceType: 'renewal',
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('RENEWAL NOTIFICATION ERROR:', error.message);
        return null;
    }
}

async function tryUpdateStudentScholarshipStatus(studentId, scholarshipStatus) {
    if (!studentId || !scholarshipStatus) return;

    try {
        const { error } = await supabase
            .from('students')
            .update({
                scholarship_status: scholarshipStatus,
            })
            .eq('student_id', studentId);

        if (error) {
            console.error('UPDATE STUDENT SCHOLARSHIP STATUS ERROR:', error.message);
        }
    } catch (error) {
        console.error('UPDATE STUDENT SCHOLARSHIP STATUS ERROR:', error.message);
    }
}

exports.fetchRenewals = async () => {
    const { data: renewals, error } = await supabase
        .from('renewals')
        .select('*')
        .order('submitted_on', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (error) {
        throw createHttpError(500, error.message);
    }

    const renewalRows = renewals || [];

    if (!renewalRows.length) {
        return [];
    }

    const studentIds = renewalRows.map((row) => row.student_id).filter(Boolean);
    const programIds = renewalRows.map((row) => row.program_id).filter(Boolean);
    const periodIds = renewalRows.map((row) => row.period_id).filter(Boolean);
    const renewalIds = renewalRows.map((row) => row.renewal_id).filter(Boolean);

    const [students, programs, periodMap, documentsMap] = await Promise.all([
        getRowsByIds(
            'students',
            'student_id',
            studentIds,
            `
        student_id,
        user_id,
        pdm_id,
        first_name,
        middle_name,
        last_name,
        year_level,
        course_id,
        profile_photo_url,
        is_active_scholar
      `
        ),

        getRowsByIds(
            'scholarship_program',
            'program_id',
            programIds,
            'program_id, program_name, benefactor_id'
        ),

        getAcademicPeriodMap(periodIds),

        loadRenewalDocuments(renewalIds),
    ]);

    const studentMap = mapBy(students, 'student_id');
    const programMap = mapBy(programs, 'program_id');

    const benefactorIds = [
        ...new Set(programs.map((program) => program.benefactor_id).filter(Boolean)),
    ];

    const benefactors = await getRowsByIds(
        'benefactors',
        'benefactor_id',
        benefactorIds,
        'benefactor_id, benefactor_name'
    );

    const benefactorMap = mapBy(benefactors, 'benefactor_id');

    return renewalRows.map((renewal) => {
        const student = studentMap.get(renewal.student_id) || {};
        const program = programMap.get(renewal.program_id) || {};
        const benefactor = benefactorMap.get(program.benefactor_id) || {};
        const period = periodMap.get(renewal.period_id) || {};
        const documents = ensureDocumentCoverage(
            documentsMap.get(renewal.renewal_id) || []
        );

        return {
            id: renewal.renewal_id,
            renewal_id: renewal.renewal_id,

            student_id: renewal.student_id,
            program_id: renewal.program_id,
            application_id: renewal.application_id,
            academic_year_id: renewal.academic_year_id,
            period_id: renewal.period_id,

            semester_label: period.semester_label || 'Current Period',
            school_year_label: period.school_year_label || '',

            renewal_status: renewal.status,
            document_status: deriveDocumentStatus(documents, renewal.status),

            submitted_at: renewal.submitted_on,
            reviewed_at: renewal.reviewed_at || null,
            deadline_date: renewal.deadline_date || null,

            student_name: fullName(student) || 'Unknown Scholar',
            student_number: student.pdm_id || 'N/A',

            program_name: program.program_name || 'Scholarship Program',
            benefactor_name: benefactor.benefactor_name || 'N/A',
        };
    });
};

exports.fetchRenewalDetailsById = async (renewalId) => {
    const { data: renewal, error } = await supabase
        .from('renewals')
        .select('*')
        .eq('renewal_id', renewalId)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    if (!renewal) {
        throw createHttpError(404, 'Renewal record not found.');
    }

    const [students, programs, periodMap, documentMap] = await Promise.all([
        getRowsByIds(
            'students',
            'student_id',
            [renewal.student_id],
            `
        student_id,
        user_id,
        pdm_id,
        first_name,
        middle_name,
        last_name,
        year_level,
        gwa,
        course_id,
        profile_photo_url,
        is_active_scholar
      `
        ),

        getRowsByIds(
            'scholarship_program',
            'program_id',
            [renewal.program_id],
            'program_id, program_name, benefactor_id'
        ),

        getAcademicPeriodMap([renewal.period_id]),

        loadRenewalDocuments([renewal.renewal_id]),
    ]);

    const student = students[0] || {};
    const program = programs[0] || {};
    const period = periodMap.get(renewal.period_id) || {};
    const documents = ensureDocumentCoverage(
        documentMap.get(renewal.renewal_id) || []
    );

    let userContact = {
        email: 'N/A',
        phone_number: 'N/A',
    };

    if (student.user_id) {
        const { data: userRow, error: userError } = await supabase
            .from('users')
            .select('email, phone_number')
            .eq('user_id', student.user_id)
            .maybeSingle();

        if (userError) {
            throw createHttpError(500, userError.message);
        }

        if (userRow) {
            userContact = userRow;
        }
    }

    const benefactors = await getRowsByIds(
        'benefactors',
        'benefactor_id',
        [program.benefactor_id].filter(Boolean),
        'benefactor_id, benefactor_name'
    );

    const benefactor = benefactors[0] || {};

    const serializedDocuments = await Promise.all(
        documents.map(serializeDocument)
    );

    const documentStatus = deriveDocumentStatus(documents, renewal.status);

    return {
        id: renewal.renewal_id,

        renewal: {
            renewal_id: renewal.renewal_id,

            student_id: renewal.student_id,
            program_id: renewal.program_id,
            application_id: renewal.application_id,
            academic_year_id: renewal.academic_year_id,
            period_id: renewal.period_id,

            semester_label: period.semester_label || '',
            school_year_label: period.school_year_label || '',

            renewal_status: renewal.status,
            document_status: documentStatus,

            submitted_at: renewal.submitted_on || null,
            reviewed_at: renewal.reviewed_at || null,
            deadline_date: renewal.deadline_date || null,

            admin_comment:
                renewal.decision_reason ||
                renewal.flagged_reason ||
                '',
            decision_reason: renewal.decision_reason || '',
            flagged_reason: renewal.flagged_reason || '',
        },

        renewal_status: renewal.status,
        document_status: documentStatus,

        scholar: {
            program_id: program.program_id || null,
            program_name: program.program_name || 'Scholarship Program',
            benefactor_name: benefactor.benefactor_name || 'N/A',
            status: student.is_active_scholar ? 'Active' : 'Inactive',
        },

        student: {
            student_id: student.student_id || null,
            name: fullName(student) || 'Unknown Scholar',
            initials: buildInitials(student),
            pdm_id: student.pdm_id || 'N/A',
            email: userContact.email || 'N/A',
            phone: userContact.phone_number || 'N/A',
            year: student.year_level ? `${student.year_level} Year` : 'Scholar',
            gwa: student.gwa ?? 'N/A',
            program: program.program_name || 'Scholarship Program',
            benefactor_name: benefactor.benefactor_name || 'N/A',
        },

        documents: serializedDocuments,
    };
};

exports.saveRenewalReview = async (renewalId, payload = {}, user = {}) => {
    const {
        document_reviews = [],
        final_action = 'under_review',
        final_comment = '',
    } = payload || {};

    if (!Array.isArray(document_reviews)) {
        throw createHttpError(400, 'document_reviews must be an array.');
    }

    const { data: renewal, error: renewalError } = await supabase
        .from('renewals')
        .select('*')
        .eq('renewal_id', renewalId)
        .maybeSingle();

    if (renewalError) {
        throw createHttpError(500, renewalError.message);
    }

    if (!renewal) {
        throw createHttpError(404, 'Renewal record not found.');
    }

    const reviewedAt = new Date().toISOString();
    const adminUserId = getUserId(user);

    for (const documentReview of document_reviews) {
        const requiredDocument = getRequiredDocumentByKey(
            documentReview.document_type ||
            documentReview.documentType ||
            documentReview.name ||
            documentReview.document_key ||
            documentReview.documentKey
        );

        if (!requiredDocument) {
            continue;
        }

        const nextStatusRaw = normalizeText(
            documentReview.status || documentReview.review_status || documentReview.reviewStatus
        );

        let reviewStatus = 'pending';

        if (nextStatusRaw === 'verified') {
            reviewStatus = 'verified';
        } else if (nextStatusRaw === 'rejected') {
            reviewStatus = 'rejected';
        } else if (nextStatusRaw === 'flagged') {
            reviewStatus = 'flagged';
        } else if (nextStatusRaw === 'uploaded') {
            reviewStatus = 'uploaded';
        }

        const { error: documentUpdateError } = await supabase
            .from('renewal_documents')
            .update({
                review_status: reviewStatus,
                admin_comment:
                    cleanText(
                        documentReview.comment ||
                        documentReview.admin_comment ||
                        documentReview.adminComment
                    ) || null,
                reviewed_at: reviewedAt,
            })
            .eq('renewal_id', renewalId)
            .eq('document_type', requiredDocument.documentType);

        if (documentUpdateError) {
            throw createHttpError(500, documentUpdateError.message);
        }
    }

    const { data: refreshedDocuments, error: documentsError } = await supabase
        .from('renewal_documents')
        .select('*')
        .eq('renewal_id', renewalId);

    if (documentsError) {
        throw createHttpError(500, documentsError.message);
    }

    const coveredDocuments = ensureDocumentCoverage(refreshedDocuments || []);

    const allVerified = coveredDocuments.every(
        (document) => getDocumentStatus(document) === 'verified'
    );

    const action = normalizeText(final_action);
    const comment = cleanText(final_comment);

    const renewalUpdate = {
        reviewed_at: reviewedAt,
        reviewed_by: adminUserId,
        updated_at: reviewedAt,
    };

    let notificationTitle = '';
    let notificationMessage = '';
    let notificationType = 'Renewal Update';

    if (action === 'approve') {
        if (!allVerified) {
            throw createHttpError(
                400,
                'Both renewal documents must be verified before renewing the scholar.'
            );
        }

        renewalUpdate.status = 'Approved';
        renewalUpdate.decision_reason = comment || 'Renewal approved.';
        renewalUpdate.flagged_reason = null;

        await tryUpdateStudentScholarshipStatus(renewal.student_id, 'Renewed');

        notificationType = 'Renewal Approved';
        notificationTitle = 'Renewal Approved';
        notificationMessage =
            'Your scholarship renewal has been approved. Your scholar status is renewed for the current period.';
    } else if (action === 'reject') {
        renewalUpdate.status = 'Rejected';
        renewalUpdate.decision_reason = comment || 'Renewal rejected.';
        renewalUpdate.flagged_reason = null;

        await tryUpdateStudentScholarshipStatus(renewal.student_id, 'Not Renewed');

        notificationType = 'Renewal Rejected';
        notificationTitle = 'Renewal Rejected';
        notificationMessage =
            comment ||
            'Your scholarship renewal was rejected. Please contact OSFA for clarification.';
    } else if (action === 'flag') {
        renewalUpdate.status = 'Flagged';
        renewalUpdate.flagged_reason = comment || 'Renewal flagged for further review.';
        renewalUpdate.decision_reason = null;

        notificationType = 'Renewal Flagged';
        notificationTitle = 'Renewal Flagged';
        notificationMessage =
            comment ||
            'Your scholarship renewal has been flagged for further review.';
    } else if (action === 'reupload') {
        renewalUpdate.status = 'Needs Reupload';
        renewalUpdate.decision_reason =
            comment ||
            'One or more renewal documents must be replaced and resubmitted.';
        renewalUpdate.flagged_reason = null;

        notificationType = 'Renewal Reupload Required';
        notificationTitle = 'Renewal Requires Re-upload';
        notificationMessage =
            comment ||
            'Please replace the rejected renewal document and submit your renewal again.';
    } else {
        renewalUpdate.status = 'Under Review';
        renewalUpdate.decision_reason = comment || null;

        notificationType = 'Renewal Under Review';
        notificationTitle = 'Renewal Under Review';
        notificationMessage =
            'Your scholarship renewal documents are now under admin review.';
    }

    const { data: updatedRenewal, error: updateError } = await supabase
        .from('renewals')
        .update(renewalUpdate)
        .eq('renewal_id', renewalId)
        .select()
        .single();

    if (updateError) {
        throw createHttpError(500, updateError.message);
    }

    const notification = await sendRenewalNotification({
        studentId: renewal.student_id,
        renewal: updatedRenewal,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
    });

    return {
        renewal: updatedRenewal,
        documents: refreshedDocuments || [],
        notification,
    };
};