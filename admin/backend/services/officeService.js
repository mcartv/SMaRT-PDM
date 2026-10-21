'use strict';
const db = require('../config/db');
const { isUuid, fail, transaction, schemaReady, requireSchema, validateTransfers, confirmTransfers, auditOffice, auditOwnership } = require('./institutionalRelationsService');
const { grantDean, revokeUnusedDean } = require('./officeDeanRoleService');
const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

async function listOffices(pool = db) {
    const ready = await schemaReady(pool);
    const [offices, courses, members, mappings, programDirectors] = await Promise.all([
        pool.query(`SELECT o.*,COALESCE(to_jsonb(o)->>'description','') AS description,
            EXISTS(SELECT 1 FROM public.rbac_staff_role_offices x WHERE x.office_id=o.office_id AND x.app_role_code='admin') AS is_protected
            FROM public.ref_offices o WHERE COALESCE((to_jsonb(o)->>'is_institutional')::boolean,true)=true ORDER BY o.office_name`),
        pool.query(`SELECT c.course_id,c.course_code,c.course_name,c.office_id,c.is_archived,o.office_name
            FROM public.academic_course c LEFT JOIN public.ref_offices o ON o.office_id=c.office_id ORDER BY c.course_code`),
        pool.query(`SELECT a.user_id,a.office_id,concat_ws(' ',a.first_name,a.last_name) AS name,
            COALESCE(p.position_name,a.position,'') AS position,a.position_id,COALESCE(a.is_archived,false) AS is_archived,
            COALESCE((SELECT jsonb_agg(DISTINCT r.role_name) FROM public.rbac_user_roles ur
                JOIN public.rbac_roles r ON r.role_id=ur.role_id WHERE ur.user_id=a.user_id AND ur.is_active=true
                AND r.role_scope='staff' AND r.is_active=true),'[]'::jsonb) AS roles
            FROM public.admin_profiles a LEFT JOIN public.ref_staff_positions p ON p.position_id=a.position_id
            ORDER BY a.last_name,a.first_name`),
        pool.query('SELECT office_id,app_role_code FROM public.rbac_staff_role_offices'),
        pool.query(`SELECT c.office_id,c.course_id,c.course_code,pa.pd_user_id AS user_id,
            concat_ws(' ',a.first_name,a.last_name) AS name,COALESCE(p.position_name,a.position,'') AS position
            FROM public.program_director_course_assignments pa
            JOIN public.academic_course c ON c.course_id=pa.course_id
            JOIN public.admin_profiles a ON a.user_id=pa.pd_user_id
            LEFT JOIN public.ref_staff_positions p ON p.position_id=a.position_id
            WHERE pa.is_active=true AND COALESCE(a.is_archived,false)=false AND c.is_archived=false
            ORDER BY c.course_code,a.last_name,a.first_name`),
    ]);
    const [leaders, eligibility] = ready ? await Promise.all([
        pool.query('SELECT office_id,leadership_kind,user_id,assigned_at FROM public.office_academic_leaders'),
        pool.query(`SELECT rule.leadership_kind,rule.position_id FROM public.office_leadership_position_rules rule
            JOIN public.ref_staff_positions p ON p.position_id=rule.position_id WHERE p.is_active=true`),
    ]) : [{ rows: [] }, { rows: [] }];
    return { offices: offices.rows, courses: courses.rows, members: members.rows, mappings: mappings.rows,
        programDirectors: programDirectors.rows, leaders: leaders.rows, eligibility: eligibility.rows, schemaReady: ready };
}

async function options(pool = db) {
    const result = await pool.query("SELECT o.office_id,o.office_code,o.office_name,o.is_active FROM public.ref_offices o WHERE COALESCE((to_jsonb(o)->>'is_institutional')::boolean,true)=true ORDER BY o.office_name");
    return result.rows;
}

function validateOffice(body) {
    const name = clean(body?.office_name), code = clean(body?.office_code).toUpperCase();
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    if (name.length < 2 || name.length > 160) fail(400, 'Enter an office name of 2–160 characters.');
    if (!code || !/^[A-Z0-9][A-Z0-9 _-]{0,19}$/.test(code)) fail(400, 'Enter an office code of up to 20 letters, numbers, spaces, hyphens, or underscores.');
    if (description.length > 2000) fail(400, 'Description must not exceed 2,000 characters.');
    const courses = body?.course_ids;
    if (!Array.isArray(courses) || courses.length > 300 || !courses.every(isUuid) || new Set(courses).size !== courses.length) fail(400, 'Select valid, unique courses.');
    const transfers = validateTransfers(body.course_transfers);
    const leaders = body.leaders || {};
    if (typeof leaders !== 'object' || Array.isArray(leaders)) fail(400, 'Select valid academic leaders.');
    if (Object.keys(leaders).some(kind => kind !== 'dean') || Object.values(leaders).some(id => id !== null && !isUuid(id))) fail(400, 'Select valid academic leaders.');
    if (body.expected_course_ids !== undefined && (!Array.isArray(body.expected_course_ids) || !body.expected_course_ids.every(isUuid))) fail(400, 'Invalid course ownership snapshot.');
    return { name, code, description, courses, transfers, leaders };
}

