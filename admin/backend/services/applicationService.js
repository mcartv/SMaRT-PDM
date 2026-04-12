const path = require('path');
const supabase = require('../config/supabase');
const pool = require('../config/db');
const _ = require('lodash');

const STORAGE_BUCKET =
    process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET || 'application-documents';

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
        id: 'letter_of_intent',
        name: 'Letter of Intent',
        aliases: ['letter of intent', 'intent letter', 'loi'],
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

    loi: 'letter_of_intent',
    letter_of_intent: 'letter_of_intent',

    application_form: 'application_form',
    application: 'application_form',
};

const DOCUMENT_TYPE_TO_NAME = {
    certificate_of_registration: 'Certificate of Registration',
    student_grade_forms: 'Grade Form',
    certificate_of_indigency: 'Certificate of Indigency',
    letter_of_intent: 'Letter of Intent',
    application_form: 'Application Form',
};

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
    if (preferredStatus === 'flagged') return 'flagged';
    if (preferredStatus === 'uploaded' || preferredStatus === 'under review') return 'uploaded';

    return document.is_submitted || document.file_path || document.file_url ? 'uploaded' : 'pending';
}

function deriveAggregateDocumentStatus(summary = {}) {
    const verifiedCount = Number(summary?.verified || 0);
    const uploadedCount = Number(summary?.uploaded || 0);
    const flaggedCount = Number(summary?.flagged || 0);
    const reuploadCount = Number(summary?.reupload || 0);
    const pendingCount = Number(summary?.pending || 0);

    if (uploadedCount === 0) return 'Missing Docs';
    if (pendingCount > 0) return 'Under Review';
    if (reuploadCount > 0 || flaggedCount > 0) return 'Under Review';
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
            disqualification_reason,
            is_reconsideration_candidate,
            evaluator_id,
            students (
                user_id,
                first_name,
                middle_name,
                last_name,
                pdm_id,
                gwa,
                year_level,
                course_id,
                barangay
            ),
            scholarship_program (
                program_id,
                benefactor_id,
                program_name,
                benefactors (
                    benefactor_id,
                    benefactor_name,
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
            .select('scholar_id')
            .eq('student_id', applicationRecord.student_id)
            .maybeSingle();

        if (scholarCheckError) {
            console.error('Supabase Scholar Check Error:', scholarCheckError);
            throw new Error(scholarCheckError.message);
        }

        if (existingScholar) {
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
    ]);

    const resultErrors = [
        profileResult.error,
        familyMembersResult.error,
        educationRecordsResult.error,
        documentsResult.error,
        reviewsResult.error,
    ].filter(Boolean);

    if (resultErrors.length > 0) {
        console.error('Supabase Application Detail Relation Error:', resultErrors[0]);
        throw new Error(resultErrors[0].message);
    }

    const student = applicationRecord.students || {};
    const scholarshipProgram = applicationRecord.scholarship_program || {};
    const benefactor = scholarshipProgram.benefactors || {};

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

    const rawDocuments = documentsResult.data || [];

    const normalizedDocuments = await Promise.all(
        rawDocuments.map(async (document) => {
            const documentKey = inferDocumentKey(document);
            const review = reviewByKey.get(documentKey) || null;
            const filePath = document.file_path || null;
            const signedUrl = filePath ? await getSignedFileUrl(filePath) : null;

            return {
                id: documentKey,
                document_key: documentKey,
                name: DOCUMENT_TYPE_TO_NAME[documentKey] || document.document_type || 'Document',
                document_type: document.document_type || null,
                file_name: document.file_name || null,
                file_path: filePath,
                url: signedUrl || null,
                file_url: signedUrl || null,
                signed_url: signedUrl || null,
                status: deriveReviewStatus(document, review),
                admin_comment: review?.admin_comment || document.notes || '',
                notes: document.notes || null,
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
            disqualification_reason: applicationRecord.disqualification_reason || null,
            is_reconsideration_candidate: !!applicationRecord.is_reconsideration_candidate,
            evaluator_id: applicationRecord.evaluator_id || null,
        },
        application_status: applicationRecord.application_status,
        document_status: applicationRecord.document_status,
        submitted: applicationRecord.submission_date,
        disqualified: !!applicationRecord.is_disqualified,
        disqualification_reason: applicationRecord.disqualification_reason || null,
        is_reconsideration_candidate: !!applicationRecord.is_reconsideration_candidate,
        student: {
            name:
                `${student.first_name || ''} ${student.last_name || ''}`.trim() ||
                'Unknown Student',
            initials:
                `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() ||
                'NA',
            pdm_id: student.pdm_id || 'N/A',
            email: userContact.email || 'N/A',
            phone: userContact.phone_number || 'N/A',
            year: student.year_level
                ? `${student.year_level}${getOrdinalSuffix(student.year_level)} Year`
                : 'N/A',
            gwa: student.gwa ?? 'N/A',
            program: scholarshipProgram.program_name || 'General',
            benefactor_name:
                benefactor.benefactor_name ||
                benefactor.benefactor_name ||
                'N/A',
            course: courseCode,
        },
        student_profile: profileResult.data || null,
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
            a.disqualification_reason,
            a.document_status,
            a.verification_status,
            a.remarks,
            a.is_reconsideration_candidate,
            a.reconsideration_tagged_at,
            a.is_archived,

            st.first_name,
            st.last_name,
            st.pdm_id,
            st.gwa,
            st.sdo_status,

            po.opening_title,
            po.semester,
            po.academic_year,
            po.allocated_slots,
            po.filled_slots,
            po.financial_allocation,
            po.per_scholar_amount,
            po.posting_status,

            sp.program_name

        FROM applications a
        LEFT JOIN students st
            ON a.student_id = st.student_id
        LEFT JOIN program_openings po
            ON a.opening_id = po.opening_id
        LEFT JOIN scholarship_program sp
            ON a.program_id = sp.program_id
        LEFT JOIN scholars sc
            ON a.student_id = sc.student_id

        WHERE
            COALESCE(a.is_archived, FALSE) = FALSE
            AND sc.student_id IS NULL
            AND COALESCE(a.is_disqualified, FALSE) = FALSE
            AND LOWER(COALESCE(a.application_status, '')) NOT IN ('approved', 'qualified', 'accepted')

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

            application_status: row.application_status || 'Pending',
            status: row.application_status || 'Pending',

            document_status: row.document_status || 'Missing Docs',
            verification_status: row.verification_status || null,
            remarks: row.remarks || null,

            is_disqualified: !!row.is_disqualified,
            disqualification_reason: row.disqualification_reason || null,
            is_reconsideration_candidate: !!row.is_reconsideration_candidate,
            reconsideration_tagged_at: row.reconsideration_tagged_at || null,

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

    const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
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
        file_url: null,
        is_submitted: true,
        submitted_at: now,
        notes: null,
        uploaded_by: studentRecord.student_id,
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

exports.markApplicationDisqualified = async (
    id,
    reason,
    isReconsiderationCandidate = false
) => {
    const { data, error } = await supabase
        .from('applications')
        .update({
            is_disqualified: true,
            disqualification_reason: reason,
            is_reconsideration_candidate: !!isReconsiderationCandidate,
            application_status: 'Disqualified',
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
                file_url: null,
                submitted_at: doc.url ? reviewedAt : null,
                notes: doc.comment || null,
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
        applicationUpdatePayload.application_status = 'Requires_Reupload';
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

    return {
        application: updatedApplication,
        summary: {
            verified: Number(summary?.verified || 0),
            uploaded: Number(summary?.uploaded || 0),
            flagged: Number(summary?.flagged || 0),
            reupload: Number(summary?.reupload || 0),
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
            application_status: 'Review',
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

exports.moveApplicationToWaiting = async (applicationId) => {
    const { data, error } = await supabase
        .from('applications')
        .update({
            application_status: 'Waiting',
            is_reconsideration_candidate: true,
        })
        .eq('application_id', applicationId)
        .select()
        .single();

    if (error) {
        console.error('Supabase Move To Waiting Error:', error);
        throw new Error(error.message);
    }

    return data;
};

exports.approveApplicationWithSlotCheck = async (applicationId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const applicationQuery = `
            SELECT
                a.application_id,
                a.opening_id,
                a.application_status,
                po.allocated_slots,
                po.filled_slots,
                po.posting_status,
                COUNT(a2.application_id) FILTER (
                    WHERE LOWER(COALESCE(a2.application_status, '')) = 'qualified'
                )::int AS qualified_count
            FROM applications a
            INNER JOIN program_openings po
                ON po.opening_id = a.opening_id
            LEFT JOIN applications a2
                ON a2.opening_id = po.opening_id
            WHERE a.application_id = $1
            GROUP BY
                a.application_id,
                a.opening_id,
                a.application_status,
                po.allocated_slots,
                po.filled_slots,
                po.posting_status
        `;

        const applicationResult = await client.query(applicationQuery, [applicationId]);

        if (!applicationResult.rows.length) {
            throw new Error('Application not found');
        }

        const row = applicationResult.rows[0];
        const slotCount = Number(row.allocated_slots || 0);
        const qualifiedCount = Number(row.qualified_count || 0);
        const openingStatus = (row.posting_status || '').toLowerCase();
        const currentApplicationStatus = (row.application_status || '').toLowerCase();

        if (currentApplicationStatus === 'qualified') {
            const existingResult = await client.query(
                `SELECT * FROM applications WHERE application_id = $1`,
                [applicationId]
            );
            await client.query('COMMIT');
            return existingResult.rows[0];
        }

        if (openingStatus === 'closed' || openingStatus === 'filled') {
            const waitingResult = await client.query(
                `
                UPDATE applications
                SET application_status = 'Waiting',
                    is_reconsideration_candidate = TRUE
                WHERE application_id = $1
                RETURNING *
                `,
                [applicationId]
            );

            await client.query('COMMIT');
            return waitingResult.rows[0];
        }

        if (slotCount > 0 && qualifiedCount >= slotCount) {
            await client.query(
                `
                UPDATE program_openings
                SET posting_status = 'filled',
                    updated_at = NOW()
                WHERE opening_id = $1
                `,
                [row.opening_id]
            );

            const waitingResult = await client.query(
                `
                UPDATE applications
                SET application_status = 'Waiting',
                    is_reconsideration_candidate = TRUE
                WHERE application_id = $1
                RETURNING *
                `,
                [applicationId]
            );

            await client.query('COMMIT');
            return waitingResult.rows[0];
        }

        const updateApplicationResult = await client.query(
            `
            UPDATE applications
            SET application_status = 'Qualified',
                is_reconsideration_candidate = FALSE
            WHERE application_id = $1
            RETURNING *
            `,
            [applicationId]
        );

        const newQualifiedCount = qualifiedCount + 1;
        const nextFilledSlots = Number(row.filled_slots || 0) + 1;

        if (slotCount > 0 && newQualifiedCount >= slotCount) {
            await client.query(
                `
                UPDATE program_openings
                SET posting_status = 'filled',
                    filled_slots = $2,
                    updated_at = NOW()
                WHERE opening_id = $1
                `,
                [row.opening_id, nextFilledSlots]
            );
        } else {
            await client.query(
                `
                UPDATE program_openings
                SET filled_slots = $2,
                    updated_at = NOW()
                WHERE opening_id = $1
                `,
                [row.opening_id, nextFilledSlots]
            );
        }

        await client.query('COMMIT');
        return updateApplicationResult.rows[0];
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
    uploadStudentApplicationDocument: exports.uploadStudentApplicationDocument,
    markApplicationDisqualified: exports.markApplicationDisqualified,
    saveApplicationVerification: exports.saveApplicationVerification,
    markApplicationReviewed: exports.markApplicationReviewed,
    saveApplicationRemarks: exports.saveApplicationRemarks,
    assignApplicationProgram: exports.assignApplicationProgram,
    moveApplicationToWaiting: exports.moveApplicationToWaiting,
    approveApplicationWithSlotCheck: exports.approveApplicationWithSlotCheck,
};