const supabase = require('../config/supabase');

exports.getBenefactors = async () => {
    const { data, error } = await supabase
        .from('benefactors')
        .select(`
      benefactor_id,
      organization_name,
      is_archived
    `)
        .eq('is_archived', false)
        .order('organization_name', { ascending: true });

    if (error) throw new Error(error.message);

    return data || [];
};