async function validateLeader(client, userId, kind) {
    if (!userId) return;
    const found = await client.query(`SELECT a.user_id FROM public.admin_profiles a
        JOIN public.ref_staff_positions p ON p.position_id=a.position_id AND p.is_active=true
        JOIN public.office_leadership_position_rules rule ON rule.position_id=p.position_id AND rule.leadership_kind=$2
        WHERE a.user_id=$1 AND COALESCE(a.is_archived,false)=false
        AND EXISTS(SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.role_id=ur.role_id
            WHERE ur.user_id=a.user_id AND ur.is_active=true AND r.is_active=true AND r.role_scope='staff')
        FOR UPDATE OF a`, [userId, kind]);
    if (!found.rowCount) fail(400, `Select an active, eligible ${kind === 'dean' ? 'Dean' : 'Program Director'} account.`);
}

async function saveOffice(id, body, pool = db, actorId = null) {
    if (id && !isUuid(id)) fail(400, 'Invalid office identifier.');
    const { name, code, description, courses, transfers, leaders } = validateOffice(body);
    return transaction(async client => {
        await requireSchema(client);
        let previous = null;
        let currentCourses = [];
        if (id) {
            const current = await client.query('SELECT * FROM public.ref_offices WHERE office_id=$1 FOR UPDATE', [id]);
            previous = current.rows[0];
            if (!previous) fail(404, 'Office or department not found.');
            if (!previous.is_active) fail(409, 'Restore this office before editing its configuration.');
            currentCourses = (await client.query('SELECT course_id,office_id,course_code FROM public.academic_course WHERE office_id=$1 FOR UPDATE', [id])).rows;
            if (body.expected_course_ids !== undefined && [...body.expected_course_ids].sort().join() !== currentCourses.map(course => course.course_id).sort().join()) fail(409, 'Course assignments changed. Reopen this office before saving.');
        }
        const duplicate = await client.query(`SELECT office_id FROM public.ref_offices WHERE ($3::uuid IS NULL OR office_id<>$3)
            AND (lower(regexp_replace(btrim(office_name),'\\s+',' ','g'))=lower($1) OR upper(btrim(office_code))=$2) LIMIT 1`, [name, code, id || null]);
        if (duplicate.rowCount) fail(409, 'An office with this name or code already exists. Check the archived list too.');
        const selected = courses.length ? await client.query('SELECT course_id,course_code,office_id,is_archived FROM public.academic_course WHERE course_id=ANY($1::uuid[]) FOR UPDATE', [courses]) : { rows: [], rowCount: 0 };
        if (selected.rowCount !== courses.length) fail(400, 'One or more courses no longer exist.');
        if (selected.rows.some(course => course.is_archived && (!id || course.office_id !== id))) fail(409, 'Archived courses cannot be newly assigned.');
        confirmTransfers(selected.rows, id, transfers);
        for (const [kind, userId] of Object.entries(leaders)) await validateLeader(client, userId, kind);
        const previousLeaders = id ? (await client.query('SELECT leadership_kind,user_id FROM public.office_academic_leaders WHERE office_id=$1', [id])).rows : [];
        const oldDean = previousLeaders.find(leader => leader.leadership_kind === 'dean')?.user_id || null;
        if (id && Object.hasOwn(body, 'expected_dean_user_id') && body.expected_dean_user_id !== oldDean) fail(409, 'The Dean assignment changed. Reopen this office before saving.');
        if (id && Object.hasOwn(leaders, 'dean') && oldDean !== leaders.dean && body.confirm_dean_change !== true)
            fail(409, 'Confirm changing or removing the Dean before saving.', { code: 'DEAN_CONFIRMATION_REQUIRED' });
        const result = id
            ? await client.query('UPDATE public.ref_offices SET office_name=$2,office_code=$3,description=$4,updated_at=now() WHERE office_id=$1 RETURNING *', [id, name, code, description])
            : await client.query('INSERT INTO public.ref_offices(office_name,office_code,description,is_active) VALUES($1,$2,$3,true) RETURNING *', [name, code, description]);
        const office = result.rows[0];
        if (previous && previous.office_name !== name) await client.query('UPDATE public.admin_profiles SET department=$2,updated_at=now() WHERE office_id=$1', [id, name]);
        await client.query('UPDATE public.academic_course SET office_id=NULL,updated_at=now() WHERE office_id=$1 AND NOT(course_id=ANY($2::uuid[]))', [office.office_id, courses]);
        if (courses.length) await client.query('UPDATE public.academic_course SET office_id=$1,updated_at=now() WHERE course_id=ANY($2::uuid[])', [office.office_id, courses]);
        // OFFICE_ACCOUNT_AUTOLINK_V1: keep access in sync with current office courses.
        await require('./officeAccountAccessService').refreshOffice(client, office.office_id);
        // Updates affecting course transfers also refresh prior owning offices.
        if (id) await require('./officeAccountAccessService').refreshOffice(client,id);
        for (const old of new Set(selected.rows.map(c=>c.office_id).filter(Boolean)))
          await require('./officeAccountAccessService').refreshOffice(client,old);
        // Only an explicitly selected eligible Dean receives the supplemental Dean role. PD assignments are untouched.
        for (const [kind, userId] of Object.entries(leaders)) {
            if (!userId) await client.query('DELETE FROM public.office_academic_leaders WHERE office_id=$1 AND leadership_kind=$2', [office.office_id, kind]);
            else await client.query(`INSERT INTO public.office_academic_leaders(office_id,leadership_kind,user_id,assigned_by_user_id)
                VALUES($1,$2,$3,$4) ON CONFLICT(office_id,leadership_kind) DO UPDATE
                SET user_id=excluded.user_id,assigned_by_user_id=excluded.assigned_by_user_id,assigned_at=now()`, [office.office_id, kind, userId, actorId]);
        }
        if (leaders.dean) await grantDean(client, leaders.dean);
        await revokeUnusedDean(client);
        const changes = [
            ...currentCourses.filter(course => !courses.includes(course.course_id)).map(course => ({ course_id: course.course_id, from_office_id: id, to_office_id: null })),
            ...selected.rows.filter(course => course.office_id !== office.office_id).map(course => ({ course_id: course.course_id, from_office_id: course.office_id, to_office_id: office.office_id })),
        ];
        await auditOwnership(client, changes, actorId);
        await auditOffice(client, office.office_id, id ? 'UPDATE_OFFICE' : 'CREATE_OFFICE', previous ? { ...previous, course_ids: currentCourses.map(course => course.course_id), leaders: previousLeaders } : null, { ...office, course_ids: courses, leaders }, actorId);
        return office;
    }, pool);
}

