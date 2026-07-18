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

function getSettingPayload(setting = {}) {
    return {
        setting_id: setting.setting_id || null,
        academic_year_id: setting.academic_year_id || null,
        period_id: setting.period_id || null,
        required_hours: Number(setting.required_hours || 20),
        is_active: setting.is_active === true,
        allow_carry_over: setting.allow_carry_over !== false,
        remarks: setting.remarks || null,
        created_at: setting.created_at || null,
        updated_at: setting.updated_at || null,
        academic_years: setting.academic_years || null,
        academic_period: setting.academic_period || null,
    };
}

function getDepartmentPayload(department = {}) {
    return {
        department_id: department.department_id || null,
        department_name: department.department_name || '',
        is_active: department.is_active === true,
        created_at: department.created_at || null,
        updated_at: department.updated_at || null,
    };
}

async function fetchSettingById(settingId) {
    if (!settingId) {
        throw createHttpError(400, 'settingId is required.');
    }

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
        .eq('setting_id', settingId)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw createHttpError(404, 'RO setting not found.');
    }

    return data;
}

async function fetchActiveSettingRow() {
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

    return data;
}

async function deactivateAllSettings() {
    const { error } = await supabase
        .from('ro_settings')
        .update({ is_active: false })
        .eq('is_active', true);

    if (error) throw error;
}

async function applySettingToPendingRoRecords(setting) {
    if (!setting?.setting_id) {
        throw createHttpError(400, 'RO setting is required.');
    }

    const { data, error } = await supabase
        .from('return_of_obligations')
        .update({
            setting_id: setting.setting_id,
            required_hours: Number(setting.required_hours || 0),
            updated_at: new Date().toISOString(),
        })
        .eq('ro_status', 'Pending')
        .select(`
            ro_id,
            student_id,
            application_id,
            opening_id,
            program_id,
            setting_id,
            required_hours,
            submitted_minutes,
            submitted_progress,
            validated_minutes,
            ro_progress,
            progress_status,
            ro_status,
            updated_at
        `);

    if (error) throw error;

    return {
        setting: getSettingPayload(setting),
        updated_count: Array.isArray(data) ? data.length : 0,
        updated_rows: Array.isArray(data) ? data : [],
    };
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
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) throw error;

    return {
        items: Array.isArray(data) ? data.map(getSettingPayload) : [],
    };
}

async function getActiveSetting() {
    const setting = await fetchActiveSettingRow();

    return {
        setting: setting
            ? getSettingPayload(setting)
            : {
                setting_id: null,
                academic_year_id: null,
                period_id: null,
                required_hours: 20,
                is_active: true,
                allow_carry_over: true,
                remarks: 'Default RO setting',
                created_at: null,
                updated_at: null,
                academic_years: null,
                academic_period: null,
            },
    };
}

async function createSetting(body = {}) {
    const requiredHours = normalizeRequiredHours(
        body.required_hours ?? body.requiredHours ?? 20
    );

    const payload = {
        academic_year_id: safeText(body.academic_year_id || body.academicYearId) || null,
        period_id: safeText(body.period_id || body.periodId) || null,
        required_hours: requiredHours,
        is_active: body.is_active === true || body.isActive === true,
        allow_carry_over: body.allow_carry_over !== false && body.allowCarryOver !== false,
        remarks: safeText(body.remarks) || null,
    };

    if (payload.is_active) {
        await deactivateAllSettings();
    }

    const { data, error } = await supabase
        .from('ro_settings')
        .insert(payload)
        .select(`
            setting_id,
            academic_year_id,
            period_id,
            required_hours,
            is_active,
            allow_carry_over,
            remarks,
            created_at,
            updated_at
        `)
        .single();

    if (error) throw error;

    let applied = null;

    if (data.is_active) {
        applied = await applySettingToPendingRoRecords(data);
    }

    return {
        message: data.is_active
            ? 'RO setting created, activated, and applied to pending RO records.'
            : 'RO setting created successfully.',
        setting: getSettingPayload(data),
        applied_to_pending: applied,
    };
}

