const supabase = require('../config/supabase');

const REQUIRED_RENEWAL_DOCUMENTS = [
    'Certificate of Registration',
    'Grade Form / Transcript',
];

function normalizeStatus(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function buildInitials(firstName, lastName) {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'NA';
}

function mapDocumentStatus(document) {
    const reviewStatus = normalizeStatus(document.review_status);

    if (reviewStatus === 'verified') return 'verified';
    if (reviewStatus === 'rejected') return 'rejected';
    if (document.is_submitted && document.file_url) return 'uploaded';
    return 'pending';
}

function deriveAggregateDocumentStatus(documents = [], nextRenewalStatus = 'Pending Submission') {
    const normalizedRenewalStatus = normalizeStatus(nextRenewalStatus);
    const rejectedCount = documents.filter((doc) => mapDocumentStatus(doc) === 'rejected').length;
    const uploadedCount = documents.filter((doc) => doc.is_submitted && doc.file_url).length;

    if (rejectedCount > 0 || normalizedRenewalStatus === 'failed') {
        return 'Needs Reupload';
    }

    if (normalizedRenewalStatus === 'submitted' || normalizedRenewalStatus === 'under review') {
        return 'Under Review';
    }

    if (normalizedRenewalStatus === 'approved') {
        return 'Documents Ready';
    }

    if (uploadedCount >= REQUIRED_RENEWAL_DOCUMENTS.length) {
        return 'Documents Ready';
    }

    return 'Missing Docs';
}

function ensureRenewalDocumentCoverage(documents = []) {
    const documentMap = new Map(
        documents.map((document) => [String(document.document_type), document])
    );

    return REQUIRED_RENEWAL_DOCUMENTS.map((name) => (
        documentMap.get(name) || {
            renewal_document_id: null,
            document_type: name,
            is_submitted: false,
            file_url: null,
            review_status: 'pending',
            admin_comment: '',
            submitted_at: null,
            reviewed_at: null,
            remarks: null,
        }
    ));
}

async function loadProgramMap(programIds = []) {
    const uniqueProgramIds = [...new Set(programIds.filter(Boolean))];
    if (uniqueProgramIds.length === 0) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('scholarship_program')
        .select('program_id, program_name, organization_name')
        .in('program_id', uniqueProgramIds);

    if (error) {
        throw new Error(error.message);
    }

    return new Map((data || []).map((row) => [row.program_id, row]));
}

exports.fetchRenewals = async () => {
    const { data, error } = await supabase
        .from('renewals')
        .select(`
            renewal_id,
            scholar_id,
            period_id,
            status,
            deadline_date,
            submitted_on,
            academic_period (
                period_id,
                current_academic_year,
                current_semester,
                is_active
            ),
            scholars (
                scholar_id,
                program_id,
                status,
                batch_year,
                date_awarded,
                students (
                    student_id,
                    pdm_id,
                    first_name,
                    last_name
                )
            )
        `)
        .order('submitted_on', { ascending: false, nullsFirst: false });

    if (error) {
        throw new Error(error.message);
    }

    const renewalIds = (data || []).map((row) => row.renewal_id);
    const programMap = await loadProgramMap(
        (data || []).map((row) => row.scholars?.program_id)
    );
    let documentRows = [];

    if (renewalIds.length > 0) {
        const { data: loadedDocuments, error: documentsError } = await supabase
            .from('renewal_documents')
            .select('*')
            .in('renewal_id', renewalIds);

        if (documentsError) {
            throw new Error(documentsError.message);
        }

        documentRows = loadedDocuments || [];
    }

    const documentsByRenewalId = new Map();
    documentRows.forEach((document) => {
        const existing = documentsByRenewalId.get(document.renewal_id) || [];
        existing.push(document);
        documentsByRenewalId.set(document.renewal_id, existing);
    });

    return (data || []).map((row) => ({
        id: row.renewal_id,
        scholar_id: row.scholar_id,
        student_id: row.scholars?.students?.student_id || null,
        program_id: row.scholars?.program_id || null,
        semester_label: row.academic_period?.current_semester || 'N/A',
        school_year_label: row.academic_period?.current_academic_year || 'N/A',
        renewal_status: row.status,
        document_status: deriveAggregateDocumentStatus(
            documentsByRenewalId.get(row.renewal_id) || [],
            row.status
        ),
        submitted_at: row.submitted_on,
        reviewed_at: null,
        student_name: `${row.scholars?.students?.last_name || 'Unknown'}, ${row.scholars?.students?.first_name || 'Scholar'}`,
        student_number: row.scholars?.students?.pdm_id || 'N/A',
        program_name: (programMap.get(row.scholars?.program_id) || {}).program_name || 'Scholarship',
        organization_name: (programMap.get(row.scholars?.program_id) || {}).organization_name || 'N/A',
        batch_year: row.scholars?.batch_year || 'N/A',
    }));
};

exports.fetchRenewalDetailsById = async (renewalId) => {
    const { data: renewal, error: renewalError } = await supabase
        .from('renewals')
        .select(`
            *,
            academic_period (
                period_id,
                current_academic_year,
                current_semester,
                is_active
            ),
            scholars (
                scholar_id,
                program_id,
                status,
                batch_year,
                date_awarded,
                students (
                    student_id,
                    user_id,
                    pdm_id,
                    first_name,
                    last_name,
                    gwa,
                    year_level,
                    course_id
                )
            )
        `)
        .eq('renewal_id', renewalId)
        .single();

    if (renewalError) {
        throw new Error(renewalError.message);
    }

    const { data: documents, error: documentsError } = await supabase
        .from('renewal_documents')
        .select('*')
        .eq('renewal_id', renewalId)
        .order('document_type', { ascending: true });

    if (documentsError) {
        throw new Error(documentsError.message);
    }

    const programMap = await loadProgramMap([renewal.scholars?.program_id]);
    const programMeta = programMap.get(renewal.scholars?.program_id) || null;

    const student = renewal.scholars?.students || {};
    let userContact = { email: 'N/A', phone_number: 'N/A' };

    if (student.user_id) {
        const { data: userRow, error: userError } = await supabase
            .from('users')
            .select('email, phone_number')
            .eq('user_id', student.user_id)
            .maybeSingle();

        if (userError) {
            throw new Error(userError.message);
        }

        if (userRow) {
            userContact = userRow;
        }
    }

    const normalizedDocuments = ensureRenewalDocumentCoverage(documents || []).map((document) => ({
        id: document.renewal_document_id || String(document.document_type).toLowerCase().replace(/\W+/g, '_'),
        document_key: String(document.document_type).toLowerCase().replace(/\W+/g, '_'),
        name: document.document_type,
        document_type: document.document_type,
        url: document.file_url || null,
        file_url: document.file_url || null,
        status: mapDocumentStatus(document),
        admin_comment: document.admin_comment || '',
        uploaded_at: document.submitted_at || null,
        reviewed_at: document.reviewed_at || null,
        is_submitted: !!document.is_submitted,
        renewal_document_id: document.renewal_document_id || null,
    }));

    return {
        id: renewal.renewal_id,
        renewal: {
            renewal_id: renewal.renewal_id,
            scholar_id: renewal.scholar_id,
            student_id: renewal.scholars?.students?.student_id || null,
            program_id: renewal.scholars?.program_id || null,
            period_id: renewal.period_id,
            semester_label: renewal.academic_period?.current_semester || '',
            school_year_label: renewal.academic_period?.current_academic_year || '',
            renewal_status: renewal.status,
            document_status: deriveAggregateDocumentStatus(documents || [], renewal.status),
            submitted_at: renewal.submitted_on,
            reviewed_at: null,
            admin_comment: '',
        },
        renewal_status: renewal.status,
        document_status: deriveAggregateDocumentStatus(documents || [], renewal.status),
        scholar: {
            scholar_id: renewal.scholars?.scholar_id || null,
            status: renewal.scholars?.status || 'Active',
            batch_year: renewal.scholars?.batch_year || 'N/A',
            date_awarded: renewal.scholars?.date_awarded || 'N/A',
        },
        student: {
            name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown Scholar',
            initials: buildInitials(student.first_name, student.last_name),
            pdm_id: student.pdm_id || 'N/A',
            email: userContact.email || 'N/A',
            phone: userContact.phone_number || 'N/A',
            year: student.year_level ? `${student.year_level} Year` : 'Scholar',
            gwa: student.gwa ?? 'N/A',
            program: programMeta?.program_name || 'Scholarship',
            organization_name: programMeta?.organization_name || 'N/A',
            course: programMeta?.program_name || 'Scholarship',
        },
        documents: normalizedDocuments,
    };
};

exports.saveRenewalReview = async (renewalId, payload, user) => {
    const {
        document_reviews = [],
        final_action = 'under_review',
        final_comment = '',
    } = payload || {};

    if (!Array.isArray(document_reviews)) {
        throw new Error('document_reviews must be an array');
    }

    const reviewedAt = new Date().toISOString();

    for (const doc of document_reviews) {
        const documentType = doc.document_type || doc.name;
        if (!documentType) continue;

        const nextStatus = normalizeStatus(doc.status);
        const reviewStatus = nextStatus === 'verified'
            ? 'verified'
            : nextStatus === 'rejected'
                ? 'rejected'
                : 'pending';

        const { error } = await supabase
            .from('renewal_documents')
            .update({
                review_status: reviewStatus,
                admin_comment: doc.comment || '',
                reviewed_at: doc.url ? reviewedAt : null,
            })
            .eq('renewal_id', renewalId)
            .eq('document_type', documentType);

        if (error) {
            throw new Error(error.message);
        }
    }

    const { data: refreshedDocuments, error: refreshedDocumentsError } = await supabase
        .from('renewal_documents')
        .select('*')
        .eq('renewal_id', renewalId);

    if (refreshedDocumentsError) {
        throw new Error(refreshedDocumentsError.message);
    }

    let nextRenewalStatus = 'Under Review';
    if (final_action === 'approve') {
        nextRenewalStatus = 'Approved';
    } else if (final_action === 'reupload') {
        nextRenewalStatus = 'Failed';
    } else if (final_action === 'reject') {
        nextRenewalStatus = 'Failed';
    }

    const nextDocumentStatus = deriveAggregateDocumentStatus(
        refreshedDocuments || [],
        nextRenewalStatus
    );

    const { data: updatedRenewal, error: updateError } = await supabase
        .from('renewals')
        .update({
            status: nextRenewalStatus,
        })
        .eq('renewal_id', renewalId)
        .select()
        .single();

    if (updateError) {
        throw new Error(updateError.message);
    }

    return {
        renewal: updatedRenewal,
        documents: refreshedDocuments || [],
    };
};
