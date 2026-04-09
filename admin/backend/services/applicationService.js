const path = require('path');
const supabase = require('../config/supabase');
const _ = require('lodash');

const STORAGE_BUCKET =
    process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET || 'application-documents';

const APPLICATION_DOCUMENT_DEFINITIONS = [
    {
        id: 'survey_form',
        name: 'Survey Form',
        aliases: ['survey form'],
    },
    {
        id: 'letter_of_request',
        name: 'Letter of Request',
        aliases: ['letter of request', 'request letter'],
    },
    {
        id: 'certificate_of_indigency',
        name: 'Certificate of Indigency',
        aliases: ['certificate of indigency', 'indigency'],
    },
    {
        id: 'certificate_of_registration',
        name: 'Certificate of Registration',
        aliases: ['certificate of registration', 'cor', 'registration form', 'registration'],
    },
    {
        id: 'certificate_of_good_moral_character',
        name: 'Certificate of Good Moral Character',
        aliases: [
            'certificate of good moral character',
            'certificate of good moral',
            'good moral',
            'good moral certificate',
        ],
    },
    {
        id: 'senior_high_school_card',
        name: 'Senior High School Card',
        aliases: ['senior high school card', 'shs card'],
    },
    {
        id: 'student_grade_forms',
        name: 'Student Grade Forms',
        aliases: ['student grade forms', 'grade forms', 'grades', 'grade card', 'report card'],
    },
    {
        id: 'id_picture',
        name: 'ID Picture',
        aliases: ['id picture', 'picture', 'photo', '1x1'],
    },
];

const DOCUMENT_TYPE_ALIASES = {
    survey_form: 'survey_form',

    letter_of_request: 'letter_of_request',
    request_letter: 'letter_of_request',

    certificate_of_indigency: 'certificate_of_indigency',
    indigency: 'certificate_of_indigency',

    cor: 'certificate_of_registration',
    certificate_of_registration: 'certificate_of_registration',
    registration: 'certificate_of_registration',

    senior_high_school_card: 'senior_high_school_card',
    shs_card: 'senior_high_school_card',

    grade_card: 'student_grade_forms',
    grade_forms: 'student_grade_forms',
    grades: 'student_grade_forms',
    student_grade_forms: 'student_grade_forms',

    good_moral: 'certificate_of_good_moral_character',
    certificate_of_good_moral_character: 'certificate_of_good_moral_character',
    certificate_of_good_moral: 'certificate_of_good_moral_character',

    id_picture: 'id_picture',
    picture: 'id_picture',
    photo: 'id_picture',
};

const DOCUMENT_TYPE_TO_NAME = {
    survey_form: 'Survey Form',
    letter_of_request: 'Letter of Request',
    certificate_of_indigency: 'Certificate of Indigency',
    certificate_of_registration: 'Certificate of Registration',
    certificate_of_good_moral_character: 'Certificate of Good Moral Character',
    senior_high_school_card: 'Senior High School Card',
    student_grade_forms: 'Student Grade Forms',
    id_picture: 'ID Picture',
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

    return document.is_submitted || document.file_url ? 'uploaded' : 'pending';
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

function computeDocumentSummary(documents = []) {
    const summary = {
        verified: 0,
        uploaded: 0,
        flagged: 0,
        reupload: 0,
        pending: 0,
        progress: 0,
    };

    for (const doc of documents) {
        const status = normalizeLookupValue(doc.status);

        if (status === 'verified') {
            summary.verified += 1;
            summary.uploaded += 1;
        } else if (status === 'uploaded' || status === 'under review') {
            summary.uploaded += 1;
        } else if (status === 'flagged') {
            summary.flagged += 1;
            summary.uploaded += 1;
        } else if (status === 'rejected' || status === 're upload') {
            summary.reupload += 1;
            summary.uploaded += 1;
        } else {
            summary.pending += 1;
        }
    }

    const total = documents.length || 0;
    summary.progress = total > 0 ? Math.round((summary.uploaded / total) * 100) : 0;

    return summary;
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
        .createSignedUrl(filePath, 60 * 60);

    if (error) {
        console.error('SUPABASE SIGNED URL ERROR:', error.message);
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
                organization_name,
                program_name
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
                url: signedUrl || review?.file_url || document.file_url || null,
                file_url: signedUrl || review?.file_url || document.file_url || null,
                signed_url: signedUrl,
                status: deriveReviewStatus(document, review),
                admin_comment: review?.admin_comment || document.notes || '',
                notes: document.notes || null,
                uploaded_at: document.submitted_at || null,
                submitted_at: document.submitted_at || null,
                reviewed_at: review?.reviewed_at || null,
            };
        })
    );

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
            program: applicationRecord.scholarship_program?.program_name || 'Unassigned',
            organization_name: applicationRecord.scholarship_program?.organization_name || 'N/A',
            course: courseCode,
        },
        student_profile: profileResult.data || null,
        family_members: familyMembersResult.data || [],
        education_records: educationRecordsResult.data || [],
        documents,
    };
}