async function setOfficeStatus(id, active, pool = db, actorId = null) {
    if (!isUuid(id) || typeof active !== 'boolean') fail(400, 'Select a valid office and status.');
    return transaction(async client => {
        await requireSchema(client);
        const current = await client.query('SELECT * FROM public.ref_offices WHERE office_id=$1 FOR UPDATE', [id]);
        if (!current.rowCount) fail(404, 'Office or department not found.');
        const protectedRole = await client.query("SELECT 1 FROM public.rbac_staff_role_offices WHERE office_id=$1 AND app_role_code='admin'", [id]);
        if (protectedRole.rowCount) fail(403, 'The OSFA office is protected.');
        if (!active) {
            const occupied = await client.query('SELECT 1 FROM public.admin_profiles WHERE office_id=$1 AND COALESCE(is_archived,false)=false LIMIT 1', [id]);
            if (occupied.rowCount) fail(409, 'Reassign active staff in User Accounts before archiving this office.');
        }
        // Archival retains staff, leadership and course links for history, but removes the office from new selections.
        const result = await client.query('UPDATE public.ref_offices SET is_active=$2,updated_at=now() WHERE office_id=$1 RETURNING *', [id, active]);
        if (active) {
            const heads = await client.query("SELECT user_id FROM public.office_academic_leaders WHERE office_id=$1 AND leadership_kind='dean'", [id]);
            for (const head of heads.rows) await grantDean(client, head.user_id);
        }
        await revokeUnusedDean(client);
        await auditOffice(client, id, active ? 'RESTORE_OFFICE' : 'ARCHIVE_OFFICE', current.rows[0], result.rows[0], actorId);
        return result.rows[0];
    }, pool);
}

async function history(id, page = 1, pool = db) {
    if (!isUuid(id)) fail(400, 'Invalid office identifier.');
    const safePage = Math.max(1, Math.min(Number.parseInt(page, 10) || 1, 100000));
    const result = await pool.query(`SELECT log_id,action_taken,"timestamp",metadata,
        COALESCE(NULLIF(concat_ws(' ',a.first_name,a.last_name),''),l.actor_email,'System') AS actor_name,
        count(*) OVER() AS total_count FROM public.audit_logs l LEFT JOIN public.admin_profiles a ON a.user_id=l.user_id
        WHERE l.entity_type='ref_offices' AND l.entity_id=$1 ORDER BY l."timestamp" DESC,l.log_id DESC LIMIT 10 OFFSET $2`, [id, (safePage - 1) * 10]);
    return { items: result.rows, total: Number(result.rows[0]?.total_count || 0), page: safePage };
}
module.exports = { listOffices, options, saveOffice, setOfficeStatus, history };
