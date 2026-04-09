const supabase = require('../config/supabase');

function normalizeStatus(value) {
    return (value || '').toString().trim().toLowerCase();
}

function mapOpening(opening, counts = {}) {
    const postingStatus = normalizeStatus(opening.posting_status || 'draft');
    const allocatedSlot = Number(opening.allocated_slots || 0);
    const qualifiedCount = Number(counts.qualified_count || 0);

    let derivedStatus = postingStatus;
    if (allocatedSlot > 0 && qualifiedCount >= allocatedSlot && postingStatus === 'open') {
        derivedStatus = 'filled';
    }

    return {
        opening_id: opening.opening_id,
        title: opening.opening_title || 'Untitled Opening',
        opening_title: opening.opening_title || 'Untitled Opening',

        program_id: opening.program_id || null,
        program_name: 'Program',
        benefactor_name: null,

        application_start: opening.application_start || null,
        application_end: opening.application_end || null,
        screening_start: opening.screening_start || null,
        screening_end: opening.screening_end || null,

        allocated_slots: allocatedSlot,
        financial_allocation: opening.financial_allocation ?? null,
        per_scholar_amount: opening.per_scholar_amount ?? null,
        posting_status: opening.posting_status || 'draft',
        announcement_text: opening.announcement_text || '',
        created_at: opening.created_at || null,
        updated_at: opening.updated_at || null,

        application_count: Number(counts.application_count || 0),
        pending_count: Number(counts.pending_count || 0),
        review_count: Number(counts.review_count || 0),
        qualified_count: qualifiedCount,
        waiting_count: Number(counts.waiting_count || 0),
        disqualified_count: Number(counts.disqualified_count || 0),

        // frontend compatibility
        slot_count: allocatedSlot,
        start_date: opening.application_start || null,
        end_date: opening.application_end || null,
        status: derivedStatus,
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
        review_count: related.filter(
            (app) => normalizeStatus(app.application_status) === 'review'
        ).length,
        qualified_count: related.filter(
            (app) => normalizeStatus(app.application_status) === 'qualified'
        ).length,
        waiting_count: related.filter(
            (app) => normalizeStatus(app.application_status) === 'waiting'
        ).length,
        disqualified_count: related.filter(
            (app) => normalizeStatus(app.application_status) === 'disqualified'
        ).length,
    };
}

