const supabase = require('../config/supabase');

exports.getScholarshipPrograms = async () => {
    const { data, error } = await supabase
        .from('scholarship_program')
        .select(`
      program_id,
      benefactor_type,
      organization_name,
      program_name,
      memorandum_url,
      description,
      gwa_threshold,
      requires_ro,
      renewal_cycle,
      visibility_status,
      is_archived,
      created_at,
      updated_at
    `)
        .order('organization_name', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
};

exports.createScholarshipProgram = async (payload) => {
    const {
        benefactor_type,
        organization_name,
        program_name,
        memorandum_url,
        description,
        gwa_threshold,
        requires_ro,
        renewal_cycle,
        visibility_status,
        is_archived,
    } = payload || {};

    if (!benefactor_type || !['Public', 'Private'].includes(benefactor_type)) {
        throw new Error('Benefactor type must be Public or Private');
    }

    if (!organization_name || !organization_name.trim()) {
        throw new Error('Organization name is required');
    }

    if (!program_name || !program_name.trim()) {
        throw new Error('Program name is required');
    }

    const normalizedRenewal = renewal_cycle || 'Semester';
    const normalizedVisibility = visibility_status || 'Published';

    const { data, error } = await supabase
        .from('scholarship_program')
        .insert([{
            benefactor_type,
            organization_name: organization_name.trim(),
            program_name: program_name.trim(),
            memorandum_url: memorandum_url || null,
            description: description || null,
            gwa_threshold: Number(gwa_threshold || 0),
            requires_ro: !!requires_ro,
            renewal_cycle: normalizedRenewal,
            visibility_status: normalizedVisibility,
            is_archived: !!is_archived,
        }])
        .select(`
      program_id,
      benefactor_type,
      organization_name,
      program_name,
      memorandum_url,
      description,
      gwa_threshold,
      requires_ro,
      renewal_cycle,
      visibility_status,
      is_archived,
      created_at,
      updated_at
    `)
        .single();

    if (error) throw new Error(error.message);
    return data;
};

exports.updateScholarshipProgram = async (programId, payload) => {
    if (!programId) throw new Error('Program ID is required');

    const updateData = {};

    if ('benefactor_type' in payload) updateData.benefactor_type = payload.benefactor_type;
    if ('organization_name' in payload) updateData.organization_name = payload.organization_name?.trim();
    if ('program_name' in payload) updateData.program_name = payload.program_name?.trim();
    if ('memorandum_url' in payload) updateData.memorandum_url = payload.memorandum_url || null;
    if ('description' in payload) updateData.description = payload.description || null;
    if ('gwa_threshold' in payload) updateData.gwa_threshold = Number(payload.gwa_threshold || 0);
    if ('requires_ro' in payload) updateData.requires_ro = !!payload.requires_ro;
    if ('renewal_cycle' in payload) updateData.renewal_cycle = payload.renewal_cycle || 'Semester';
    if ('visibility_status' in payload) updateData.visibility_status = payload.visibility_status || 'Published';
    if ('is_archived' in payload) updateData.is_archived = !!payload.is_archived;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('scholarship_program')
        .update(updateData)
        .eq('program_id', programId)
        .select(`
      program_id,
      benefactor_type,
      organization_name,
      program_name,
      memorandum_url,
      description,
      gwa_threshold,
      requires_ro,
      renewal_cycle,
      visibility_status,
      is_archived,
      created_at,
      updated_at
    `)
        .single();

    if (error) throw new Error(error.message);
    return data;
};