async function updateSetting(settingId, body = {}) {
    if (!settingId) {
        throw createHttpError(400, 'settingId is required.');
    }

    const updatePayload = {};
    const requiredHoursWasProvided =
        body.required_hours !== undefined || body.requiredHours !== undefined;

    if (body.academic_year_id !== undefined || body.academicYearId !== undefined) {
        updatePayload.academic_year_id =
            safeText(body.academic_year_id || body.academicYearId) || null;
    }

    if (body.period_id !== undefined || body.periodId !== undefined) {
        updatePayload.period_id = safeText(body.period_id || body.periodId) || null;
    }

    if (requiredHoursWasProvided) {
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

    let data;

    if (Object.keys(updatePayload).length > 0) {
        const response = await supabase
            .from('ro_settings')
            .update(updatePayload)
            .eq('setting_id', settingId)
            .select(`
                setting_id,
                academic_year_id,
                period_id,
                required_hours,
                is_active,
                allow_carry_over,
                remarks,
                created_at,
                updated_at
            `)
            .maybeSingle();

        if (response.error) throw response.error;

        data = response.data;
    } else {
        data = await fetchSettingById(settingId);
    }

    if (!data) {
        throw createHttpError(404, 'RO setting not found.');
    }

    const shouldApplyToPending =
        data.is_active === true &&
        (
            requiredHoursWasProvided ||
            body.apply_to_pending === true ||
            body.applyToPending === true
        );

    let applied = null;

    if (shouldApplyToPending) {
        applied = await applySettingToPendingRoRecords(data);
    }

    return {
        message: shouldApplyToPending
            ? 'RO setting updated and applied to pending RO records.'
            : 'RO setting updated successfully.',
        setting: getSettingPayload(data),
        applied_to_pending: applied,
    };
}

async function activateSetting(settingId) {
    if (!settingId) {
        throw createHttpError(400, 'settingId is required.');
    }

    const existing = await fetchSettingById(settingId);

    await deactivateAllSettings();

    const { data, error } = await supabase
        .from('ro_settings')
        .update({ is_active: true })
        .eq('setting_id', settingId)
        .select(`
            setting_id,
            academic_year_id,
            period_id,
            required_hours,
            is_active,
            allow_carry_over,
            remarks,
            created_at,
            updated_at
        `)
        .single();

    if (error) throw error;

    const applied = await applySettingToPendingRoRecords(data);

    return {
        message: 'RO setting activated and applied to pending RO records.',
        previous_setting: getSettingPayload(existing),
        setting: getSettingPayload(data),
        applied_to_pending: applied,
    };
}

async function applyActiveSettingToPending() {
    const setting = await fetchActiveSettingRow();

    if (!setting) {
        throw createHttpError(404, 'No active RO setting found.');
    }

    const applied = await applySettingToPendingRoRecords(setting);

    return {
        message: 'Active RO setting applied to pending RO records.',
        ...applied,
    };
}

async function getDepartments() {
    const { data, error } = await supabase
        .from('ro_departments')
        .select('department_id, department_name, is_active, created_at, updated_at')
        .order('department_name', { ascending: true });

    if (error) throw error;

    return {
        items: Array.isArray(data) ? data.map(getDepartmentPayload) : [],
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
        .select('department_id, department_name, is_active, created_at, updated_at')
        .single();

    if (error) {
        if (error.code === '23505') {
            throw createHttpError(409, 'This RO department already exists.');
        }

        throw error;
    }

    return {
        message: 'RO department created successfully.',
        department: getDepartmentPayload(data),
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
        .select('department_id, department_name, is_active, created_at, updated_at')
        .maybeSingle();

    if (error) {
        if (error.code === '23505') {
            throw createHttpError(409, 'This RO department already exists.');
        }

        throw error;
    }

    if (!data) {
        throw createHttpError(404, 'RO department not found.');
    }

    return {
        message: 'RO department updated successfully.',
        department: getDepartmentPayload(data),
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
        .select('department_id, department_name, is_active, created_at, updated_at')
        .single();

    if (error) throw error;

    return {
        message: data.is_active
            ? 'RO department activated successfully.'
            : 'RO department deactivated successfully.',
        department: getDepartmentPayload(data),
    };
}

module.exports = {
    getSettings,
    getActiveSetting,
    createSetting,
    updateSetting,
    activateSetting,
    applyActiveSettingToPending,
    getDepartments,
    createDepartment,
    updateDepartment,
    toggleDepartment,
};