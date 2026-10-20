'use strict';
const db = require('../config/db');
const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function fail(statusCode, message, extra = {}) { throw Object.assign(new Error(message), { statusCode, ...extra }); }
async function transaction(run, pool = db) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Shared by BOTH office and course ownership writers.
        await client.query("SELECT pg_advisory_xact_lock(hashtext('smartpdm:offices'))");
        const result = await run(client);
        await client.query('COMMIT');
        return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}
async function schemaReady(client = db) {
    const result = await client.query(`SELECT to_regclass('public.office_academic_leaders') IS NOT NULL
        AND to_regclass('public.office_leadership_position_rules') IS NOT NULL
        AND to_regclass('public.office_dean_role_grants') IS NOT NULL
        AND to_regclass('public.institutional_service_area_links') IS NOT NULL
        AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
            AND table_name='admin_profiles' AND column_name='institutional_primary_role')
        AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
            AND table_name='ref_offices' AND column_name='description') AS ready`);
    return result.rows[0]?.ready === true;
}
async function requireSchema(client) {
    if (!await schemaReady(client)) fail(503, 'Apply the Institutional Management migration before saving offices or leadership.');
}
async function activeOffice(client, officeId) {
    if (officeId === null) return null;
    if (!isUuid(officeId)) fail(400, 'Select a valid supervising office.');
    const result = await client.query(`SELECT office_id,office_name,is_active,COALESCE((to_jsonb(ref_offices)->>'is_institutional')::boolean,true) AS is_institutional FROM public.ref_offices WHERE office_id=$1 FOR UPDATE`, [officeId]);
    if (!result.rowCount || !result.rows[0].is_active || result.rows[0].is_institutional === false) fail(400, 'Select an active supervising office.');
    return result.rows[0];
}
function validateTransfers(value = []) {
    if (!Array.isArray(value) || value.length > 300 || value.some(item => !isUuid(item?.course_id) || !isUuid(item?.from_office_id)) || new Set(value.map(item => item.course_id)).size !== value.length) fail(400, 'Invalid course transfer confirmation.');
    return value;
}
function confirmTransfers(courses, officeId, transfers) {
    const conflicts = courses.filter(course => course.office_id && course.office_id !== officeId);
    if (conflicts.some(course => !transfers.some(item => item.course_id === course.course_id && item.from_office_id === course.office_id))) {
        fail(409, 'Confirm the current office assignments before reassigning these courses. Refresh if the list has changed.', {
            code: 'COURSE_REASSIGNMENT_REQUIRED',
            conflicts: conflicts.map(course => ({ course_id: course.course_id, course_code: course.course_code, from_office_id: course.office_id })),
        });
    }
}
async function auditOffice(client, officeId, action, before, after, actorId = null) {
    await client.query(`INSERT INTO public.audit_logs(user_id,action_taken,module,entity_type,entity_id,description,metadata,actor_role)
        VALUES($1,$2,'Institutional Management','ref_offices',$3,$4,$5::jsonb,'admin')`,
    [actorId, action, officeId, action.replaceAll('_', ' ').toLowerCase(), JSON.stringify({ before, after })]);
}
async function auditOwnership(client, changes, actorId = null) {
    const ids = new Set(changes.flatMap(change => [change.from_office_id, change.to_office_id]).filter(Boolean));
    for (const id of ids) await auditOffice(client, id, 'UPDATE_COURSE_OWNERSHIP', null, { course_changes: changes.filter(change => change.from_office_id === id || change.to_office_id === id) }, actorId);
}
module.exports = { isUuid, fail, transaction, schemaReady, requireSchema, activeOffice, validateTransfers, confirmTransfers, auditOffice, auditOwnership };
