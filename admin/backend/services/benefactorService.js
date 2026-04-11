const supabase = require('../config/supabase');

const ALLOWED_BENEFACTOR_TYPES = ['Public', 'Private'];

function normalizeRequiredText(value, fieldName) {
    const trimmed = String(value || '').trim();

    if (!trimmed) {
        throw new Error(`${fieldName} is required`);
    }

    return trimmed;
}

function normalizeNullableText(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
}

function normalizeEnum(value, allowed, fallback, fieldName) {
    const normalized = value ?? fallback;

    if (!allowed.includes(normalized)) {
        throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}`);
    }

    return normalized;
}

function mapBenefactorRow(row) {
    return {
        benefactor_id: row.benefactor_id,
        benefactor_name: row.benefactor_name,
        benefactor_type: row.benefactor_type,
        description: row.description,
        is_archived: !!row.is_archived,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

exports.getBenefactors = async () => {
    const { data, error } = await supabase
        .from('benefactors')
        .select(`
            benefactor_id,
            benefactor_name,
            benefactor_type,
            description,
            is_archived,
            created_at,
            updated_at
        `)
        .order('benefactor_name', { ascending: true });

    if (error) {
        console.error('SUPABASE GET BENEFACTORS ERROR:', error);
        throw new Error(error.message);
    }

    return (data || []).map(mapBenefactorRow);
};

exports.createBenefactor = async (payload = {}) => {
    const insertData = {
        benefactor_name: normalizeRequiredText(
            payload.benefactor_name,
            'Benefactor name'
        ),
        benefactor_type: normalizeEnum(
            payload.benefactor_type,
            ALLOWED_BENEFACTOR_TYPES,
            null,
            'Benefactor type'
        ),
        description: normalizeNullableText(payload.description),
        is_archived: !!payload.is_archived,
    };

    const { data, error } = await supabase
        .from('benefactors')
        .insert([insertData])
        .select(`
            benefactor_id,
            benefactor_name,
            benefactor_type,
            description,
            is_archived,
            created_at,
            updated_at
        `)
        .single();

    if (error) {
        console.error('SUPABASE CREATE BENEFACTOR ERROR:', error);
        throw new Error(error.message);
    }

    return mapBenefactorRow(data);
};

exports.updateBenefactor = async (benefactorId, payload = {}) => {
    if (!benefactorId) {
        throw new Error('Benefactor ID is required');
    }

    const updateData = {};

    if ('benefactor_name' in payload) {
        updateData.benefactor_name = normalizeRequiredText(
            payload.benefactor_name,
            'Benefactor name'
        );
    }

    if ('benefactor_type' in payload) {
        updateData.benefactor_type = normalizeEnum(
            payload.benefactor_type,
            ALLOWED_BENEFACTOR_TYPES,
            null,
            'Benefactor type'
        );
    }

    if ('description' in payload) {
        updateData.description = normalizeNullableText(payload.description);
    }

    if ('is_archived' in payload) {
        updateData.is_archived = !!payload.is_archived;
    }

    if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields provided for update');
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('benefactors')
        .update(updateData)
        .eq('benefactor_id', benefactorId)
        .select(`
            benefactor_id,
            benefactor_name,
            benefactor_type,
            description,
            is_archived,
            created_at,
            updated_at
        `)
        .maybeSingle();

    if (error) {
        console.error('SUPABASE UPDATE BENEFACTOR ERROR:', error);
        throw new Error(error.message);
    }

    return data ? mapBenefactorRow(data) : null;
};

module.exports = {
    getBenefactors: exports.getBenefactors,
    createBenefactor: exports.createBenefactor,
    updateBenefactor: exports.updateBenefactor,
};