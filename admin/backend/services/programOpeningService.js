const supabase = require('../config/supabase');

function normalizeStatus(value) {
    return (value || '').toString().trim().toLowerCase();
}

function normalizeAudience(value) {
    const raw = (value || '').toString().trim();

    if (!raw) return 'Applicants';
    if (raw === 'Applicants') return 'Applicants';
    if (raw === 'Scholars') return 'Scholars';
    if (
        raw === 'Both' ||
        raw === 'Applicants,Scholars' ||
        raw === 'Scholars,Applicants'
    ) {
        return 'Both';
    }

    return raw;
}

function toNullableNumber(value) {
    if (value === undefined || value === null || value === '') return null;

    const num = Number(value);
    return Number.isNaN(num) ? null : num;
}

function toRequiredNumber(value, fallback = 0) {
    const num = Number(value ?? fallback);
    return Number.isNaN(num) ? fallback : num;
}

function derivePostingStatus(opening, counts = {}) {
    const existing = normalizeStatus(opening.posting_status || 'draft');
    const allocatedSlots = toRequiredNumber(opening.allocated_slots, 0);
    const filledSlots =
        opening.filled_slots != null
            ? toRequiredNumber(opening.filled_slots, 0)
            : toRequiredNumber(counts.qualified_count, 0);

    if (existing === 'archived') return 'archived';
    if (existing === 'closed') return 'closed';

    const hasRequiredFields =
        !!opening.opening_title &&
        !!opening.program_id &&
        allocatedSlots > 0;

    if (!hasRequiredFields) return 'draft';
    if (filledSlots >= allocatedSlots) return 'closed';

    return 'open';
}

function mapOpening(opening, counts = {}) {
    const allocatedSlots = toRequiredNumber(opening.allocated_slots, 0);
    const qualifiedCount = toRequiredNumber(counts.qualified_count, 0);

    const storedFilledSlots =
        opening.filled_slots != null ? toRequiredNumber(opening.filled_slots, 0) : null;

    const effectiveFilledSlots =
        storedFilledSlots != null ? storedFilledSlots : qualifiedCount;

    const postingStatus = derivePostingStatus(opening, counts);

    const program = opening.scholarship_program || null;
    const benefactor = program?.benefactors || null;

    return {
        opening_id: opening.opening_id,
        title: opening.opening_title || 'Untitled Opening',
        opening_title: opening.opening_title || 'Untitled Opening',

        program_id: opening.program_id || null,
        benefactor_id: program?.benefactor_id || null,

        program_name: program?.program_name || opening.program_name || 'Program',

        organization_name:
            benefactor?.organization_name ||
            benefactor?.benefactor_name ||
            opening.organization_name ||
            null,

        benefactor_name:
            benefactor?.organization_name ||
            benefactor?.benefactor_name ||
            opening.organization_name ||
            null,

        benefactor_type: benefactor?.benefactor_type || null,

        description: program?.description || '',
        gwa_threshold: program?.gwa_threshold ?? null,
        renewal_cycle: program?.renewal_cycle || null,
        visibility_status: program?.visibility_status || null,
        program_is_archived: program?.is_archived ?? false,
        benefactor_is_archived: benefactor?.is_archived ?? false,

        semester: opening.semester || null,
        academic_year: opening.academic_year || null,
        target_audience: normalizeAudience(
            program?.target_audience || opening.target_audience
        ),

        allocated_slots: allocatedSlots,
        filled_slots: effectiveFilledSlots,
        remaining_slots: Math.max(allocatedSlots - effectiveFilledSlots, 0),

        financial_allocation: opening.financial_allocation ?? null,
        per_scholar_amount:
            opening.per_scholar_amount ??
            (allocatedSlots > 0 && opening.financial_allocation != null
                ? Math.floor(toRequiredNumber(opening.financial_allocation, 0) / allocatedSlots)
                : null),

        posting_status: postingStatus,
        announcement_text: opening.announcement_text || '',
        created_at: opening.created_at || null,
        updated_at: opening.updated_at || null,

        application_count: toRequiredNumber(counts.application_count, 0),
        pending_count: toRequiredNumber(counts.pending_count, 0),
        review_count: toRequiredNumber(counts.review_count, 0),
        qualified_count: qualifiedCount,
        waiting_count: toRequiredNumber(counts.waiting_count, 0),
        disqualified_count: toRequiredNumber(counts.disqualified_count, 0),

        slot_count: allocatedSlots,
        status: postingStatus,
    };
}

