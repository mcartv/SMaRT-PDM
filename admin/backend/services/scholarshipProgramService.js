const supabase = require('../config/supabase');

const ALLOWED_TARGET_AUDIENCES = ['Applicants', 'Scholars', 'Both'];
const ALLOWED_RENEWAL_CYCLES = ['Semester', 'Annual', 'None'];
const ALLOWED_VISIBILITY = ['Published', 'Draft'];

function normalizeNullableText(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
}

function normalizeRequiredText(value, fieldName) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        throw new Error(`${fieldName} is required`);
    }
    return trimmed;
}

function normalizeEnum(value, allowed, fallback, fieldName) {
    const normalized = value ?? fallback;
    if (!allowed.includes(normalized)) {
        throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}`);
    }
    return normalized;
}

function normalizeGwaThreshold(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
        throw new Error('GWA threshold must be a valid number or null');
    }

    if (numericValue < 0) {
        throw new Error('GWA threshold cannot be negative');
    }

    return numericValue;
}

function normalizeUuid(value, fieldName) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        throw new Error(`${fieldName} is required`);
    }
    return trimmed;
}

async function ensureBenefactorExists(benefactorId) {
    const { data, error } = await supabase
        .from('benefactors')
        .select(`
            benefactor_id,
            organization_name,
            benefactor_type,
            is_archived
        `)
        .eq('benefactor_id', benefactorId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!data) {
        throw new Error('Selected benefactor does not exist');
    }

    return data;
}

function mapProgramRow(row) {
    return {
        program_id: row.program_id,
        benefactor_id: row.benefactor_id,
        organization_name: row.benefactors?.organization_name || null,
        benefactor_type: row.benefactors?.benefactor_type || null,
        program_name: row.program_name,
        description: row.description,
        target_audience: row.target_audience || 'Applicants',
        gwa_threshold: row.gwa_threshold ?? null,
        renewal_cycle: row.renewal_cycle,
        visibility_status: row.visibility_status,
        is_archived: !!row.is_archived,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

exports.getScholarshipPrograms = async () => {
    const { data, error } = await supabase
        .from('scholarship_program')
        .select(`
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
            benefactors:benefactor_id (
                benefactor_id,
                organization_name,
                benefactor_type,
                is_archived
            )
        `)
        .order('program_name', { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    return (data || []).map(mapProgramRow);
};

exports.createScholarshipProgram = async (payload = {}) => {
    const benefactor_id = normalizeUuid(payload.benefactor_id, 'Benefactor');
    await ensureBenefactorExists(benefactor_id);

    const insertPayload = {
        benefactor_id,
        program_name: normalizeRequiredText(payload.program_name, 'Program name'),
        description: normalizeNullableText(payload.description),
        target_audience: normalizeEnum(
            payload.target_audience,
            ALLOWED_TARGET_AUDIENCES,
            'Applicants',
            'Target audience'
        ),
        gwa_threshold: normalizeGwaThreshold(payload.gwa_threshold),
        renewal_cycle: normalizeEnum(
            payload.renewal_cycle,
            ALLOWED_RENEWAL_CYCLES,
            'Semester',
            'Renewal cycle'
        ),
        visibility_status: normalizeEnum(
            payload.visibility_status,
            ALLOWED_VISIBILITY,
            'Published',
            'Visibility status'
        ),
        is_archived: !!payload.is_archived,
    };

    const { data, error } = await supabase
        .from('scholarship_program')
        .insert([insertPayload])
        .select(`
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
            benefactors:benefactor_id (
                benefactor_id,
                organization_name,
                benefactor_type,
                is_archived
            )
        `)
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return mapProgramRow(data);
};

exports.updateScholarshipProgram = async (programId, payload = {}) => {
    if (!programId) {
        throw new Error('Program ID is required');
    }

    const updateData = {};

    if ('benefactor_id' in payload) {
        const benefactor_id = normalizeUuid(payload.benefactor_id, 'Benefactor');
        await ensureBenefactorExists(benefactor_id);
        updateData.benefactor_id = benefactor_id;
    }

    if ('program_name' in payload) {
        updateData.program_name = normalizeRequiredText(
            payload.program_name,
            'Program name'
        );
    }

    if ('description' in payload) {
        updateData.description = normalizeNullableText(payload.description);
    }

    if ('target_audience' in payload) {
        updateData.target_audience = normalizeEnum(
            payload.target_audience,
            ALLOWED_TARGET_AUDIENCES,
            'Applicants',
            'Target audience'
        );
    }

    if ('gwa_threshold' in payload) {
        updateData.gwa_threshold = normalizeGwaThreshold(payload.gwa_threshold);
    }

    if ('renewal_cycle' in payload) {
        updateData.renewal_cycle = normalizeEnum(
            payload.renewal_cycle,
            ALLOWED_RENEWAL_CYCLES,
            'Semester',
            'Renewal cycle'
        );
    }

    if ('visibility_status' in payload) {
        updateData.visibility_status = normalizeEnum(
            payload.visibility_status,
            ALLOWED_VISIBILITY,
            'Published',
            'Visibility status'
        );
    }

    if ('is_archived' in payload) {
        updateData.is_archived = !!payload.is_archived;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('scholarship_program')
        .update(updateData)
        .eq('program_id', programId)
        .select(`
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
            benefactors:benefactor_id (
                benefactor_id,
                organization_name,
                benefactor_type,
                is_archived
            )
        `)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data ? mapProgramRow(data) : null;
};