exports.fetchAllProgramOpenings = async () => {
    const { data, error } = await supabase
        .from('program_openings')
        .select(`
            opening_id,
            program_id,
            opening_title,
            application_start,
            application_end,
            screening_start,
            screening_end,
            allocated_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            announcement_text,
            created_at,
            updated_at
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('SUPABASE FETCH ALL PROGRAM OPENINGS ERROR:', error);
        throw new Error(error.message);
    }

    return (data || []).map((opening) => mapOpening(opening));
};

exports.fetchMobileOpenings = async () => {
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('program_openings')
        .select(`
            opening_id,
            program_id,
            opening_title,
            application_start,
            application_end,
            screening_start,
            screening_end,
            allocated_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            announcement_text,
            created_at,
            updated_at
        `)
        .eq('posting_status', 'open')
        .lte('application_start', now)
        .gte('application_end', now)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('SUPABASE FETCH MOBILE OPENINGS ERROR:', error);
        throw new Error(error.message);
    }

    return (data || []).map((opening) => mapOpening(opening));
};

exports.fetchOpeningsApplicationSummary = async () => {
    const { data: openings, error: openingsError } = await supabase
        .from('program_openings')
        .select(`
            opening_id,
            program_id,
            opening_title,
            application_start,
            application_end,
            screening_start,
            screening_end,
            allocated_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            announcement_text,
            created_at,
            updated_at
        `)
        .order('created_at', { ascending: false });

    if (openingsError) {
        console.error('PROGRAM OPENING SUMMARY - OPENINGS ERROR:', openingsError);
        throw new Error(openingsError.message);
    }

    const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select(`
            application_id,
            opening_id,
            application_status,
            is_archived
        `);

    if (applicationsError) {
        console.error('PROGRAM OPENING SUMMARY - APPLICATIONS ERROR:', applicationsError);
        throw new Error(applicationsError.message);
    }

    return (openings || []).map((opening) => {
        const counts = buildCounts(opening, applications || []);
        return mapOpening(opening, counts);
    });
};

exports.fetchProgramOpeningById = async (openingId) => {
    const { data: opening, error: openingError } = await supabase
        .from('program_openings')
        .select(`
            opening_id,
            program_id,
            opening_title,
            application_start,
            application_end,
            screening_start,
            screening_end,
            allocated_slots,
            financial_allocation,
            per_scholar_amount,
            posting_status,
            announcement_text,
            created_at,
            updated_at
        `)
        .eq('opening_id', openingId)
        .maybeSingle();

    if (openingError) {
        console.error('PROGRAM OPENING BY ID ERROR:', openingError);
        throw new Error(openingError.message);
    }

    if (!opening) return null;

    const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select(`
            application_id,
            opening_id,
            application_status,
            is_archived
        `)
        .eq('opening_id', openingId);

    if (applicationsError) {
        console.error('PROGRAM OPENING BY ID APPLICATIONS ERROR:', applicationsError);
        throw new Error(applicationsError.message);
    }

    const counts = buildCounts(opening, applications || []);
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
            ocr_status,
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
            ocr_status: normalizeStatus(app.ocr_status || ''),
            remarks: app.remarks || '',
            submitted: app.submission_date || null,
            submission_date: app.submission_date || null,
            is_reconsideration_candidate: !!app.is_reconsideration_candidate,
            disqualified: !!app.is_disqualified,
            disqReason: app.disqualification_reason || null,
            is_scholar: false,
        }));
};

exports.createProgramOpening = async (payload) => {
    const {
        program_id,
        opening_title,
        application_start,
        application_end,
        screening_start,
        screening_end,
        allocated_slots,
        financial_allocation,
        per_scholar_amount,
        posting_status = 'draft',
        announcement_text,
    } = payload;

    const { data, error } = await supabase
        .from('program_openings')
        .insert([
            {
                program_id,
                opening_title,
                application_start,
                application_end,
                screening_start,
                screening_end,
                allocated_slots,
                financial_allocation: financial_allocation ?? null,
                per_scholar_amount: per_scholar_amount ?? null,
                posting_status,
                announcement_text: announcement_text || null,
            },
        ])
        .select()
        .single();

    if (error) {
        console.error('SUPABASE CREATE PROGRAM OPENING ERROR:', error);
        throw new Error(error.message);
    }

    return data;
};

exports.updateProgramOpening = async (openingId, payload) => {
    const {
        program_id,
        opening_title,
        application_start,
        application_end,
        screening_start,
        screening_end,
        allocated_slots,
        financial_allocation,
        per_scholar_amount,
        posting_status,
        announcement_text,
    } = payload;

    const { data, error } = await supabase
        .from('program_openings')
        .update({
            program_id,
            opening_title,
            application_start,
            application_end,
            screening_start,
            screening_end,
            allocated_slots,
            financial_allocation: financial_allocation ?? null,
            per_scholar_amount: per_scholar_amount ?? null,
            posting_status,
            announcement_text: announcement_text || null,
            updated_at: new Date().toISOString(),
        })
        .eq('opening_id', openingId)
        .select()
        .maybeSingle();

    if (error) {
        console.error('SUPABASE UPDATE PROGRAM OPENING ERROR:', error);
        throw new Error(error.message);
    }

    return data || null;
};

exports.closeProgramOpening = async (openingId) => {
    const { data, error } = await supabase
        .from('program_openings')
        .update({
            posting_status: 'closed',
            updated_at: new Date().toISOString(),
        })
        .eq('opening_id', openingId)
        .select()
        .maybeSingle();

    if (error) {
        console.error('SUPABASE CLOSE PROGRAM OPENING ERROR:', error);
        throw new Error(error.message);
    }

    return data || null;
};