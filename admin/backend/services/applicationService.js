const supabase = require('../config/supabase');
const _ = require('lodash');

const APPLICATION_DOCUMENT_DEFINITIONS = [
    { id: 'survey_form', name: 'Survey Form', aliases: ['survey form'] },
    { id: 'letter_of_request', name: 'Letter of Request', aliases: ['letter of request', 'request letter'] },
    { id: 'certificate_of_indigency', name: 'Certificate of Indigency', aliases: ['certificate of indigency', 'indigency'] },
    { id: 'certificate_of_good_moral_character', name: 'Certificate of Good Moral Character', aliases: ['certificate of good moral character', 'good moral'] },
    { id: 'senior_high_school_card', name: 'Senior High School Card', aliases: ['senior high school card', 'shs card'] },
    { id: 'student_grade_forms', name: 'Student Grade Forms', aliases: ['student grade forms', 'grade forms', 'grades'] },
    { id: 'certificate_of_registration', name: 'Certificate of Registration', aliases: ['certificate of registration', 'cor', 'registration'] },
    { id: 'id_picture', name: 'ID Picture', aliases: ['id picture', 'picture', 'photo'] },
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
        : normalizeLookupValue(document.document_type || document.file_name || 'document').replace(/\s+/g, '_');
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

    if (uploadedCount === 0) return 'Missing Docs';
    if (reuploadCount > 0 || flaggedCount > 0) return 'Under Review';
    if (verifiedCount > 0 && verifiedCount === uploadedCount) return 'Documents Ready';

    return 'Under Review';
}

function ensureDocumentCoverage(normalizedDocuments = []) {
    const documentMap = new Map(normalizedDocuments.map((document) => [document.id, document]));
    const requiredDocuments = APPLICATION_DOCUMENT_DEFINITIONS.map((definition) => (
        documentMap.get(definition.id) || {
            id: definition.id,
            document_key: definition.id,
            name: definition.name,
            document_type: definition.name,
            file_url: null,
            status: 'pending',
            admin_comment: '',
            notes: null,
            submitted_at: null,
            reviewed_at: null,
        }
    ));

    const extraDocuments = normalizedDocuments.filter(
        (document) => !APPLICATION_DOCUMENT_DEFINITIONS.some((definition) => definition.id === document.id)
    );

    return [...requiredDocuments, ...extraDocuments];
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
            throw new Error('This application has already been converted into an active scholar record.');
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

    const normalizedDocuments = (documentsResult.data || []).map((document) => {
        const documentKey = inferDocumentKey(document);
        const review = reviewByKey.get(documentKey) || null;
        const requirementName = document.document_type || 'Document';

        return {
            id: documentKey,
            document_key: documentKey,
            name: requirementName,
            document_type: document.document_type || null,
            url: review?.file_url || document.file_url || null,
            file_url: review?.file_url || document.file_url || null,
            status: deriveReviewStatus(document, review),
            admin_comment: review?.admin_comment || document.notes || '',
            notes: document.notes || null,
            uploaded_at: document.submitted_at || null,
            reviewed_at: review?.reviewed_at || null,
        };
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
            is_disqualified,
            disqualification_reason,
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
        program_id: app.program_id,
        name: `${_.get(app, 'students.last_name', 'Unknown')}, ${_.get(app, 'students.first_name', 'Student')}`,
        student_number: _.get(app, 'students.pdm_id', 'N/A'),
        program: _.get(app, 'scholarship_program.program_name', 'Unassigned'),
        organization_name: _.get(app, 'scholarship_program.organization_name', 'N/A'),
        submitted: app.submission_date,
        application_status: _.toLower(app.application_status || 'pending'),
        status: _.toLower(app.application_status || 'pending'),
        document_status: _.toLower(app.document_status || 'missing docs'),
        disqualified: !!app.is_disqualified,
        disqReason: app.disqualification_reason || null,
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

exports.markApplicationDisqualified = async (id, reason) => {
    const { data, error } = await supabase
        .from('applications')
        .update({
            is_disqualified: true,
            disqualification_reason: reason,
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
        const documentType = doc.document_type || doc.name;
        if (!documentType) continue;

        const { error: submittedDocumentError } = await supabase
            .from('application_documents')
            .update({
                is_submitted: !!doc.url,
                file_url: doc.url || null,
                submitted_at: doc.url ? reviewedAt : null,
                remarks: doc.comment || null,
            })
            .eq('application_id', applicationId)
            .eq('document_type', documentType);

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
