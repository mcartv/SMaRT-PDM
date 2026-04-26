const supabase = require('../config/supabase');

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeRequiredHours(value) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed < 0) {
        throw createHttpError(400, 'Required hours must be a valid non-negative number.');
    }

    return parsed;
}

async function getSettings() {
    const { data, error } = await supabase
        .from('ro_settings')
        .select(`
      setting_id,
      academic_year_id,
      period_id,
      required_hours,
      is_active,
      allow_carry_over,
      remarks,
      created_at,
      updated_at,
      academic_years (
        academic_year_id,
        label,
        start_year,
        end_year
      ),
      academic_period (
        period_id,
        term
      )
    `)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return {
        items: data || [],
    };
}

async function getActiveSetting() {
    const { data, error } = await supabase
        .from('ro_settings')
        .select(`
      setting_id,
      academic_year_id,
      period_id,
      required_hours,
      is_active,
      allow_carry_over,
      remarks,
      created_at,
      updated_at,
      academic_years (
        academic_year_id,
        label,
        start_year,
        end_year
      ),
      academic_period (
        period_id,
        term
      )
    `)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    return {
        setting: data || {
            setting_id: null,
            academic_year_id: null,
            period_id: null,
            required_hours: 20,
            is_active: true,
            allow_carry_over: true,
            remarks: 'Default RO setting',
        },
    };
}

async function createSetting(body = {}) {
    const requiredHours = normalizeRequiredHours(body.required_hours ?? body.requiredHours ?? 20);

    const payload = {
        academic_year_id: safeText(body.academic_year_id || body.academicYearId) || null,
        period_id: safeText(body.period_id || body.periodId) || null,
        required_hours: requiredHours,
        is_active: body.is_active === true || body.isActive === true,
        allow_carry_over: body.allow_carry_over !== false && body.allowCarryOver !== false,
        remarks: safeText(body.remarks) || null,
    };

    if (payload.is_active) {
        await supabase
            .from('ro_settings')
            .update({ is_active: false })
            .eq('is_active', true);
    }

    const { data, error } = await supabase
        .from('ro_settings')
        .insert(payload)
        .select('*')
        .single();

    if (error) throw error;

    return {
        message: 'RO setting created successfully.',
        setting: data,
    };
}

async function updateSetting(settingId, body = {}) {
    if (!settingId) {
        throw createHttpError(400, 'settingId is required.');
    }

    const updatePayload = {};

    if (body.academic_year_id !== undefined || body.academicYearId !== undefined) {
        updatePayload.academic_year_id =
            safeText(body.academic_year_id || body.academicYearId) || null;
    }

    if (body.period_id !== undefined || body.periodId !== undefined) {
        updatePayload.period_id = safeText(body.period_id || body.periodId) || null;
    }

    if (body.required_hours !== undefined || body.requiredHours !== undefined) {
        updatePayload.required_hours = normalizeRequiredHours(
            body.required_hours ?? body.requiredHours
        );
    }

    if (body.allow_carry_over !== undefined || body.allowCarryOver !== undefined) {
        updatePayload.allow_carry_over =
            body.allow_carry_over !== false && body.allowCarryOver !== false;
    }

    if (body.remarks !== undefined) {
        updatePayload.remarks = safeText(body.remarks) || null;
    }

    const { data, error } = await supabase
        .from('ro_settings')
        .update(updatePayload)
        .eq('setting_id', settingId)
        .select('*')
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw createHttpError(404, 'RO setting not found.');
    }

    return {
        message: 'RO setting updated successfully.',
        setting: data,
    };
}

async function activateSetting(settingId) {
    if (!settingId) {
        throw createHttpError(400, 'settingId is required.');
    }

    const { data: existing, error: existingError } = await supabase
        .from('ro_settings')
        .select('setting_id')
        .eq('setting_id', settingId)
        .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
        throw createHttpError(404, 'RO setting not found.');
    }

    const { error: deactivateError } = await supabase
        .from('ro_settings')
        .update({ is_active: false })
        .eq('is_active', true);

    if (deactivateError) throw deactivateError;

    const { data, error } = await supabase
        .from('ro_settings')
        .update({ is_active: true })
        .eq('setting_id', settingId)
        .select('*')
        .single();

    if (error) throw error;

    return {
        message: 'RO setting activated successfully.',
        setting: data,
    };
}

async function getDepartments() {
    const { data, error } = await supabase
        .from('ro_departments')
        .select('department_id, department_name, is_active, created_at, updated_at')
        .order('department_name', { ascending: true });

    if (error) throw error;

    return {
        items: data || [],
    };
}

async function createDepartment(body = {}) {
    const departmentName = safeText(body.department_name || body.departmentName);

    if (!departmentName) {
        throw createHttpError(400, 'Department name is required.');
    }

    const { data, error } = await supabase
        .from('ro_departments')
        .insert({
            department_name: departmentName,
            is_active: body.is_active !== false && body.isActive !== false,
        })
        .select('*')
        .single();

    if (error) throw error;

    return {
        message: 'RO department created successfully.',
        department: data,
    };
}

async function updateDepartment(departmentId, body = {}) {
    if (!departmentId) {
        throw createHttpError(400, 'departmentId is required.');
    }

    const departmentName = safeText(body.department_name || body.departmentName);

    if (!departmentName) {
        throw createHttpError(400, 'Department name is required.');
    }

    const { data, error } = await supabase
        .from('ro_departments')
        .update({
            department_name: departmentName,
        })
        .eq('department_id', departmentId)
        .select('*')
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw createHttpError(404, 'RO department not found.');
    }

    return {
        message: 'RO department updated successfully.',
        department: data,
    };
}

async function toggleDepartment(departmentId) {
    if (!departmentId) {
        throw createHttpError(400, 'departmentId is required.');
    }

    const { data: existing, error: existingError } = await supabase
        .from('ro_departments')
        .select('department_id, is_active')
        .eq('department_id', departmentId)
        .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
        throw createHttpError(404, 'RO department not found.');
    }

    const { data, error } = await supabase
        .from('ro_departments')
        .update({
            is_active: !existing.is_active,
        })
        .eq('department_id', departmentId)
        .select('*')
        .single();

    if (error) throw error;

    return {
        message: 'RO department status updated successfully.',
        department: data,
    };
}

module.exports = {
    getSettings,
    getActiveSetting,
    createSetting,
    updateSetting,
    activateSetting,
    getDepartments,
    createDepartment,
    updateDepartment,
    toggleDepartment
};