exports.fetchApplications = async () => {
    const { data: applications, error: appError } = await supabase
        .from('applications')
        .select(`
            application_id,
            student_id,
            program_id,
            application_status,
            submission_date,
            document_status,
            verification_status,
            is_disqualified,
            disqualification_reason,
            is_reconsideration_candidate,
            students ( first_name, last_name, pdm_id, gwa, sdo_status ),
            scholarship_program (
                program_id,
                organization_name,
                program_name
            )
        `);

    if (appError) {
        console.error('Supabase Fetch Error:', appError);
        throw new Error(appError.message);
    }

    const { data: scholars, error: scholarError } = await supabase
        .from('scholars')
        .select('student_id');

    if (scholarError) {
        console.error('Supabase Scholar Fetch Error:', scholarError);
        throw new Error(scholarError.message);
    }

    const scholarStudentIds = new Set(
        (scholars || []).map((s) => s.student_id).filter(Boolean)
    );

    const filteredApplications = (applications || []).filter(
        (app) => !scholarStudentIds.has(app.student_id)
    );

    const processed = _.map(filteredApplications, (app) => ({
        id: app.application_id,
        student_id: app.student_id,
        program_id: app.program_id,
        name: `${_.get(app, 'students.last_name', 'Unknown')}, ${_.get(
            app,
            'students.first_name',
            'Student'
        )}`,
        student_number: _.get(app, 'students.pdm_id', 'N/A'),
        program: _.get(app, 'scholarship_program.program_name', 'Unassigned'),
        organization_name: _.get(app, 'scholarship_program.organization_name', 'N/A'),
        submitted: app.submission_date,
        application_status: _.toLower(app.application_status || 'pending'),
        status: _.toLower(app.application_status || 'pending'),
        document_status: _.toLower(app.document_status || 'missing docs'),
        verification_status: _.toLower(app.verification_status || 'pending'),
        disqualified: !!app.is_disqualified,
        disqReason: app.disqualification_reason || null,
        is_reconsideration_candidate: !!app.is_reconsideration_candidate,
        gwa: _.get(app, 'students.gwa', 0),
        sdo_status: _.get(app, 'students.sdo_status', 'clear'),
    }));

    return _.orderBy(processed, ['submitted'], ['desc']);
};

exports.fetchApplicationDetailsById = async (id) => buildApplicationDetails(id);
exports.fetchApplicationDocumentsById = async (id) => buildApplicationDetails(id);

exports.assignApplicationProgram = async (applicationId, programId) => {
    if (!programId) {
        throw new Error('program_id is required');
    }

    const { data: program, error: programError } = await supabase
        .from('scholarship_program')
        .select('program_id')
        .eq('program_id', programId)
        .maybeSingle();

    if (programError) {
        console.error('Supabase Program Fetch Error:', programError);
        throw new Error(programError.message);
    }

    if (!program) {
        throw new Error('Selected scholarship program is invalid.');
    }

    const { data: applicationRecord, error: applicationError } = await supabase
        .from('applications')
        .select('application_id, student_id, application_status')
        .eq('application_id', applicationId)
        .single();

    if (applicationError) {
        console.error('Supabase Application Fetch Error:', applicationError);
        throw new Error(applicationError.message);
    }

    const { data: conflictingApplication, error: conflictError } = await supabase
        .from('applications')
        .select('application_id')
        .eq('student_id', applicationRecord.student_id)
        .eq('program_id', programId)
        .in('application_status', ['Pending Review', 'Interview'])
        .neq('application_id', applicationId)
        .eq('is_disqualified', false)
        .maybeSingle();

    if (conflictError) {
        console.error('Supabase Program Conflict Fetch Error:', conflictError);
        throw new Error(conflictError.message);
    }

    if (conflictingApplication) {
        throw new Error('This student already has an active application for the selected program.');
    }

    const { data, error } = await supabase
        .from('applications')
        .update({ program_id: programId })
        .eq('application_id', applicationId)
        .select()
        .single();

    if (error) {
        console.error('Supabase Application Program Update Error:', error);
        throw new Error(error.message);
    }

    return data;
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
        file_url: signedUrl,
        is_submitted: true,
        submitted_at: now,
        notes: null,
        uploaded_by: uploaderId,
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
        .select('document_type, file_url, is_submitted')
        .eq('application_id', applicationId);

    if (docsError) {
        console.error('SUPABASE DOCUMENT STATUS CHECK ERROR:', docsError);
        throw new Error(docsError.message);
    }

    const requiredDocumentNames = Object.values(DOCUMENT_TYPE_TO_NAME);
    const uploadedNames = new Set(
        (existingDocuments || [])
            .filter((d) => d.is_submitted && d.file_url)
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
            application_status: 'Rejected',
            verification_status: 'rejected',
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

        const documentTypeName =
            DOCUMENT_TYPE_TO_NAME[normalizedDocumentType] || doc.document_type || doc.name;

        if (!documentTypeName) continue;

        const { error: submittedDocumentError } = await supabase
            .from('application_documents')
            .update({
                is_submitted: !!doc.url,
                file_url: doc.url || null,
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
        verification_status: verification_status || 'pending',
    };

    if (verification_status === 'verified') {
        applicationUpdatePayload.application_status = 'Interview';
    } else if (verification_status === 'rejected') {
        applicationUpdatePayload.application_status = 'Pending Review';
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
            application_status: 'Interview',
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
