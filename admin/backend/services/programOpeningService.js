const supabase = require('../config/supabase');

function normalizeStatus(value) {
    return (value || '').toString().trim().toLowerCase();
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
    if (existing === 'filled') return 'filled';

    const hasRequiredFields =
        !!opening.opening_title &&
        !!opening.program_id &&
        !!opening.period_id &&
        allocatedSlots > 0;

    if (!hasRequiredFields) return 'draft';
    if (filledSlots >= allocatedSlots && allocatedSlots > 0) return 'filled';

    return 'open';
}

async function resolveAcademicYearIdFromPeriod(periodId) {
    const { data, error } = await supabase
        .from('academic_period')
        .select('academic_year_id')
        .eq('period_id', periodId)
        .single();

    if (error) {
        console.error('RESOLVE ACADEMIC YEAR FROM PERIOD ERROR:', error);
        throw new Error(error.message);
    }

    if (!data?.academic_year_id) {
        throw new Error('Invalid academic period');
    }

    return data.academic_year_id;
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
    const academicYear = opening.academic_years || null;
    const period = opening.academic_period || null;

    return {
        opening_id: opening.opening_id,
        title: opening.opening_title || 'Untitled Opening',
        opening_title: opening.opening_title || 'Untitled Opening',

        program_id: opening.program_id || null,
        benefactor_id: program?.benefactor_id || null,

        program_name: program?.program_name || opening.program_name || 'Program',

        benefactor_name:
            benefactor?.benefactor_name ||
            opening.benefactor_name ||
            null,

        benefactor_type: benefactor?.benefactor_type || null,

        description: program?.description || '',
        gwa_threshold: program?.gwa_threshold ?? null,
        renewal_cycle: program?.renewal_cycle || null,
        visibility_status: program?.visibility_status || null,
        program_is_archived: program?.is_archived ?? false,
        benefactor_is_archived: benefactor?.is_archived ?? false,

        academic_year_id: opening.academic_year_id || academicYear?.academic_year_id || null,
        period_id: opening.period_id || period?.period_id || null,
        academic_year: academicYear?.label || null,
        semester: period?.term || null,
        academic_year_label: academicYear?.label || null,
        period_term: period?.term || null,

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
        is_archived: opening.is_archived ?? false,

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
            ['review', 'under review', 'under_review', 'for review'].includes(
                normalizeStatus(app.application_status)
            )
        ).length,
        qualified_count: related.filter((app) =>
            ['qualified', 'approved', 'accepted'].includes(
                normalizeStatus(app.application_status)
            )
        ).length,
        waiting_count: related.filter((app) =>
            ['waiting', 'waitlisted'].includes(normalizeStatus(app.application_status))
        ).length,
        disqualified_count: related.filter((app) =>
            ['disqualified', 'rejected', 'declined'].includes(
                normalizeStatus(app.application_status)
            )
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
            academic_year_id,
            period_id,
            allocated_slots,
            filled_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            created_at,
            updated_at,
            is_archived,
            academic_years (
                academic_year_id,
                label
            ),
            academic_period (
                period_id,
                academic_year_id,
                term,
                is_active
            ),
            scholarship_program (
                program_id,
                benefactor_id,
                program_name,
                description,
                gwa_threshold,
                renewal_cycle,
                visibility_status,
                is_archived,
                created_at,
                updated_at,
                benefactors (
                    benefactor_id,
                    benefactor_name,
                    benefactor_type,
                    description,
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
        'filled',
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
                opening.is_archived !== true &&
                opening.program_is_archived !== true &&
                opening.benefactor_is_archived !== true &&
                ['open', 'filled'].includes(opening.posting_status)
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

    return (openings || [])
        .filter((opening) => opening.is_archived !== true)
        .map((opening) => {
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
            verification_status: 'pending',
            ocr_status: '',
            remarks: '',
            submitted: app.submission_date || null,
            submission_date: app.submission_date || null,
            is_reconsideration_candidate: !!app.is_reconsideration_candidate,
            disqualified: !!app.is_disqualified,
            disqReason: app.disqualification_reason || null,
            is_scholar: ['qualified', 'approved', 'accepted'].includes(
                normalizeStatus(app.application_status)
            ),
        }));
};

exports.createProgramOpening = async (payload = {}) => {
    const {
        program_id,
        opening_title,
        announcement_text,
        period_id,
        academic_year_id,
        allocated_slots,
        filled_slots = 0,
        financial_allocation,
        per_scholar_amount,
        posting_status,
    } = payload;

    if (!program_id) throw new Error('Program ID is required');
    if (!opening_title || !String(opening_title).trim()) throw new Error('Opening title is required');
    if (!period_id) throw new Error('Academic period is required');

    if (toRequiredNumber(allocated_slots, 0) <= 0) {
        throw new Error('Allocated slots must be greater than 0');
    }

    if (toRequiredNumber(filled_slots, 0) > toRequiredNumber(allocated_slots, 0)) {
        throw new Error('Filled slots cannot be greater than allocated slots');
    }

    const resolvedAcademicYearId =
        academic_year_id || (await resolveAcademicYearIdFromPeriod(period_id));

    const insertData = {
        program_id,
        opening_title: String(opening_title).trim(),
        announcement_text: announcement_text ? String(announcement_text).trim() : null,
        period_id,
        academic_year_id: resolvedAcademicYearId,
        allocated_slots: toRequiredNumber(allocated_slots, 0),
        filled_slots: toRequiredNumber(filled_slots, 0),
        financial_allocation: toNullableNumber(financial_allocation),
        per_scholar_amount: toNullableNumber(per_scholar_amount),
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
            academic_year_id,
            period_id,
            allocated_slots,
            filled_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            created_at,
            updated_at,
            is_archived,
            academic_years (
                academic_year_id,
                label
            ),
            academic_period (
                period_id,
                academic_year_id,
                term,
                is_active
            ),
            scholarship_program (
                program_id,
                benefactor_id,
                program_name,
                description,
                gwa_threshold,
                renewal_cycle,
                visibility_status,
                is_archived,
                created_at,
                updated_at,
                benefactors (
                    benefactor_id,
                    benefactor_name,
                    benefactor_type,
                    description,
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
        period_id: payload.period_id ?? existing.period_id,
        academic_year_id: payload.academic_year_id ?? existing.academic_year_id,
        allocated_slots: payload.allocated_slots ?? existing.allocated_slots,
        filled_slots: payload.filled_slots ?? existing.filled_slots ?? 0,
        financial_allocation: payload.financial_allocation ?? existing.financial_allocation,
        per_scholar_amount: payload.per_scholar_amount ?? existing.per_scholar_amount,
        posting_status: payload.posting_status ?? existing.posting_status,
    };

    if (!merged.program_id) throw new Error('Program ID is required');
    if (!merged.opening_title || !String(merged.opening_title).trim()) throw new Error('Opening title is required');
    if (!merged.period_id) throw new Error('Academic period is required');

    const resolvedAcademicYearId =
        merged.academic_year_id || (await resolveAcademicYearIdFromPeriod(merged.period_id));

    const updateData = {
        program_id: merged.program_id,
        opening_title: String(merged.opening_title).trim(),
        announcement_text: merged.announcement_text
            ? String(merged.announcement_text).trim()
            : null,
        period_id: merged.period_id,
        academic_year_id: resolvedAcademicYearId,
        allocated_slots: toRequiredNumber(merged.allocated_slots, 0),
        filled_slots: toRequiredNumber(merged.filled_slots, 0),
        financial_allocation: toNullableNumber(merged.financial_allocation),
        per_scholar_amount: toNullableNumber(merged.per_scholar_amount),
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
            academic_year_id,
            period_id,
            allocated_slots,
            filled_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            created_at,
            updated_at,
            is_archived,
            academic_years (
                academic_year_id,
                label
            ),
            academic_period (
                period_id,
                academic_year_id,
                term,
                is_active
            ),
            scholarship_program (
                program_id,
                benefactor_id,
                program_name,
                description,
                gwa_threshold,
                renewal_cycle,
                visibility_status,
                is_archived,
                created_at,
                updated_at,
                benefactors (
                    benefactor_id,
                    benefactor_name,
                    benefactor_type,
                    description,
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
            is_archived: true,
            updated_at: new Date().toISOString(),
        })
        .eq('opening_id', openingId)
        .select(`
            opening_id,
            program_id,
            opening_title,
            announcement_text,
            academic_year_id,
            period_id,
            allocated_slots,
            filled_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            created_at,
            updated_at,
            is_archived,
            academic_years (
                academic_year_id,
                label
            ),
            academic_period (
                period_id,
                academic_year_id,
                term,
                is_active
            ),
            scholarship_program (
                program_id,
                benefactor_id,
                program_name,
                description,
                gwa_threshold,
                renewal_cycle,
                visibility_status,
                is_archived,
                created_at,
                updated_at,
                benefactors (
                    benefactor_id,
                    benefactor_name,
                    benefactor_type,
                    description,
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

module.exports = {
    fetchAllProgramOpenings: exports.fetchAllProgramOpenings,
    fetchMobileOpenings: exports.fetchMobileOpenings,
    fetchOpeningsApplicationSummary: exports.fetchOpeningsApplicationSummary,
    fetchProgramOpeningById: exports.fetchProgramOpeningById,
    fetchApplicationsByOpeningId: exports.fetchApplicationsByOpeningId,
    createProgramOpening: exports.createProgramOpening,
    updateProgramOpening: exports.updateProgramOpening,
    closeProgramOpening: exports.closeProgramOpening,
};