function buildCounts(opening, applications = []) {
    const related = applications.filter(
        (app) => app.opening_id === opening.opening_id && app.is_archived !== true
    );

    return {
        application_count: related.length,
        pending_count: related.filter((app) =>
            ['pending', 'submitted'].includes(normalizeStatus(app.application_status))
        ).length,
        review_count: related.filter((app) =>
            ['review', 'under review', 'under_review'].includes(
                normalizeStatus(app.application_status)
            )
        ).length,
        qualified_count: related.filter((app) =>
            ['qualified', 'approved'].includes(normalizeStatus(app.application_status))
        ).length,
        waiting_count: related.filter((app) =>
            ['waiting', 'waitlisted'].includes(normalizeStatus(app.application_status))
        ).length,
        disqualified_count: related.filter((app) =>
            ['disqualified', 'rejected'].includes(normalizeStatus(app.application_status))
        ).length,
    };
}

async function fetchApplicationsForCounts(openingId = null) {
    let query = supabase
        .from('applications')
        .select(`
            application_id,
            opening_id,
            application_status,
            is_archived
        `);

    if (openingId) {
        query = query.eq('opening_id', openingId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('SUPABASE PROGRAM OPENING APPLICATION COUNTS ERROR:', error);
        throw new Error(error.message);
    }

    return data || [];
}

function baseOpeningSelectQuery() {
    return supabase
        .from('program_openings')
        .select(`
            opening_id,
            program_id,
            opening_title,
            announcement_text,
            semester,
            academic_year,
            allocated_slots,
            filled_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            target_audience,
            created_at,
            updated_at,
            scholarship_program (
                program_id,
                benefactor_id,
                program_name,
                description,
                target_audience,
                gwa_threshold,
                renewal_cycle,
                visibility_status,
                is_archived,
                created_at,
                updated_at,
                benefactors (
                    benefactor_id,
                    organization_name,
                    benefactor_name,
                    benefactor_type,
                    is_archived,
                    created_at,
                    updated_at
                )
            )
        `);
}

exports.fetchAllProgramOpenings = async () => {
    const { data, error } = await baseOpeningSelectQuery().order('created_at', {
        ascending: false,
    });

    if (error) {
        console.error('SUPABASE FETCH ALL PROGRAM OPENINGS ERROR:', error);
        throw new Error(error.message);
    }

    const rows = data || [];
    const applications = await fetchApplicationsForCounts();

    return rows.map((opening) => {
        const counts = buildCounts(opening, applications);
        return mapOpening(opening, counts);
    });
};

exports.fetchMobileOpenings = async () => {
    const { data, error } = await baseOpeningSelectQuery().in('posting_status', [
        'open',
        'draft',
    ]);

    if (error) {
        console.error('SUPABASE FETCH MOBILE OPENINGS ERROR:', error);
        throw new Error(error.message);
    }

    const rows = data || [];
    const applications = await fetchApplicationsForCounts();

    return rows
        .map((opening) => {
            const counts = buildCounts(opening, applications);
            return mapOpening(opening, counts);
        })
        .filter(
            (opening) =>
                opening.posting_status === 'open' &&
                opening.program_is_archived !== true &&
                opening.benefactor_is_archived !== true
        );
};

exports.fetchOpeningsApplicationSummary = async () => {
    const { data: openings, error: openingsError } = await baseOpeningSelectQuery().order(
        'created_at',
        { ascending: false }
    );

    if (openingsError) {
        console.error('PROGRAM OPENING SUMMARY - OPENINGS ERROR:', openingsError);
        throw new Error(openingsError.message);
    }

    const applications = await fetchApplicationsForCounts();

    return (openings || []).map((opening) => {
        const counts = buildCounts(opening, applications);
        return mapOpening(opening, counts);
    });
};

exports.fetchProgramOpeningById = async (openingId) => {
    const { data: opening, error: openingError } = await baseOpeningSelectQuery()
        .eq('opening_id', openingId)
        .maybeSingle();

    if (openingError) {
        console.error('PROGRAM OPENING BY ID ERROR:', openingError);
        throw new Error(openingError.message);
    }

    if (!opening) return null;

    const applications = await fetchApplicationsForCounts(openingId);
    const counts = buildCounts(opening, applications);

    return mapOpening(opening, counts);
};

exports.fetchApplicationsByOpeningId = async (openingId) => {
    const { data, error } = await supabase
        .from('applications')
        .select(`
            application_id,
            student_id,
            opening_id,
            application_status,
            document_status,
            verification_status,
            remarks,
            submission_date,
            is_reconsideration_candidate,
            is_disqualified,
            disqualification_reason,
            is_archived,
            students (
                first_name,
                middle_name,
                last_name,
                pdm_id,
                gwa,
                sdo_status,
                is_archived
            )
        `)
        .eq('opening_id', openingId)
        .order('submission_date', { ascending: true });

    if (error) {
        console.error('SUPABASE FETCH APPLICATIONS BY OPENING ID ERROR:', error);
        throw new Error(error.message);
    }

    return (data || [])
        .filter((app) => app.is_archived !== true)
        .filter((app) => app.students && app.students.is_archived !== true)
        .map((app) => ({
            id: app.application_id,
            student_id: app.student_id,
            opening_id: app.opening_id,
            name: `${app.students?.last_name || 'Unknown'}, ${app.students?.first_name || 'Student'}${app.students?.middle_name ? ` ${app.students.middle_name}` : ''}`,
            student_number: app.students?.pdm_id || 'N/A',
            gwa: app.students?.gwa ?? null,
            sdo_status: app.students?.sdo_status || 'clear',
            application_status: normalizeStatus(app.application_status || 'pending'),
            document_status: normalizeStatus(app.document_status || 'missing docs'),
            verification_status: normalizeStatus(app.verification_status || 'pending'),
            ocr_status: '',
            remarks: app.remarks || '',
            submitted: app.submission_date || null,
            submission_date: app.submission_date || null,
            is_reconsideration_candidate: !!app.is_reconsideration_candidate,
            disqualified: !!app.is_disqualified,
            disqReason: app.disqualification_reason || null,
            is_scholar: ['qualified', 'approved'].includes(
                normalizeStatus(app.application_status)
            ),
        }));
};

exports.createProgramOpening = async (payload = {}) => {
    const {
        program_id,
        opening_title,
        announcement_text,
        semester,
        academic_year,
        allocated_slots,
        filled_slots = 0,
        financial_allocation,
        per_scholar_amount,
        posting_status,
        target_audience,
    } = payload;

    if (!program_id) {
        throw new Error('Program ID is required');
    }

    if (!opening_title || !String(opening_title).trim()) {
        throw new Error('Opening title is required');
    }

    const insertData = {
        program_id,
        opening_title: String(opening_title).trim(),
        announcement_text: announcement_text ? String(announcement_text).trim() : null,
        semester: semester || null,
        academic_year: academic_year || null,
        allocated_slots: toRequiredNumber(allocated_slots, 0),
        filled_slots: toRequiredNumber(filled_slots, 0),
        financial_allocation: toNullableNumber(financial_allocation),
        per_scholar_amount: toNullableNumber(per_scholar_amount),
        target_audience: target_audience || null,
        posting_status: 'draft',
    };

    insertData.posting_status = derivePostingStatus({
        ...insertData,
        posting_status,
    });

    const { data, error } = await supabase
        .from('program_openings')
        .insert([insertData])
        .select(`
            opening_id,
            program_id,
            opening_title,
            announcement_text,
            semester,
            academic_year,
            allocated_slots,
            filled_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            target_audience,
            created_at,
            updated_at,
            scholarship_program (
                program_id,
                benefactor_id,
                program_name,
                description,
                target_audience,
                gwa_threshold,
                renewal_cycle,
                visibility_status,
                is_archived,
                created_at,
                updated_at,
                benefactors (
                    benefactor_id,
                    organization_name,
                    benefactor_name,
                    benefactor_type,
                    is_archived,
                    created_at,
                    updated_at
                )
            )
        `)
        .single();

    if (error) {
        console.error('SUPABASE CREATE PROGRAM OPENING ERROR:', error);
        throw new Error(error.message);
    }

    const counts = buildCounts(data, []);
    return mapOpening(data, counts);
};

exports.updateProgramOpening = async (openingId, payload = {}) => {
    const { data: existing, error: existingError } = await baseOpeningSelectQuery()
        .eq('opening_id', openingId)
        .maybeSingle();

    if (existingError) {
        console.error('SUPABASE FETCH EXISTING PROGRAM OPENING ERROR:', existingError);
        throw new Error(existingError.message);
    }

    if (!existing) return null;

    const merged = {
        program_id: payload.program_id ?? existing.program_id,
        opening_title: payload.opening_title ?? existing.opening_title,
        announcement_text: payload.announcement_text ?? existing.announcement_text,
        semester: payload.semester ?? existing.semester,
        academic_year: payload.academic_year ?? existing.academic_year,
        allocated_slots: payload.allocated_slots ?? existing.allocated_slots,
        filled_slots: payload.filled_slots ?? existing.filled_slots ?? 0,
        financial_allocation: payload.financial_allocation ?? existing.financial_allocation,
        per_scholar_amount: payload.per_scholar_amount ?? existing.per_scholar_amount,
        posting_status: payload.posting_status ?? existing.posting_status,
        target_audience: payload.target_audience ?? existing.target_audience,
    };

    if (!merged.program_id) {
        throw new Error('Program ID is required');
    }

    if (!merged.opening_title || !String(merged.opening_title).trim()) {
        throw new Error('Opening title is required');
    }

    const updateData = {
        program_id: merged.program_id,
        opening_title: String(merged.opening_title).trim(),
        announcement_text: merged.announcement_text
            ? String(merged.announcement_text).trim()
            : null,
        semester: merged.semester || null,
        academic_year: merged.academic_year || null,
        allocated_slots: toRequiredNumber(merged.allocated_slots, 0),
        filled_slots: toRequiredNumber(merged.filled_slots, 0),
        financial_allocation: toNullableNumber(merged.financial_allocation),
        per_scholar_amount: toNullableNumber(merged.per_scholar_amount),
        target_audience: merged.target_audience || null,
        updated_at: new Date().toISOString(),
    };

    updateData.posting_status = derivePostingStatus({
        ...existing,
        ...updateData,
        posting_status: merged.posting_status,
    });

    const { data, error } = await supabase
        .from('program_openings')
        .update(updateData)
        .eq('opening_id', openingId)
        .select(`
            opening_id,
            program_id,
            opening_title,
            announcement_text,
            semester,
            academic_year,
            allocated_slots,
            filled_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            target_audience,
            created_at,
            updated_at,
            scholarship_program (
                program_id,
                benefactor_id,
                program_name,
                description,
                target_audience,
                gwa_threshold,
                renewal_cycle,
                visibility_status,
                is_archived,
                created_at,
                updated_at,
                benefactors (
                    benefactor_id,
                    organization_name,
                    benefactor_name,
                    benefactor_type,
                    is_archived,
                    created_at,
                    updated_at
                )
            )
        `)
        .maybeSingle();

    if (error) {
        console.error('SUPABASE UPDATE PROGRAM OPENING ERROR:', error);
        throw new Error(error.message);
    }

    if (!data) return null;

    const applications = await fetchApplicationsForCounts(openingId);
    const counts = buildCounts(data, applications);

    return mapOpening(data, counts);
};

exports.closeProgramOpening = async (openingId) => {
    const { data, error } = await supabase
        .from('program_openings')
        .update({
            posting_status: 'closed',
            updated_at: new Date().toISOString(),
        })
        .eq('opening_id', openingId)
        .select(`
            opening_id,
            program_id,
            opening_title,
            announcement_text,
            semester,
            academic_year,
            allocated_slots,
            filled_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            target_audience,
            created_at,
            updated_at,
            scholarship_program (
                program_id,
                benefactor_id,
                program_name,
                description,
                target_audience,
                gwa_threshold,
                renewal_cycle,
                visibility_status,
                is_archived,
                created_at,
                updated_at,
                benefactors (
                    benefactor_id,
                    organization_name,
                    benefactor_name,
                    benefactor_type,
                    is_archived,
                    created_at,
                    updated_at
                )
            )
        `)
        .maybeSingle();

    if (error) {
        console.error('SUPABASE CLOSE PROGRAM OPENING ERROR:', error);
        throw new Error(error.message);
    }

    if (!data) return null;

    const applications = await fetchApplicationsForCounts(openingId);
    const counts = buildCounts(data, applications);

    return mapOpening(data, counts);
};