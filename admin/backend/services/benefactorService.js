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

const BENEFACTOR_SELECT = `
    benefactor_id,
    benefactor_name,
    benefactor_type,
    description,
    is_archived,
    created_at,
    updated_at
`;

async function getBenefactors() {
    const { data, error } = await supabase
        .from('benefactors')
        .select(BENEFACTOR_SELECT)
        .order('benefactor_name', { ascending: true });

    if (error) {
        console.error('SUPABASE GET BENEFACTORS ERROR:', error);
        throw new Error(error.message);
    }

    return (data || []).map(mapBenefactorRow);
}

async function getPublicBenefactors() {
    const benefactors = await getBenefactors();
    return benefactors.filter((item) => item.is_archived !== true);
}

async function createBenefactor(payload = {}) {
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
        .select(BENEFACTOR_SELECT)
        .single();

    if (error) {
        console.error('SUPABASE CREATE BENEFACTOR ERROR:', error);
        throw new Error(error.message);
    }

    return mapBenefactorRow(data);
}

async function updateBenefactor(benefactorId, payload = {}) {
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
        .select(BENEFACTOR_SELECT)
        .maybeSingle();

    if (error) {
        console.error('SUPABASE UPDATE BENEFACTOR ERROR:', error);
        throw new Error(error.message);
    }

    return data ? mapBenefactorRow(data) : null;
}

async function deleteBenefactor(benefactorId) {
    if (!benefactorId) {
        throw new Error('Benefactor ID is required');
    }

    const { error } = await supabase
        .from('benefactors')
        .delete()
        .eq('benefactor_id', benefactorId);

    if (error) {
        console.error('SUPABASE DELETE BENEFACTOR ROLLBACK ERROR:', error);
        throw new Error(error.message);
    }

    return true;
}

module.exports = {
    getBenefactors,
    getPublicBenefactors,
    createBenefactor,
    updateBenefactor,
    deleteBenefactor,
};
