const supabase = require('../config/supabase');

exports.getScholarshipPrograms = async () => {
    const { data, error } = await supabase
        .from('scholarship_programs')
        .select(`
      program_id,
      benefactor_id,
      program_name,
      description,
      gwa_threshold,
      requires_ro,
      renewal_cycle,
      visibility_status,
      is_archived,
      created_at,
      updated_at
    `)
        .order('program_name', { ascending: true });

    if (error) throw new Error(error.message);

    return data || [];
};

exports.createScholarshipProgram = async (payload) => {
    const {
        benefactor_id,
        program_name,
        description,
        gwa_threshold,
        requires_ro,
        renewal_cycle,
        visibility_status,
        is_archived,
    } = payload || {};

    if (!benefactor_id) throw new Error('Benefactor is required');
    if (!program_name || !program_name.trim()) throw new Error('Program name is required');

    const { data, error } = await supabase
        .from('scholarship_programs')
        .insert([
            {
                benefactor_id,
                program_name: program_name.trim(),
                description: description || null,
                gwa_threshold: Number(gwa_threshold || 0),
                requires_ro: !!requires_ro,
                renewal_cycle: renewal_cycle || 'Semester',
                visibility_status: visibility_status || 'Visible',
                is_archived: !!is_archived,
            },
        ])
        .select(`
      program_id,
      benefactor_id,
      program_name,
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

    if ('benefactor_id' in payload) updateData.benefactor_id = payload.benefactor_id;
    if ('program_name' in payload) updateData.program_name = payload.program_name?.trim();
    if ('description' in payload) updateData.description = payload.description || null;
    if ('gwa_threshold' in payload) updateData.gwa_threshold = Number(payload.gwa_threshold || 0);
    if ('requires_ro' in payload) updateData.requires_ro = !!payload.requires_ro;
    if ('renewal_cycle' in payload) updateData.renewal_cycle = payload.renewal_cycle || 'semester';
    if ('visibility_status' in payload) updateData.visibility_status = payload.visibility_status || 'visible';
    if ('is_archived' in payload) updateData.is_archived = !!payload.is_archived;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('scholarship_programs')
        .update(updateData)
        .eq('program_id', programId)
        .select(`
      program_id,
      benefactor_id,
      program_name,
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