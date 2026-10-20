// SMaRT-PDM: Courses — course Service (admin backend service); contains business logic and data operations.
const pool = require('../config/db');
const { transaction, activeOffice, isUuid, fail, confirmTransfers, auditOwnership } = require('./institutionalRelationsService');

// normalizeCourseCode: normalizes normalize course code for the Courses flow.
function normalizeCourseCode(value) {
    return String(value || '').trim().toUpperCase();
}

// normalizeCourseName: normalizes normalize course name for the Courses flow.
function normalizeCourseName(value) {
    return String(value || '').trim();
}

// mapCourse: maps map course for the Courses flow.
function mapCourse(row = {}) {
    return {
        course_id: row.course_id,
        course_code: row.course_code,
        course_name: row.course_name,
        office_id: row.office_id || null,
        office_name: row.office_name || null,
        is_archived: row.is_archived === true,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        assigned_pd: row.assigned_pd_user_id ? {
            user_id: row.assigned_pd_user_id,
            name: [row.assigned_pd_first_name, row.assigned_pd_last_name].filter(Boolean).join(' '),
            email: row.assigned_pd_email || '',
        } : null,
        pending_pd_count: Number(row.pending_pd_count || 0),
    };
}

// getCourseById: reads and returns get course by id for the Courses flow.
async function getCourseById(courseId) {
    const result = await pool.query(
        `
        SELECT
            course_id,
            course_code,
            course_name,
            office_id,
            is_archived,
            created_at,
            updated_at
        FROM academic_course
        WHERE course_id = $1
        LIMIT 1
        `,
        [courseId]
    );

    return result.rows[0] ? mapCourse(result.rows[0]) : null;
}

// fetchCourses: fetches and returns fetch courses for the Courses flow.
const fetchCourses = async () => {
    const result = await pool.query(
        `
        SELECT
            course.course_id,
            course.course_code,
            course.course_name,
            course.is_archived,
            course.office_id,
            office.office_name,
            course.created_at,
            course.updated_at,
            assignment.pd_user_id AS assigned_pd_user_id,
            profile.first_name AS assigned_pd_first_name,
            profile.last_name AS assigned_pd_last_name,
            pd_user.email AS assigned_pd_email
            ,(
              SELECT count(*)
              FROM endorsement_slips slip
              JOIN students student ON student.student_id = slip.student_id
              WHERE student.course_id = course.course_id
                AND slip.current_stage = 'pending_pd'
            ) AS pending_pd_count
        FROM academic_course course
        LEFT JOIN public.ref_offices office ON office.office_id=course.office_id
        LEFT JOIN program_director_course_assignments assignment
          ON assignment.course_id = course.course_id
         AND assignment.is_active = true
         AND EXISTS (
           SELECT 1
           FROM admin_profiles active_profile
           WHERE active_profile.user_id = assignment.pd_user_id
             AND COALESCE(active_profile.is_archived, false) = false
         )
        LEFT JOIN admin_profiles profile ON profile.user_id = assignment.pd_user_id
        LEFT JOIN users pd_user ON pd_user.user_id = assignment.pd_user_id
        ORDER BY
            course.is_archived ASC,
            course.created_at DESC NULLS LAST,
            course.course_code ASC
        `
    );

    return result.rows.map(mapCourse);
};

async function saveCourse(courseId, body = {}, actorId = null) {
    if (courseId && !isUuid(courseId)) fail(400, 'Invalid course identifier.');
    return transaction(async client => {
        const existing = courseId ? (await client.query('SELECT * FROM public.academic_course WHERE course_id=$1 FOR UPDATE', [courseId])).rows[0] : null;
        if (courseId && !existing) return null;
        const code = body.course_code === undefined ? existing?.course_code : normalizeCourseCode(body.course_code);
        const name = body.course_name === undefined ? existing?.course_name : normalizeCourseName(body.course_name);
        if (!code) fail(400, 'Course code is required');
        if (!name) fail(400, 'Course name is required');
        if (code.length > 50 || name.length > 255) fail(400, 'Course code or name is too long.');
        const officeId = body.office_id === undefined ? existing?.office_id || null : body.office_id || null;
        if (officeId !== null && !isUuid(officeId)) fail(400, 'Select a valid supervising office.');
        const changed = (existing?.office_id || null) !== officeId;
        if (existing && changed) {
            if (!Object.hasOwn(body, 'previous_office_id') || (body.previous_office_id || null) !== (existing.office_id || null)) fail(409, 'The supervising office changed. Refresh the course before saving.');
            confirmTransfers([existing], officeId, body.confirm_office_change === true && existing.office_id ? [{ course_id: existing.course_id, from_office_id: existing.office_id }] : []);
        }
        const office = officeId && (!existing || changed) ? await activeOffice(client, officeId) : null;
        const duplicate = await client.query('SELECT course_id FROM public.academic_course WHERE upper(course_code)=upper($1) AND ($2::uuid IS NULL OR course_id<>$2) LIMIT 1', [code, courseId || null]);
        if (duplicate.rowCount) fail(409, 'Course code already exists');
        const archived = body.is_archived === undefined ? existing?.is_archived || false : body.is_archived;
        if (typeof archived !== 'boolean') fail(400, 'Invalid course status.');
        const result = courseId ? await client.query('UPDATE public.academic_course SET course_code=$1,course_name=$2,is_archived=$3,office_id=$4,updated_at=now() WHERE course_id=$5 RETURNING *', [code,name,archived,officeId,courseId])
            : await client.query('INSERT INTO public.academic_course(course_code,course_name,is_archived,office_id) VALUES($1,$2,$3,$4) RETURNING *', [code,name,archived,officeId]);
        if (changed) await auditOwnership(client, [{ course_id: result.rows[0].course_id, from_office_id: existing?.office_id || null, to_office_id: officeId }], actorId);
        // Ownership changes never touch student/application IDs or existing PD review assignments.
        return mapCourse({ ...result.rows[0], office_name: office?.office_name });
    });
}
const createCourse = (body, actorId) => saveCourse(null, body, actorId);
const updateCourse = (id, body, actorId) => saveCourse(id, body, actorId);

// archiveCourse: archives archive course for the Courses flow.
const archiveCourse = async (courseId) => {
    const existing = await getCourseById(courseId);

    if (!existing) {
        return null;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            `
            UPDATE academic_course
            SET is_archived = true
            WHERE course_id = $1
            RETURNING course_id, course_code, course_name, office_id, is_archived, created_at, updated_at
            `,
            [courseId]
        );
        await client.query(
            `
            UPDATE program_director_course_assignments
            SET is_active = false, archived_at = now()
            WHERE course_id = $1 AND is_active = true
            `,
            [courseId]
        );
        await client.query('COMMIT');
        return result.rows[0] ? mapCourse(result.rows[0]) : null;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// restoreCourse: restores restore course for the Courses flow.
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
            office_id,
            is_archived,
            created_at,
            updated_at
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
