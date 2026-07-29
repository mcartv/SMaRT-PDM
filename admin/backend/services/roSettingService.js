const supabase = require('../config/supabase');
const db = require('../config/db');

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

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw createHttpError(400, 'Required hours must be a whole number greater than zero.');
    }

    return parsed;
}

function getSettingPayload(setting = {}) {
    return {
        setting_id: setting.setting_id || null,
        academic_year_id: setting.academic_year_id || null,
        period_id: setting.period_id || null,
        required_hours: Number(setting.required_hours ?? 0),
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
        setting: setting ? getSettingPayload(setting) : null,
    };
}

async function createSetting(body = {}) {
    const requiredHours = normalizeRequiredHours(
        body.required_hours ?? body.requiredHours ?? 8
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

    const coordinatorResult = await db.query(
        `
        SELECT
          rac.coordinator_assignment_id,
          rac.ro_area_id,
          rac.user_id,
          ap.first_name,
          ap.last_name,
          ap.department,
          ap.position
        FROM ro_area_coordinators rac
        JOIN admin_profiles ap ON ap.user_id = rac.user_id
        WHERE rac.is_active = true
          AND COALESCE(ap.is_archived, false) = false
        `
    );
    const coordinators = new Map(
        coordinatorResult.rows.map((row) => [
            String(row.ro_area_id),
            {
                coordinator_assignment_id: row.coordinator_assignment_id,
                user_id: row.user_id,
                name: [row.first_name, row.last_name].filter(Boolean).join(' '),
                department: row.department,
                position: row.position,
            },
        ])
    );
    const candidateResult = await db.query(
        `
        SELECT user_id, first_name, last_name, department, position
        FROM admin_profiles
        WHERE COALESCE(is_archived, false) = false
        ORDER BY first_name, last_name
        `
    );

    return {
        items: (Array.isArray(data) ? data : []).map((row) => {
            const department = getDepartmentPayload(row);
            return {
                ...department,
                coordinator: coordinators.get(String(department.department_id)) || null,
            };
        }),
        coordinator_candidates: candidateResult.rows.map((row) => ({
            user_id: row.user_id,
            name: [row.first_name, row.last_name].filter(Boolean).join(' '),
            department: row.department || '',
            position: row.position || '',
        })),
    };
}

async function setDepartmentCoordinator(departmentId, body = {}, actorUserId = null) {
    if (!departmentId) {
        throw createHttpError(400, 'RO Area is required.');
    }

    const userId = safeText(body.user_id || body.userId) || null;
    const client = await db.connect();

    try {
        await client.query('BEGIN');
        const areaResult = await client.query(
            `SELECT department_id, department_name, is_active
             FROM ro_departments
             WHERE department_id = $1
             FOR UPDATE`,
            [departmentId]
        );
        const area = areaResult.rows[0];
        if (!area) throw createHttpError(404, 'RO Area not found.');
        if (!area.is_active) throw createHttpError(409, 'Activate this RO Area before assigning a coordinator.');

        const pendingResult = await client.query(
            `SELECT COUNT(*)::int AS pending_count
             FROM ro_placements
             WHERE ro_area_id = $1
               AND placement_status = 'Pending'`,
            [departmentId]
        );
        const pendingCount = Number(pendingResult.rows[0]?.pending_count || 0);

        if (!userId && pendingCount > 0) {
            throw createHttpError(
                409,
                `This RO Area still has ${pendingCount} pending request${pendingCount === 1 ? '' : 's'}. Reassign a coordinator instead of removing one.`
            );
        }

        let assignment = null;
        if (userId) {
            const profileResult = await client.query(
                `SELECT user_id, first_name, last_name, department, position
                 FROM admin_profiles
                 WHERE user_id = $1
                   AND COALESCE(is_archived, false) = false
                 LIMIT 1`,
                [userId]
            );
            if (!profileResult.rows.length) {
                throw createHttpError(400, 'Select an active staff account.');
            }

            await client.query(
                `UPDATE ro_area_coordinators
                 SET is_active = false, archived_at = now(), updated_at = now()
                 WHERE ro_area_id = $1
                   AND is_active = true
                   AND user_id <> $2`,
                [departmentId, userId]
            );

            const existingResult = await client.query(
                `SELECT coordinator_assignment_id
                 FROM ro_area_coordinators
                 WHERE ro_area_id = $1 AND user_id = $2
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [departmentId, userId]
            );

            if (existingResult.rows.length) {
                const result = await client.query(
                    `UPDATE ro_area_coordinators
                     SET is_active = true,
                         assigned_by_user_id = $2,
                         assigned_at = now(),
                         archived_at = NULL,
                         updated_at = now()
                     WHERE coordinator_assignment_id = $1
                     RETURNING *`,
                    [existingResult.rows[0].coordinator_assignment_id, actorUserId]
                );
                assignment = result.rows[0];
            } else {
                const result = await client.query(
                    `INSERT INTO ro_area_coordinators (
                       ro_area_id, user_id, assigned_by_user_id
                     )
                     VALUES ($1, $2, $3)
                     RETURNING *`,
                    [departmentId, userId, actorUserId]
                );
                assignment = result.rows[0];
            }

            await client.query(
                `UPDATE ro_placements
                 SET coordinator_assignment_id = $2, updated_at = now()
                 WHERE ro_area_id = $1
                   AND placement_status = 'Pending'`,
                [departmentId, assignment.coordinator_assignment_id]
            );
        } else {
            await client.query(
                `UPDATE ro_area_coordinators
                 SET is_active = false, archived_at = now(), updated_at = now()
                 WHERE ro_area_id = $1 AND is_active = true`,
                [departmentId]
            );
        }

        await client.query('COMMIT');
        return {
            message: userId
                ? 'RO Area coordinator assigned successfully.'
                : 'RO Area coordinator removed successfully.',
            assignment,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505' && error.constraint === 'uq_ro_area_active_coordinator') {
            throw createHttpError(409, 'This RO Area already has an active coordinator.');
        }
        throw error;
    } finally {
        client.release();
    }
}

async function createDepartment(body = {}) {
    const departmentName = safeText(body.department_name || body.departmentName);

    if (!departmentName) {
        throw createHttpError(400, 'RO Area name is required.');
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
            throw createHttpError(409, 'This RO Area already exists.');
        }

        throw error;
    }

    return {
        message: 'RO Area created successfully.',
        department: getDepartmentPayload(data),
    };
}

async function updateDepartment(departmentId, body = {}) {
    if (!departmentId) {
        throw createHttpError(400, 'departmentId is required.');
    }

    const departmentName = safeText(body.department_name || body.departmentName);

    if (!departmentName) {
        throw createHttpError(400, 'RO Area name is required.');
    }

    const client = await db.connect();
    let data;

    try {
        await client.query('BEGIN');
        const existingResult = await client.query(
            `SELECT department_name FROM ro_departments WHERE department_id = $1 FOR UPDATE`,
            [departmentId]
        );
        const existing = existingResult.rows[0];
        if (!existing) {
            throw createHttpError(404, 'RO Area not found.');
        }

        const updateResult = await client.query(
            `
            UPDATE ro_departments
            SET department_name = $2, updated_at = now()
            WHERE department_id = $1
            RETURNING department_id, department_name, is_active, created_at, updated_at
            `,
            [departmentId, departmentName]
        );
        data = updateResult.rows[0];

        if (existing.department_name !== departmentName) {
            await client.query(
                `
                UPDATE admin_profiles
                SET department = $2
                WHERE LOWER(TRIM(COALESCE(department, ''))) = LOWER(TRIM($1))
                  AND LOWER(TRIM(COALESCE(position, ''))) = 'ro coordinator'
                `,
                [existing.department_name, departmentName]
            );
            await client.query(
                `
                UPDATE return_of_obligations
                SET assigned_area = $2, updated_at = now()
                WHERE LOWER(TRIM(COALESCE(assigned_area, ''))) = LOWER(TRIM($1))
                `,
                [existing.department_name, departmentName]
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            throw createHttpError(409, 'This RO Area already exists.');
        }
        throw error;
    } finally {
        client.release();
    }

    return {
        message: 'RO Area updated successfully.',
        department: getDepartmentPayload(data),
    };
}

async function toggleDepartment(departmentId) {
    if (!departmentId) {
        throw createHttpError(400, 'departmentId is required.');
    }

    const client = await db.connect();
    let data;
    try {
        await client.query('BEGIN');
        const existingResult = await client.query(
            `
            SELECT department_id, department_name, is_active
            FROM ro_departments
            WHERE department_id = $1
            FOR UPDATE
            `,
            [departmentId]
        );
        const existing = existingResult.rows[0];
        if (!existing) throw createHttpError(404, 'RO Area not found.');

        if (existing.is_active) {
            const coordinatorResult = await client.query(
                `
                SELECT 1
                FROM ro_area_coordinators
                WHERE ro_area_id = $1
                  AND is_active = true
                LIMIT 1
                `,
                [existing.department_id]
            );
            if (coordinatorResult.rows.length) {
                throw createHttpError(409, 'Archive or reassign the active RO Coordinator before deactivating this RO Area.');
            }
        }

        const updateResult = await client.query(
            `
            UPDATE ro_departments
            SET is_active = NOT is_active, updated_at = now()
            WHERE department_id = $1
            RETURNING department_id, department_name, is_active, created_at, updated_at
            `,
            [departmentId]
        );
        data = updateResult.rows[0];
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    return {
        message: data.is_active
            ? 'RO Area activated successfully.'
            : 'RO Area deactivated successfully.',
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
    setDepartmentCoordinator,
};
