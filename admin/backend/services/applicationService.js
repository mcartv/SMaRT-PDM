const supabase = require('../config/supabase');
const _ = require('lodash');

const LEGACY_DOCUMENT_DEFINITIONS = [
    { id: 'loi', name: 'Letter of Intent', aliases: ['letter of intent', 'loi', 'intent'] },
    { id: 'cor', name: 'Certificate of Registration', aliases: ['certificate of registration', 'cor', 'registration'] },
    { id: 'grades', name: 'Grade Form', aliases: ['grade form', 'grades', 'report of grades'] },
    { id: 'indigency', name: 'Certificate of Indigency', aliases: ['certificate of indigency', 'indigency'] },
    { id: 'valid_id', name: 'Valid ID', aliases: ['valid id', 'government id', 'identification'] },
];

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

function inferDocumentKey(document = {}) {
    const candidates = [
        document.document_type,
        _.get(document, 'program_requirements.requirement_name'),
        _.get(document, 'program_requirements.name'),
        document.file_name,
    ]
        .filter(Boolean)
        .map((value) => normalizeLookupValue(value));

    for (const definition of LEGACY_DOCUMENT_DEFINITIONS) {
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
        : normalizeLookupValue(document.document_type || document.file_name || 'document').replace(/\s+/g, '_');
}

function deriveReviewStatus(document = {}, review = null) {
    const preferredStatus = normalizeLookupValue(
        review?.review_status ?? document.file_status
    );

    if (preferredStatus === 'verified') return 'verified';
    if (preferredStatus === 'rejected' || preferredStatus === 're upload') return 'rejected';
    if (preferredStatus === 'flagged') return 'flagged';
    if (preferredStatus === 'uploaded') return 'uploaded';
    return document.file_url ? 'uploaded' : 'pending';
}

function deriveAggregateDocumentStatus(summary = {}) {
    const verifiedCount = Number(summary?.verified || 0);
    const uploadedCount = Number(summary?.uploaded || 0);
    const flaggedCount = Number(summary?.flagged || 0);
    const reuploadCount = Number(summary?.reupload || 0);

    if (uploadedCount === 0) {
        return 'Missing Docs';
    }

    if (reuploadCount > 0 || flaggedCount > 0) {
        return 'Under Review';
    }

    if (verifiedCount > 0 && verifiedCount === uploadedCount) {
        return 'Documents Ready';
    }

    return 'Under Review';
}

function ensureLegacyDocumentCoverage(normalizedDocuments = []) {
    const documentMap = new Map(normalizedDocuments.map((document) => [document.id, document]));
    const legacyDocuments = LEGACY_DOCUMENT_DEFINITIONS.map((definition) => (
        documentMap.get(definition.id) || {
            id: definition.id,
            document_key: definition.id,
            requirement_id: null,
            requirement_name: definition.name,
            name: definition.name,
            document_type: null,
            file_name: null,
            url: null,
            file_url: null,
            status: 'pending',
            file_status: 'pending',
            admin_comment: '',
            notes: null,
            uploaded_at: null,
            reviewed_at: null,
        }
    ));

    const extraDocuments = normalizedDocuments.filter(
        (document) => !LEGACY_DOCUMENT_DEFINITIONS.some((definition) => definition.id === document.id)
    );

    return [...legacyDocuments, ...extraDocuments];
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
            scholarship_programs (
                program_id,
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
            throw new Error('This application has already been converted into an active scholar record.');
        }
    }

    const [
        formSubmissionResult,
        personalDetailsResult,
        familyMembersResult,
        educationRecordsResult,
        documentsResult,
        reviewsResult,
    ] = await Promise.all([
        supabase
            .from('application_form_submissions')
            .select('*')
            .eq('application_id', applicationId)
            .maybeSingle(),
        supabase
            .from('application_personal_details')
            .select('*')
            .eq('application_id', applicationId)
            .maybeSingle(),
        supabase
            .from('application_family_members')
            .select('*')
            .eq('application_id', applicationId)
            .order('relation_type', { ascending: true }),
        supabase
            .from('application_education_records')
            .select('*')
            .eq('application_id', applicationId)
            .order('education_level', { ascending: true }),
        supabase
            .from('application_documents_submitted')
            .select(`
                *,
                program_requirements (*)
            `)
            .eq('application_id', applicationId)
            .order('uploaded_at', { ascending: true }),
        supabase
            .from('application_document_reviews')
            .select('*')
            .eq('application_id', applicationId),
    ]);

    const resultErrors = [
        formSubmissionResult.error,
        personalDetailsResult.error,
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

        if (userData) {
            userContact = userData;
        }
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

        if (courseData) {
            courseCode = courseData.course_code;
        }
    }

    const reviewByKey = new Map(
        (reviewsResult.data || []).map((review) => [review.document_key, review])
    );

    const normalizedDocuments = (documentsResult.data || []).map((document) => {
        const documentKey = inferDocumentKey(document);
        const review = reviewByKey.get(documentKey) || null;
        const requirementName =
            _.get(document, 'program_requirements.requirement_name') ||
            _.get(document, 'program_requirements.name') ||
            document.document_type ||
            document.file_name ||
            'Document';

        return {
            id: documentKey,
            document_key: documentKey,
            requirement_id: document.requirement_id,
            requirement_name: requirementName,
            name: requirementName,
            document_type: document.document_type || null,
            file_name: document.file_name || null,
            url: review?.file_url || document.file_url || null,
            file_url: review?.file_url || document.file_url || null,
            status: deriveReviewStatus(document, review),
            file_status: document.file_status || 'pending',
            admin_comment: review?.admin_comment || document.notes || '',
            notes: document.notes || null,
            uploaded_at: document.uploaded_at || null,
            reviewed_at: review?.reviewed_at || document.reviewed_at || null,
        };
    });

    const documents = ensureLegacyDocumentCoverage(normalizedDocuments);

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
            evaluator_id: applicationRecord.evaluator_id || null,
        },
        application_status: applicationRecord.application_status,
        document_status: applicationRecord.document_status,
        submitted: applicationRecord.submission_date,
        disqualified: !!applicationRecord.is_disqualified,
        disqualification_reason: applicationRecord.disqualification_reason || null,
        student: {
            name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown Student',
            initials: `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || 'NA',
            pdm_id: student.pdm_id || 'N/A',
            email: userContact.email || 'N/A',
            phone: userContact.phone_number || 'N/A',
            year: student.year_level
                ? `${student.year_level}${getOrdinalSuffix(student.year_level)} Year`
                : 'N/A',
            gwa: student.gwa ?? 'N/A',
            program: applicationRecord.scholarship_programs?.program_name || 'General',
            course: courseCode,
        },
        form_submission: formSubmissionResult.data || null,
        personal_details: personalDetailsResult.data || null,
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
            application_status,
            submission_date,
            document_status,
            is_disqualified,
            disqualification_reason,
            students ( first_name, last_name, pdm_id, gwa, sdo_status ),
            scholarship_programs ( program_name )
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
        (scholars || [])
            .map((s) => s.student_id)
            .filter(Boolean)
    );

    const filteredApplications = (applications || []).filter(
        (app) => !scholarStudentIds.has(app.student_id)
    );

    const processed = _.map(filteredApplications, (app) => ({
        id: app.application_id,
        student_id: app.student_id,
        name: `${_.get(app, 'students.last_name', 'Unknown')}, ${_.get(app, 'students.first_name', 'Student')}`,
        student_number: _.get(app, 'students.pdm_id', 'N/A'),
        program: _.get(app, 'scholarship_programs.program_name', 'General'),
        submitted: app.submission_date,
        status: _.toLower(app.application_status || ''),
        document_status: _.toLower(app.document_status || 'missing docs'),
        disqualified: !!app.is_disqualified,
        disqReason: app.disqualification_reason || null,
        gwa: _.get(app, 'students.gwa', 0),
    }));

    return _.orderBy(processed, ['submitted'], ['desc']);
};

exports.fetchApplicationDetailsById = async (id) => buildApplicationDetails(id);

exports.fetchApplicationDocumentsById = async (id) => buildApplicationDetails(id);

exports.markApplicationDisqualified = async (id, reason) => {
    const { data, error } = await supabase
        .from('applications')
        .update({
            is_disqualified: true,
            disqualification_reason: reason,
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
    } = payload || {};

    if (!Array.isArray(document_reviews)) {
        throw new Error('document_reviews must be an array');
    }

    const reviewedBy = user?.userId || null;
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
        if (!doc.requirement_id) {
            continue;
        }

        const { error: submittedDocumentError } = await supabase
            .from('application_documents_submitted')
            .update({
                file_status: doc.status || 'pending',
                reviewed_at: reviewedAt,
                notes: doc.comment || null,
                file_url: doc.url || null,
            })
            .eq('application_id', applicationId)
            .eq('requirement_id', doc.requirement_id);

        if (submittedDocumentError) {
            console.error('Supabase Submitted Document Update Error:', submittedDocumentError);
            throw new Error(submittedDocumentError.message);
        }
    }

    const nextDocumentStatus = deriveAggregateDocumentStatus(summary);

    const { data: updatedApplication, error: applicationUpdateError } = await supabase
        .from('applications')
        .update({
            document_status: nextDocumentStatus,
        })
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
