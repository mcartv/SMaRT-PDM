const pool = require('../config/db');

const fetchCourses = async () => {
    const query = `
        SELECT
            course_id,
            course_code,
            course_name,
            department,
            is_archived
        FROM academic_course
        ORDER BY is_archived ASC, department ASC, course_code ASC
    `;

    const { rows } = await pool.query(query);
    return rows;
};

const createCourse = async ({
    course_code,
    course_name,
    department,
    is_archived = false,
}) => {
    const normalizedCourseCode = (course_code || '').trim().toUpperCase();
    const normalizedCourseName = (course_name || '').trim();
    const normalizedDepartment = (department || '').trim().toUpperCase();

    if (!normalizedCourseCode) {
        throw new Error('Course code is required');
    }

    if (!normalizedCourseName) {
        throw new Error('Course name is required');
    }

    if (!normalizedDepartment) {
        throw new Error('Department is required');
    }

    const duplicateCheckQuery = `
        SELECT course_id
        FROM academic_course
        WHERE UPPER(course_code) = UPPER($1)
        LIMIT 1
    `;

    const duplicateCheck = await pool.query(duplicateCheckQuery, [normalizedCourseCode]);

    if (duplicateCheck.rows.length > 0) {
        throw new Error('Course code already exists');
    }

    const insertQuery = `
        INSERT INTO academic_course (
            course_code,
            course_name,
            department,
            is_archived
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            course_id,
            course_code,
            course_name,
            department,
            is_archived
    `;

    const values = [
        normalizedCourseCode,
        normalizedCourseName,
        normalizedDepartment,
        !!is_archived,
    ];

    const { rows } = await pool.query(insertQuery, values);
    return rows[0];
};

const updateCourse = async (
    courseId,
    {
        course_code,
        course_name,
        department,
        is_archived,
    }
) => {
    const existingQuery = `
        SELECT
            course_id,
            course_code,
            course_name,
            department,
            is_archived
        FROM academic_course
        WHERE course_id = $1
        LIMIT 1
    `;

    const existingResult = await pool.query(existingQuery, [courseId]);

    if (existingResult.rows.length === 0) {
        return null;
    }

    const existingCourse = existingResult.rows[0];

    const nextCourseCode =
        course_code !== undefined
            ? String(course_code).trim().toUpperCase()
            : existingCourse.course_code;

    const nextCourseName =
        course_name !== undefined
            ? String(course_name).trim()
            : existingCourse.course_name;

    const nextDepartment =
        department !== undefined
            ? String(department).trim().toUpperCase()
            : existingCourse.department;

    const nextIsArchived =
        is_archived !== undefined
            ? !!is_archived
            : existingCourse.is_archived;

    if (course_code !== undefined) {
        const duplicateCheckQuery = `
            SELECT course_id
            FROM academic_course
            WHERE UPPER(course_code) = UPPER($1)
              AND course_id <> $2
            LIMIT 1
        `;

        const duplicateCheck = await pool.query(duplicateCheckQuery, [
            nextCourseCode,
            courseId,
        ]);

        if (duplicateCheck.rows.length > 0) {
            throw new Error('Course code already exists');
        }
    }

    const updateQuery = `
        UPDATE academic_course
        SET
            course_code = $1,
            course_name = $2,
            department = $3,
            is_archived = $4
        WHERE course_id = $5
        RETURNING
            course_id,
            course_code,
            course_name,
            department,
            is_archived
    `;

    const values = [
        nextCourseCode,
        nextCourseName,
        nextDepartment,
        nextIsArchived,
        courseId,
    ];

    const { rows } = await pool.query(updateQuery, values);
    return rows[0];
};

module.exports = {
    fetchCourses,
    createCourse,
    updateCourse,
};