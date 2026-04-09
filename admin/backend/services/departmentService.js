const pool = require('../config/db');

const fetchDepartments = async () => {
    const query = `
        SELECT
            department_id,
            department_code,
            department_name,
            is_archived,
            created_at
        FROM academic_departments
        ORDER BY is_archived ASC, department_code ASC
    `;

    const { rows } = await pool.query(query);
    return rows;
};

const createDepartment = async ({
    department_code,
    department_name = null,
    is_archived = false,
}) => {
    const normalizedDepartmentCode = (department_code || '').trim().toUpperCase();
    const normalizedDepartmentName =
        department_name && String(department_name).trim()
            ? String(department_name).trim()
            : null;

    if (!normalizedDepartmentCode) {
        throw new Error('Department code is required');
    }

    const duplicateCheckQuery = `
        SELECT department_id
        FROM academic_departments
        WHERE UPPER(department_code) = UPPER($1)
        LIMIT 1
    `;

    const duplicateCheck = await pool.query(duplicateCheckQuery, [normalizedDepartmentCode]);

    if (duplicateCheck.rows.length > 0) {
        throw new Error('Department code already exists');
    }

    const insertQuery = `
        INSERT INTO academic_departments (
            department_code,
            department_name,
            is_archived
        )
        VALUES ($1, $2, $3)
        RETURNING
            department_id,
            department_code,
            department_name,
            is_archived,
            created_at
    `;

    const values = [
        normalizedDepartmentCode,
        normalizedDepartmentName,
        !!is_archived,
    ];

    const { rows } = await pool.query(insertQuery, values);
    return rows[0];
};

const updateDepartment = async (
    departmentId,
    {
        department_code,
        department_name,
        is_archived,
    }
) => {
    const existingQuery = `
        SELECT
            department_id,
            department_code,
            department_name,
            is_archived,
            created_at
        FROM academic_departments
        WHERE department_id = $1
        LIMIT 1
    `;

    const existingResult = await pool.query(existingQuery, [departmentId]);

    if (existingResult.rows.length === 0) {
        return null;
    }

    const existingDepartment = existingResult.rows[0];

    const nextDepartmentCode =
        department_code !== undefined
            ? String(department_code).trim().toUpperCase()
            : existingDepartment.department_code;

    const nextDepartmentName =
        department_name !== undefined
            ? (String(department_name || '').trim() || null)
            : existingDepartment.department_name;

    const nextIsArchived =
        is_archived !== undefined
            ? !!is_archived
            : existingDepartment.is_archived;

    if (!nextDepartmentCode) {
        throw new Error('Department code is required');
    }

    if (department_code !== undefined) {
        const duplicateCheckQuery = `
            SELECT department_id
            FROM academic_departments
            WHERE UPPER(department_code) = UPPER($1)
              AND department_id <> $2
            LIMIT 1
        `;

        const duplicateCheck = await pool.query(duplicateCheckQuery, [
            nextDepartmentCode,
            departmentId,
        ]);

        if (duplicateCheck.rows.length > 0) {
            throw new Error('Department code already exists');
        }
    }

    const updateQuery = `
        UPDATE academic_departments
        SET
            department_code = $1,
            department_name = $2,
            is_archived = $3
        WHERE department_id = $4
        RETURNING
            department_id,
            department_code,
            department_name,
            is_archived,
            created_at
    `;

    const values = [
        nextDepartmentCode,
        nextDepartmentName,
        nextIsArchived,
        departmentId,
    ];

    const { rows } = await pool.query(updateQuery, values);
    return rows[0];
};

module.exports = {
    fetchDepartments,
    createDepartment,
    updateDepartment,
};