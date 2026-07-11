const pool = require('../config/db');

function normalizeCourseCode(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeCourseName(value) {
    return String(value || '').trim();
}

function mapCourse(row = {}) {
    return {
        course_id: row.course_id,
        course_code: row.course_code,
        course_name: row.course_name,
        is_archived: row.is_archived === true,
    };
}

async function getCourseById(courseId) {
    const result = await pool.query(
        `
        SELECT
            course_id,
            course_code,
            course_name,
            is_archived
        FROM academic_course
        WHERE course_id = $1
        LIMIT 1
        `,
        [courseId]
    );

    return result.rows[0] ? mapCourse(result.rows[0]) : null;
}

async function ensureUniqueCourseCode(courseCode, excludeCourseId = null) {
    const result = await pool.query(
        `
        SELECT course_id
        FROM academic_course
        WHERE UPPER(course_code) = UPPER($1)
          AND ($2::uuid IS NULL OR course_id <> $2::uuid)
        LIMIT 1
        `,
        [courseCode, excludeCourseId]
    );

    if (result.rows.length > 0) {
        throw new Error('Course code already exists');
    }
}

const fetchCourses = async () => {
    const result = await pool.query(
        `
        SELECT
            course_id,
            course_code,
            course_name,
            is_archived
        FROM academic_course
        ORDER BY
            is_archived ASC,
            course_code ASC
        `
    );

    return result.rows.map(mapCourse);
};

const createCourse = async ({
    course_code,
    course_name,
    is_archived = false,
}) => {
    const normalizedCourseCode = normalizeCourseCode(course_code);
    const normalizedCourseName = normalizeCourseName(course_name);

    if (!normalizedCourseCode) {
        throw new Error('Course code is required');
    }

    if (!normalizedCourseName) {
        throw new Error('Course name is required');
    }

    await ensureUniqueCourseCode(normalizedCourseCode);

    const result = await pool.query(
        `
        INSERT INTO academic_course (
            course_code,
            course_name,
            is_archived
        )
        VALUES ($1, $2, $3)
        RETURNING
            course_id,
            course_code,
            course_name,
            is_archived
        `,
        [
            normalizedCourseCode,
            normalizedCourseName,
            !!is_archived,
        ]
    );

    return mapCourse(result.rows[0]);
};

const updateCourse = async (
    courseId,
    {
        course_code,
        course_name,
        is_archived,
    } = {}
) => {
    const existing = await getCourseById(courseId);

    if (!existing) {
        return null;
    }

    const nextCourseCode =
        course_code !== undefined
            ? normalizeCourseCode(course_code)
            : existing.course_code;

    const nextCourseName =
        course_name !== undefined
            ? normalizeCourseName(course_name)
            : existing.course_name;

    const nextIsArchived =
        is_archived !== undefined
            ? !!is_archived
            : existing.is_archived;

    if (!nextCourseCode) {
        throw new Error('Course code is required');
    }

    if (!nextCourseName) {
        throw new Error('Course name is required');
    }

    await ensureUniqueCourseCode(nextCourseCode, courseId);

    const result = await pool.query(
        `
        UPDATE academic_course
        SET
            course_code = $1,
            course_name = $2,
            is_archived = $3
        WHERE course_id = $4
        RETURNING
            course_id,
            course_code,
            course_name,
            is_archived
        `,
        [
            nextCourseCode,
            nextCourseName,
            nextIsArchived,
            courseId,
        ]
    );

    return result.rows[0] ? mapCourse(result.rows[0]) : null;
};

const archiveCourse = async (courseId) => {
    const existing = await getCourseById(courseId);

    if (!existing) {
        return null;
    }

    const result = await pool.query(
        `
        UPDATE academic_course
        SET is_archived = true
        WHERE course_id = $1
        RETURNING
            course_id,
            course_code,
            course_name,
            is_archived
        `,
        [courseId]
    );

    return result.rows[0] ? mapCourse(result.rows[0]) : null;
};

const restoreCourse = async (courseId) => {
    const existing = await getCourseById(courseId);

    if (!existing) {
        return null;
    }

    const result = await pool.query(
        `
        UPDATE academic_course
        SET is_archived = false
        WHERE course_id = $1
        RETURNING
            course_id,
            course_code,
            course_name,
            is_archived
        `,
        [courseId]
    );

    return result.rows[0] ? mapCourse(result.rows[0]) : null;
};

module.exports = {
    fetchCourses,
    createCourse,
    updateCourse,
    archiveCourse,
    restoreCourse,
};