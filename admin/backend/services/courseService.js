const pool = require('../config/db');

const fetchCourses = async () => {
    const query = `
        SELECT
            course_id,
            course_code,
            course_name,
            is_archived
        FROM academic_course
        ORDER BY
            is_archived ASC,
            course_code ASC
    `;

    const { rows } = await pool.query(query);
    return rows;
};

const createCourse = async ({
    course_code,
    course_name,
    is_archived = false,
}) => {
    const normalizedCourseCode = (course_code || '').trim().toUpperCase();
    const normalizedCourseName = (course_name || '').trim();

    if (!normalizedCourseCode) {
        throw new Error('Course code is required');
    }

    if (!normalizedCourseName) {
        throw new Error('Course name is required');
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
        is_archived
    )
    VALUES ($1, $2, $3)
    RETURNING course_id
`;

    const values = [
        normalizedCourseCode,
        normalizedCourseName,
        !!is_archived,
    ];
    const insertResult = await pool.query(insertQuery, values);
    const createdCourseId = insertResult.rows[0].course_id;

    const fetchCreatedQuery = `
    SELECT
        course_id,
        course_code,
        course_name,
        is_archived
        FROM academic_course
        WHERE course_id = $1
        LIMIT 1
    `;

    const { rows } = await pool.query(fetchCreatedQuery, [createdCourseId]);
    return rows[0];
};

const updateCourse = async (
    courseId,
    {
        course_code,
        course_name,
        is_archived,
    }
) => {
    const existingQuery = `
        SELECT
            course_id,
            course_code,
            course_name,
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

    const nextIsArchived =
        is_archived !== undefined
            ? !!is_archived
            : existingCourse.is_archived;

    if (!nextCourseCode) {
        throw new Error('Course code is required');
    }

    if (!nextCourseName) {
        throw new Error('Course name is required');
    }

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
            is_archived = $3
        WHERE course_id = $5
        RETURNING course_id
    `;

    const values = [
        nextCourseCode,
        nextCourseName,
        nextIsArchived,
        courseId,
    ];

    const updateResult = await pool.query(updateQuery, values);
    const updatedCourseId = updateResult.rows[0].course_id;

    const fetchUpdatedQuery = `
    SELECT
        course_id,
        course_code,
        course_name,
        is_archived
    FROM academic_course
    WHERE course_id = $1
    LIMIT 1
`;

    const { rows } = await pool.query(fetchUpdatedQuery, [updatedCourseId]);
    return rows[0];
};

module.exports = {
    fetchCourses,
    createCourse,
    updateCourse,
};