const supabase = require('../config/supabase');

function toRequiredYear(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        throw new Error(`${fieldName} is required`);
    }

    const num = Number(value);

    if (Number.isNaN(num)) {
        throw new Error(`${fieldName} must be a valid number`);
    }

    return num;
}

function mapAcademicYear(row) {
    return {
        academic_year_id: row.academic_year_id,
        start_year: row.start_year,
        end_year: row.end_year,
        label: row.label || `${row.start_year}-${row.end_year}`,
        is_active: !!row.is_active,
    };
}

async function ensureUniqueRange(startYear, endYear, excludeId = null) {
    let query = supabase
        .from('academic_years')
        .select('academic_year_id')
        .eq('start_year', startYear)
        .eq('end_year', endYear);

    if (excludeId) {
        query = query.neq('academic_year_id', excludeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (data) {
        throw new Error('That academic year already exists');
    }
}

async function deactivateAllAcademicYears() {
    const { error } = await supabase
        .from('academic_years')
        .update({ is_active: false })
        .eq('is_active', true);

    if (error) {
        throw new Error(error.message);
    }
}

exports.getAcademicYears = async () => {
    const { data, error } = await supabase
        .from('academic_years')
        .select(`
            academic_year_id,
            start_year,
            end_year,
            label,
            is_active
        `)
        .order('start_year', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return (data || []).map(mapAcademicYear);
};

exports.createAcademicYear = async (payload = {}) => {
    const startYear = toRequiredYear(payload.start_year, 'Start year');
    const endYear = toRequiredYear(payload.end_year, 'End year');
    const isActive = !!payload.is_active;

    if (endYear !== startYear + 1) {
        throw new Error('End year must be exactly start year + 1');
    }

    await ensureUniqueRange(startYear, endYear);

    if (isActive) {
        await deactivateAllAcademicYears();
    }

    const { data, error } = await supabase
        .from('academic_years')
        .insert([
            {
                start_year: startYear,
                end_year: endYear,
                is_active: isActive,
            },
        ])
        .select(`
            academic_year_id,
            start_year,
            end_year,
            label,
            is_active
        `)
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return mapAcademicYear(data);
};

exports.updateAcademicYear = async (academicYearId, payload = {}) => {
    const { data: existing, error: existingError } = await supabase
        .from('academic_years')
        .select(`
            academic_year_id,
            start_year,
            end_year,
            label,
            is_active
        `)
        .eq('academic_year_id', academicYearId)
        .maybeSingle();

    if (existingError) {
        throw new Error(existingError.message);
    }

    if (!existing) return null;

    const startYear =
        payload.start_year !== undefined
            ? toRequiredYear(payload.start_year, 'Start year')
            : existing.start_year;

    const endYear =
        payload.end_year !== undefined
            ? toRequiredYear(payload.end_year, 'End year')
            : existing.end_year;

    const isActive =
        payload.is_active !== undefined ? !!payload.is_active : !!existing.is_active;

    if (endYear !== startYear + 1) {
        throw new Error('End year must be exactly start year + 1');
    }

    await ensureUniqueRange(startYear, endYear, academicYearId);

    if (isActive) {
        await deactivateAllAcademicYears();
    }

    const { data, error } = await supabase
        .from('academic_years')
        .update({
            start_year: startYear,
            end_year: endYear,
            is_active: isActive,
        })
        .eq('academic_year_id', academicYearId)
        .select(`
            academic_year_id,
            start_year,
            end_year,
            label,
            is_active
        `)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data ? mapAcademicYear(data) : null;
};

exports.activateAcademicYear = async (academicYearId) => {
    const { data: existing, error: existingError } = await supabase
        .from('academic_years')
        .select(`
            academic_year_id,
            start_year,
            end_year,
            label,
            is_active
        `)
        .eq('academic_year_id', academicYearId)
        .maybeSingle();

    if (existingError) {
        throw new Error(existingError.message);
    }

    if (!existing) return null;

    await deactivateAllAcademicYears();

    const { data, error } = await supabase
        .from('academic_years')
        .update({ is_active: true })
        .eq('academic_year_id', academicYearId)
        .select(`
            academic_year_id,
            start_year,
            end_year,
            label,
            is_active
        `)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data ? mapAcademicYear(data) : null;
};