const supabase = require('../config/supabase');
const notificationService = require('./notificationService');

function getTodayLocalISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60 * 1000);
    return local.toISOString().split('T')[0];
}

function deriveOpeningStatus(payload, existingStatus = '') {
    const normalizedExisting = String(existingStatus || '').toLowerCase();

    // archived stays manual
    if (normalizedExisting === 'archived') {
        return 'archived';
    }

    const today = getTodayLocalISO();

    const hasRequiredFields =
        !!payload.opening_title &&
        !!payload.application_start &&
        !!payload.application_end;

    if (!hasRequiredFields) return 'draft';

    if (payload.application_end < today) return 'closed';

    return 'open';
}

async function createOpeningNotifications(openingRow) {
    if (!openingRow?.opening_id) {
        return 0;
    }

    const { data: existingNotification, error: lookupError } = await supabase
        .from('notifications')
        .select('notification_id')
        .eq('reference_id', openingRow.opening_id)
        .eq('reference_type', 'program_opening')
        .limit(1)
        .maybeSingle();

    if (lookupError) {
        throw new Error(lookupError.message);
    }

    if (existingNotification?.notification_id) {
        return 0;
    }

    const rows = await notificationService.createNotificationsForAudience({
        audience: 'all',
        title: openingRow.opening_title,
        message:
            openingRow.announcement_text ||
            `${openingRow.opening_title} is now open for scholarship applications.`,
        referenceId: openingRow.opening_id,
        referenceType: 'program_opening',
        type: 'Opening',
        createdAt: openingRow.updated_at || openingRow.created_at || new Date().toISOString(),
    });

    return rows.length;
}

exports.getProgramOpenings = async () => {
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
            posting_status,
            announcement_text,
            created_at,
            updated_at,
            scholarship_program (
                program_id,
                organization_name,
                program_name
            )
        `)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((row) => ({
        opening_id: row.opening_id,
        program_id: row.program_id,
        benefactor_name: row.scholarship_program?.organization_name || 'Unknown Organization',
        program_name: row.scholarship_program?.program_name || 'Unknown Program',
        opening_title: row.opening_title,
        application_start: row.application_start,
        application_end: row.application_end,
        screening_start: row.screening_start,
        screening_end: row.screening_end,
        allocated_slots: row.allocated_slots,
        financial_allocation: row.financial_allocation,
        posting_status: row.posting_status,
        announcement_text: row.announcement_text,
        applicant_count: 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
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
        announcement_text,
    } = payload || {};

    if (!program_id) throw new Error('Program is required');

    const normalizedPayload = {
        program_id,
        opening_title: opening_title?.trim() || '',
        application_start: application_start || null,
        application_end: application_end || null,
        screening_start: screening_start || null,
        screening_end: screening_end || null,
        allocated_slots: Number(allocated_slots || 0),
        financial_allocation: Number(financial_allocation || 0),
        announcement_text: announcement_text || null,
    };

    const derivedStatus = deriveOpeningStatus(normalizedPayload);

    const finalPayload = {
        ...normalizedPayload,
        posting_status: derivedStatus,
    };

    // only dedupe/update when it's still a draft
    if (derivedStatus === 'draft') {
        const { data: existingDraft, error: existingDraftError } = await supabase
            .from('program_openings')
            .select('opening_id')
            .eq('program_id', program_id)
            .eq('posting_status', 'draft')
            .limit(1)
            .maybeSingle();

        if (existingDraftError) throw new Error(existingDraftError.message);

        if (existingDraft?.opening_id) {
            const { data: updatedDraft, error: updateError } = await supabase
                .from('program_openings')
                .update({
                    ...finalPayload,
                    updated_at: new Date().toISOString(),
                })
                .eq('opening_id', existingDraft.opening_id)
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
                    posting_status,
                    announcement_text,
                    created_at,
                    updated_at
                `)
                .single();

            if (updateError) throw new Error(updateError.message);
            return updatedDraft;
        }
    }

    const { data, error } = await supabase
        .from('program_openings')
        .insert([finalPayload])
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
            posting_status,
            announcement_text,
            created_at,
            updated_at
        `)
        .single();

    if (error) throw new Error(error.message);

    if ((data.posting_status || '').toLowerCase() === 'open') {
        await createOpeningNotifications(data);
    }

    return data;
};

exports.updateProgramOpening = async (openingId, payload) => {
    if (!openingId) throw new Error('Opening ID is required');

    const { data: existingOpening, error: existingError } = await supabase
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
            posting_status,
            announcement_text
        `)
        .eq('opening_id', openingId)
        .single();

    if (existingError) throw new Error(existingError.message);

    const updateData = {
        program_id: 'program_id' in payload ? payload.program_id : existingOpening.program_id,
        opening_title: 'opening_title' in payload ? (payload.opening_title?.trim() || '') : existingOpening.opening_title,
        application_start: 'application_start' in payload ? (payload.application_start || null) : existingOpening.application_start,
        application_end: 'application_end' in payload ? (payload.application_end || null) : existingOpening.application_end,
        screening_start: 'screening_start' in payload ? (payload.screening_start || null) : existingOpening.screening_start,
        screening_end: 'screening_end' in payload ? (payload.screening_end || null) : existingOpening.screening_end,
        allocated_slots: 'allocated_slots' in payload ? Number(payload.allocated_slots || 0) : Number(existingOpening.allocated_slots || 0),
        financial_allocation: 'financial_allocation' in payload ? Number(payload.financial_allocation || 0) : Number(existingOpening.financial_allocation || 0),
        announcement_text: 'announcement_text' in payload ? (payload.announcement_text || null) : existingOpening.announcement_text,
    };

    // only archive manually
    if ('posting_status' in payload && String(payload.posting_status).toLowerCase() === 'archived') {
        updateData.posting_status = 'archived';
    } else {
        updateData.posting_status = deriveOpeningStatus(updateData, existingOpening.posting_status);
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('program_openings')
        .update(updateData)
        .eq('opening_id', openingId)
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
            posting_status,
            announcement_text,
            created_at,
            updated_at
        `)
        .single();

    if (error) throw new Error(error.message);

    if (
        (data.posting_status || '').toLowerCase() === 'open' &&
        (existingOpening.posting_status || '').toLowerCase() !== 'open'
    ) {
        await createOpeningNotifications(data);
    }

    return data;
};
