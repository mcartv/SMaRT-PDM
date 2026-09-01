const db = require('../config/db');

const TABLE = 'program_director_course_assignments';

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalizeCourseIds(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

async function getAssignmentsForUser(userId, client = db) {
    if (!userId) return [];
    const result = await client.query(
        `
        SELECT
            assignment.assignment_id,
            assignment.course_id,
            course.course_code,
            course.course_name
        FROM ${TABLE} assignment
        JOIN academic_course course ON course.course_id = assignment.course_id
        WHERE assignment.pd_user_id = $1
          AND assignment.is_active = true
        ORDER BY course.course_code ASC
        `,
        [userId]
    );
    return result.rows;
}

async function getAssignmentsForUsers(userIds, client = db) {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return new Map();
    const result = await client.query(
        `
        SELECT
            assignment.pd_user_id,
            assignment.course_id,
            course.course_code,
            course.course_name
        FROM ${TABLE} assignment
        JOIN academic_course course ON course.course_id = assignment.course_id
        WHERE assignment.pd_user_id = ANY($1::uuid[])
          AND assignment.is_active = true
        ORDER BY course.course_code ASC
        `,
        [ids]
    );
    const byUser = new Map(ids.map((id) => [String(id), []]));
    result.rows.forEach((row) => {
        const key = String(row.pd_user_id);
        if (!byUser.has(key)) byUser.set(key, []);
        byUser.get(key).push({
            course_id: row.course_id,
            course_code: row.course_code,
            course_name: row.course_name,
        });
    });
    return byUser;
}

async function syncAssignments({ userId, courseIds, assignedByUserId = null, client = db }) {
    const normalizedIds = normalizeCourseIds(courseIds);
    if (!normalizedIds.length) {
        throw createHttpError(400, 'Select at least one active course for the Program Director.');
    }

    const courses = await client.query(
        `SELECT course_id FROM academic_course WHERE course_id = ANY($1::uuid[]) AND is_archived = false`,
        [normalizedIds]
    );
    if (courses.rows.length !== normalizedIds.length) {
        throw createHttpError(400, 'One or more selected courses are unavailable or archived.');
    }

    // Older archive flows could leave an active assignment attached to an
    // archived PD. Such a row must not keep the course locked after that
    // account has been deactivated.
    await client.query(
        `
        UPDATE ${TABLE} assignment
        SET is_active = false, archived_at = COALESCE(assignment.archived_at, now())
        FROM admin_profiles profile
        WHERE assignment.pd_user_id = profile.user_id
          AND assignment.course_id = ANY($1::uuid[])
          AND assignment.is_active = true
          AND COALESCE(profile.is_archived, false) = true
        `,
        [normalizedIds]
    );

    const conflicts = await client.query(
        `
        SELECT course.course_code, profile.first_name, profile.last_name
        FROM ${TABLE} assignment
        JOIN academic_course course ON course.course_id = assignment.course_id
        LEFT JOIN admin_profiles profile ON profile.user_id = assignment.pd_user_id
        WHERE assignment.course_id = ANY($1::uuid[])
          AND assignment.is_active = true
          AND assignment.pd_user_id <> $2
        `,
        [normalizedIds, userId]
    );
    if (conflicts.rows.length) {
        const names = conflicts.rows.map((row) => {
            const owner = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'another PD';
            return `${row.course_code} (${owner})`;
        });
        throw createHttpError(409, `Already assigned: ${names.join(', ')}.`);
    }

    await client.query(
        `
        UPDATE ${TABLE}
        SET is_active = false, archived_at = now()
        WHERE pd_user_id = $1
          AND is_active = true
          AND NOT (course_id = ANY($2::uuid[]))
        `,
        [userId, normalizedIds]
    );

    await client.query(
        `
        INSERT INTO ${TABLE} (pd_user_id, course_id, assigned_by_user_id)
        SELECT $1, selected.course_id, $3
        FROM unnest($2::uuid[]) AS selected(course_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM ${TABLE} current
          WHERE current.pd_user_id = $1
            AND current.course_id = selected.course_id
            AND current.is_active = true
        )
        `,
        [userId, normalizedIds, assignedByUserId]
    );

    return getAssignmentsForUser(userId, client);
}

async function restoreLatestReleasedAssignments(userId, client = db) {
    if (!userId) return [];

    await client.query(
        `
        WITH latest_release_time AS (
          SELECT MAX(archived_at) AS archived_at
          FROM ${TABLE}
          WHERE pd_user_id = $1
            AND is_active = false
        ), latest_released AS (
          SELECT assignment.assignment_id
          FROM ${TABLE} assignment
          CROSS JOIN latest_release_time release_time
          JOIN academic_course course
            ON course.course_id = assignment.course_id
           AND COALESCE(course.is_archived, false) = false
          WHERE assignment.pd_user_id = $1
            AND assignment.is_active = false
            AND assignment.archived_at = release_time.archived_at
            AND NOT EXISTS (
              SELECT 1
              FROM ${TABLE} claimed
              JOIN admin_profiles owner ON owner.user_id = claimed.pd_user_id
              WHERE claimed.course_id = assignment.course_id
                AND claimed.is_active = true
                AND COALESCE(owner.is_archived, false) = false
            )
        )
        UPDATE ${TABLE} assignment
        SET is_active = true, archived_at = NULL
        FROM latest_released latest
        WHERE assignment.assignment_id = latest.assignment_id
        `,
        [userId]
    );

    return getAssignmentsForUser(userId, client);
}

async function releaseAssignments(userId, client = db) {
    if (!userId) return;
    await client.query(
        `UPDATE ${TABLE} SET is_active = false, archived_at = now() WHERE pd_user_id = $1 AND is_active = true`,
        [userId]
    );
}

async function assertCourseAccess({ userId, courseId, role, client = db }) {
    if (String(role || '').toLowerCase() === 'admin') return true;
    if (String(role || '').toLowerCase() !== 'pd' || !userId || !courseId) {
        throw createHttpError(403, 'Access denied for this Program Director course.');
    }
    const result = await client.query(
        `SELECT 1 FROM ${TABLE} WHERE pd_user_id = $1 AND course_id = $2 AND is_active = true LIMIT 1`,
        [userId, courseId]
    );
    if (!result.rows.length) {
        throw createHttpError(403, 'This applicant belongs to a course not assigned to your account.');
    }
    return true;
}

module.exports = {
    assertCourseAccess,
    getAssignmentsForUser,
    getAssignmentsForUsers,
    normalizeCourseIds,
    releaseAssignments,
    restoreLatestReleasedAssignments,
    syncAssignments,
};
