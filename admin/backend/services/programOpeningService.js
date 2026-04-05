const supabase = require('../config/supabase');

async function getBenefactorMap() {
    const { data, error } = await supabase
        .from('benefactors')
        .select('benefactor_id, organization_name');

    if (error) throw new Error(error.message);

    const map = new Map();
    (data || []).forEach((row) => {
        map.set(row.benefactor_id, row.organization_name);
    });

    return map;
}

exports.getProgramOpenings = async () => {
    const benefactorMap = await getBenefactorMap();

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
      scholarship_programs (
        program_id,
        program_name,
        benefactor_id
      )
    `)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((row) => ({
        opening_id: row.opening_id,
        program_id: row.program_id,
        program_name: row.scholarship_programs?.program_name || 'Unknown Program',
        benefactor_name:
            benefactorMap.get(row.scholarship_programs?.benefactor_id) || 'Unknown Benefactor',
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
        posting_status,
        announcement_text,
    } = payload || {};

    if (!program_id) throw new Error('Program is required');
    if (!opening_title || !opening_title.trim()) throw new Error('Opening title is required');
    if (!application_start) throw new Error('Application start date is required');
    if (!application_end) throw new Error('Application end date is required');

    const normalizedStatus = String(posting_status || 'draft').toLowerCase();

    // prevent duplicate draft rows for the same program
    if (normalizedStatus === 'draft') {
        const { data: existingDraft, error: existingDraftError } = await supabase
            .from('program_openings')
            .select('opening_id')
            .eq('program_id', program_id)
            .eq('posting_status', 'draft')
            .limit(1)
            .maybeSingle();

        if (existingDraftError) throw new Error(existingDraftError.message);

        if (existingDraft?.opening_id) {
            throw new Error('A draft opening already exists for this program. Please continue editing the existing draft.');
        }
    }

    const insertPayload = {
        program_id,
        opening_title: opening_title.trim(),
        application_start,
        application_end,
        screening_start: screening_start || null,
        screening_end: screening_end || null,
        allocated_slots: Number(allocated_slots || 0),
        financial_allocation: Number(financial_allocation || 0),
        posting_status: normalizedStatus,
        announcement_text: announcement_text || null,
    };

    const { data, error } = await supabase
        .from('program_openings')
        .insert([insertPayload])
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

    return data;
};

exports.updateProgramOpening = async (openingId, payload) => {
    if (!openingId) throw new Error('Opening ID is required');

    const updateData = {};

    if ('program_id' in payload) updateData.program_id = payload.program_id;
    if ('opening_title' in payload) updateData.opening_title = payload.opening_title?.trim();
    if ('application_start' in payload) updateData.application_start = payload.application_start || null;
    if ('application_end' in payload) updateData.application_end = payload.application_end || null;
    if ('screening_start' in payload) updateData.screening_start = payload.screening_start || null;
    if ('screening_end' in payload) updateData.screening_end = payload.screening_end || null;
    if ('allocated_slots' in payload) updateData.allocated_slots = Number(payload.allocated_slots || 0);
    if ('financial_allocation' in payload) updateData.financial_allocation = Number(payload.financial_allocation || 0);
    if ('posting_status' in payload) updateData.posting_status = String(payload.posting_status || 'draft').toLowerCase();
    if ('announcement_text' in payload) updateData.announcement_text = payload.announcement_text || null;

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

    return data;
};