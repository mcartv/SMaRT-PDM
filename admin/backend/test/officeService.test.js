'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const OFFICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const IT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PD = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const DEAN = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
function fixture() {
    let state = {
        offices: [], courses: [{ course_id: IT, course_code: 'BSIT', course_name: 'Information Technology', office_id: null, is_archived: false }, { course_id: CS, course_code: 'BSCS', course_name: 'Computer Science', office_id: null, is_archived: false }],
        profiles: [{ user_id: PD, name: 'PD Account', office_id: OFFICE, position_id: 'pd-position', position: 'Program Director', roles: ['Program Director'], is_archived: false }, { user_id: DEAN, name: 'Dean Account', office_id: OFFICE, position_id: 'dean-position', position: 'Dean', roles: ['Program Director'], is_archived: false }],
        leaders: [], audit: [], students: [{ course_id: IT }], applications: [{ course_id: IT }], pdAssignments: [{ course_id: IT, pd_user_id: PD }], ro: [{ department_id: IT, name: 'Library', pic: PD, is_active: true }], serviceLinks: [], deanRoles: [], managedDeans: []
    };
    const calls = []; let snapshot; let ready = true; let failAudit = false;
    const rows = values => ({ rows: values, rowCount: values.length });
    const courseRows = values => rows(values.map(course => ({ ...course, office_name: state.offices.find(office => office.office_id === course.office_id)?.office_name || null })));
    async function query(sql, args = []) {
        calls.push({ sql, args }); const q = sql.replace(/\s+/g, ' ').trim();
        if (q === 'BEGIN') { snapshot = structuredClone(state); return rows([]); }
        // Custom-role accounts assigned to an office.
        // This fixture contains only built-in-role accounts.
        if (
            q.startsWith('SELECT a.user_id,r.role_code') &&
            q.includes('FROM public.admin_profiles a') &&
            q.includes('JOIN public.rbac_user_roles ur')
        ) {
            return rows([]);
        }
        if (q === 'ROLLBACK') { state = snapshot; return rows([]); }
        if (q === 'COMMIT' || q.includes('pg_advisory_xact_lock')) return rows([]);
        // OFFICE_ACCOUNT_UI_CORRECTION_20261021_V1: the original fixture contains no active custom-workspace accounts.
        if (q.startsWith('SELECT a.user_id,r.role_code FROM public.admin_profiles a')) return rows([]);
        if (q.startsWith('SELECT count(*)::int AS count FROM public.ro_area_coordinators')) return rows([{count:state.ro.filter(area=>area.department_id===args[0] && area.pic).length}]);
        if (q.includes('to_regclass')) return rows([{ ready }]);
        if (q.startsWith('WITH granted AS')) { if (!state.deanRoles.includes(args[0])) { state.deanRoles.push(args[0]); state.managedDeans.push(args[0]); } return rows([]); }
        if (q.startsWith('UPDATE public.rbac_user_roles ur')) { state.deanRoles = state.deanRoles.filter(id => !state.managedDeans.includes(id) || state.leaders.some(l => l.user_id === id && state.offices.some(o => o.office_id === l.office_id && o.is_active))); return rows([]); }
        if (q.startsWith('DELETE FROM public.office_dean_role_grants')) { state.managedDeans = state.managedDeans.filter(id => state.deanRoles.includes(id)); return rows([]); }
        if (q.startsWith('SELECT department_id,department_name,is_active FROM public.ro_departments')) return rows(state.ro.map(area => ({ ...area, department_name: area.department_name || area.name })));
        if (q.startsWith('SELECT department_id,is_active FROM public.ro_departments WHERE lower')) return rows(state.ro.filter(area => args[0].includes((area.department_name || area.name).trim().toLowerCase())));
        if (q.startsWith('INSERT INTO public.ro_departments')) { const area = { department_id: CS, department_name: args[0], is_active: true }; state.ro.push(area); return rows([area]); }
        if (q.startsWith('SELECT department_id,is_active FROM public.ro_departments')) return rows(state.ro.filter(area => area.department_id === args[0]));
        if (q.startsWith('SELECT department_id,office_id FROM public.institutional_service_area_links')) return rows(state.serviceLinks);
        if (q.startsWith('SELECT office_id,office_name,is_active FROM public.ref_offices ORDER')) return rows(state.offices);
        if (q.startsWith('SELECT office_id FROM public.institutional_service_area_links')) return rows(state.serviceLinks.filter(link => link.department_id === args[0]));
        if (q.startsWith('SELECT department_id FROM public.institutional_service_area_links')) return rows(state.serviceLinks.filter(link => link.office_id === args[0] && link.department_id !== args[1]));
        if (q.startsWith('INSERT INTO public.institutional_service_area_links')) { state.serviceLinks = state.serviceLinks.filter(link => link.department_id !== args[0]); state.serviceLinks.push({ department_id: args[0], office_id: args[1] }); return rows([]); }
        if (q.startsWith('DELETE FROM public.institutional_service_area_links')) { state.serviceLinks = state.serviceLinks.filter(link => link.department_id !== args[0]); return rows([]); }
        if (q.startsWith('SELECT user_id FROM public.office_academic_leaders')) return rows(state.leaders.filter(item => item.office_id === args[0]));
        if (q.startsWith('SELECT c.office_id,c.course_id')) return rows(state.pdAssignments.map(assignment => { const course = state.courses.find(item => item.course_id === assignment.course_id); const person = state.profiles.find(item => item.user_id === assignment.pd_user_id); return { ...course, user_id: person.user_id, name: person.name, position: person.position }; }));
        if (q.startsWith('SELECT o.*')) return rows(state.offices.map(office => ({ ...office, is_protected: office.is_protected || false })));
        if (q.startsWith('SELECT c.course_id,c.course_code') || q.includes('FROM academic_course course')) return courseRows(state.courses);
        if (q.startsWith('SELECT a.user_id,a.office_id')) return rows(state.profiles);
        if (q.startsWith('SELECT office_id,app_role_code')) return rows([]);
        if (q.startsWith('SELECT office_id,leadership_kind')) return rows(state.leaders);
        if (q.startsWith('SELECT rule.leadership_kind')) return rows([{ leadership_kind: 'dean', position_id: 'dean-position' }, { leadership_kind: 'program_director', position_id: 'pd-position' }]);
        if (q.startsWith('SELECT * FROM public.ref_offices') || q.startsWith('SELECT office_id,office_name,is_active')) return rows(state.offices.filter(office => office.office_id === args[0]));
        if (q.startsWith('SELECT 1 FROM public.rbac_staff_role_offices')) return rows(state.offices.some(office => office.office_id === args[0] && office.is_protected) ? [{}] : []);
        if (q.startsWith('SELECT 1 FROM public.admin_profiles')) return rows(state.profiles.filter(person => person.office_id === args[0] && !person.is_archived));
        if (q.startsWith('SELECT office_id FROM public.ref_offices')) return rows(state.offices.filter(office => office.office_id !== args[2] && (office.office_name.toLowerCase() === args[0].toLowerCase() || office.office_code.toUpperCase() === args[1])));
        if (q.startsWith('SELECT course_id,office_id,course_code')) return courseRows(state.courses.filter(course => course.office_id === args[0]));
        if (q.startsWith('SELECT course_id,course_code,office_id,is_archived')) return courseRows(state.courses.filter(course => args[0].includes(course.course_id)));
        if (q.startsWith('SELECT a.user_id FROM public.admin_profiles')) return rows(state.profiles.filter(person => person.user_id === args[0] && !person.is_archived && person.roles.length && person.position_id === (args[1] === 'dean' ? 'dean-position' : 'pd-position')));
        if (q.startsWith('SELECT leadership_kind,user_id')) return rows(state.leaders.filter(leader => leader.office_id === args[0]));
        if (q.startsWith('INSERT INTO public.ref_offices')) { const office = { office_id: state.offices.length ? OTHER : OFFICE, office_name: args[0], office_code: args[1], description: args[2], is_active: true }; state.offices.push(office); return rows([office]); }
        if (q.startsWith('UPDATE public.ref_offices')) { const office = state.offices.find(item => item.office_id === args[0]); if (q.includes('SET is_active')) office.is_active = args[1]; else Object.assign(office, { office_name: args[1], office_code: args[2], description: args[3] }); return rows([office]); }
        if (q.startsWith('UPDATE public.admin_profiles a SET institutional_primary_role')) return rows([]);
        if (q.startsWith('UPDATE public.admin_profiles')) { state.profiles.filter(person => person.office_id === args[0]).forEach(person => { person.department = args[1]; }); return rows([]); }
        if (q.startsWith('UPDATE public.academic_course SET office_id=NULL')) { state.courses.filter(course => course.office_id === args[0] && !args[1].includes(course.course_id)).forEach(course => { course.office_id = null; }); return rows([]); }
        if (q.startsWith('UPDATE public.academic_course SET office_id=$1')) { state.courses.filter(course => args[1].includes(course.course_id)).forEach(course => { course.office_id = args[0]; }); return rows([]); }
        if (q.startsWith('DELETE FROM public.office_academic_leaders')) { state.leaders = state.leaders.filter(leader => leader.office_id !== args[0] || leader.leadership_kind !== args[1]); return rows([]); }
        if (q.startsWith('INSERT INTO public.office_academic_leaders')) { state.leaders = state.leaders.filter(leader => leader.office_id !== args[0] || leader.leadership_kind !== args[1]); const leader = { office_id: args[0], leadership_kind: args[1], user_id: args[2] }; state.leaders.push(leader); return rows([leader]); }
        if (q.startsWith('INSERT INTO public.audit_logs')) { if (failAudit) throw Error('Audit insert failed'); state.audit.push({ office_id: args[2], action: args[1], metadata: JSON.parse(args[4]) }); return rows([]); }
        if (q.startsWith('SELECT * FROM public.academic_course')) return courseRows(state.courses.filter(course => course.course_id === args[0]));
        if (q.startsWith('SELECT course_id FROM public.academic_course')) return rows(state.courses.filter(course => course.course_code.toUpperCase() === args[0].toUpperCase() && course.course_id !== args[1]));
        if (q.startsWith('UPDATE public.academic_course SET course_code')) { const course = state.courses.find(item => item.course_id === args[4]); Object.assign(course, { course_code: args[0], course_name: args[1], is_archived: args[2], office_id: args[3] }); return courseRows([course]); }
        if (q.startsWith('INSERT INTO public.academic_course')) { const course = { course_id: '12345678-1234-4234-8234-123456789012', course_code: args[0], course_name: args[1], is_archived: args[2], office_id: args[3] }; state.courses.push(course); return courseRows([course]); }
        if (q.startsWith('SELECT log_id')) {
            const entries = state.audit.filter(entry => entry.office_id === args[0]).reverse();
            return rows(entries.slice(args[1], args[1] + 10).map((entry, index) => ({ log_id: String(args[1] + index), action_taken: entry.action, timestamp: new Date().toISOString(), actor_name: 'Test coordinator', metadata: entry.metadata, total_count: entries.length })));
        }
        throw Error('Unhandled test SQL: ' + q);
    }
    const pool = { query, connect: async () => ({ query, release() { calls.push({ sql: 'RELEASE', args: [] }); } }) };
    const real = Module._load;
    for (const file of ['officeService', 'courseService', 'institutionalRelationsService', 'institutionalCommunityService']) delete require.cache[require.resolve('../services/' + file)];
    Module._load = function (request) { if (request === '../config/db') return pool; return real.apply(this, arguments); };
    let offices, courses, community;
    try { offices = require('../services/officeService'); courses = require('../services/courseService'); community = require('../services/institutionalCommunityService'); } finally { Module._load = real; }
    return { offices, courses, community, pool, calls, get state() { return state; }, missingMigration() { ready = false; }, failAudit() { failAudit = true; } };
}
const officeBody = (extra = {}) => ({ office_name: 'College of Computer Studies', office_code: 'CCS', description: 'Academic office', course_ids: [IT, CS], leaders: { dean: DEAN }, ...extra });

test('create office with two dynamic course IDs and display ownership from both modules', async () => {
    const f = fixture(); await f.offices.saveOffice(null, officeBody(), f.pool);
    const overview = await f.offices.listOffices(f.pool), courses = await f.courses.fetchCourses();
    assert.equal(overview.offices[0].office_code, 'CCS');
    assert.deepEqual(overview.courses.map(course => course.office_id), [OFFICE, OFFICE]);
    assert.ok(courses.every(course => course.office_name === 'College of Computer Studies'));
    assert.equal(f.state.leaders.length, 1);
    assert.ok(f.state.audit.some(entry => entry.action === 'CREATE_OFFICE'));
});

test('removing a saved course link synchronizes office and course lists without deleting history', async () => {
    const f = fixture(); await f.offices.saveOffice(null, officeBody(), f.pool);
    const historical = structuredClone({ students: f.state.students, applications: f.state.applications, pd: f.state.pdAssignments, ro: f.state.ro });
    await f.offices.saveOffice(OFFICE, officeBody({ course_ids: [IT], expected_course_ids: [IT, CS] }), f.pool);
    assert.equal((await f.courses.fetchCourses()).find(course => course.course_id === CS).office_id, null);
    assert.equal((await f.offices.listOffices(f.pool)).courses.filter(course => course.office_id === OFFICE).length, 1);
    assert.deepEqual({ students: f.state.students, applications: f.state.applications, pd: f.state.pdAssignments, ro: f.state.ro }, historical);
});

test('course transfer requires exact previous-owner confirmation and rejects stale ownership', async () => {
    const f = fixture(); await f.offices.saveOffice(null, officeBody(), f.pool);
    const body = officeBody({ office_name: 'Hospitality', office_code: 'CHTM', course_ids: [CS], leaders: {} });
    await assert.rejects(f.offices.saveOffice(null, body, f.pool), { statusCode: 409, code: 'COURSE_REASSIGNMENT_REQUIRED' });
    await assert.rejects(f.offices.saveOffice(null, { ...body, course_transfers: [{ course_id: CS, from_office_id: OTHER }] }, f.pool), { statusCode: 409 });
    await f.offices.saveOffice(null, { ...body, course_transfers: [{ course_id: CS, from_office_id: OFFICE }] }, f.pool);
    assert.equal(f.state.courses.find(course => course.course_id === CS).office_id, OTHER);
    await assert.rejects(f.offices.saveOffice(OFFICE, officeBody({ expected_course_ids: [IT, CS] }), f.pool), { statusCode: 409 });
});

test('Courses edit uses the same ownership link and confirms moving or removing an existing office', async () => {
    const f = fixture(); await f.offices.saveOffice(null, officeBody(), f.pool);
    await f.offices.saveOffice(null, officeBody({ office_name: 'Hospitality', office_code: 'CHTM', course_ids: [], leaders: {} }), f.pool);
    await assert.rejects(f.courses.updateCourse(IT, { office_id: OTHER, previous_office_id: OFFICE }), { code: 'COURSE_REASSIGNMENT_REQUIRED' });
    await f.courses.updateCourse(IT, { office_id: OTHER, previous_office_id: OFFICE, confirm_office_change: true });
    assert.equal((await f.offices.listOffices(f.pool)).courses.find(course => course.course_id === IT).office_id, OTHER);
    await assert.rejects(f.courses.updateCourse(IT, { office_id: null, previous_office_id: OFFICE, confirm_office_change: true }), { statusCode: 409 });
    await f.courses.updateCourse(IT, { office_id: null, previous_office_id: OTHER, confirm_office_change: true });
    assert.equal(f.state.courses.find(course => course.course_id === IT).office_id, null);
});

test('leadership requires approved active positions and never grants administrator permissions or changes PIC/PD work', async () => {
    const f = fixture();
    await assert.rejects(f.offices.saveOffice(null, officeBody({ leaders: { dean: PD } }), f.pool), { statusCode: 400 });
    f.state.profiles.find(person => person.user_id === DEAN).is_archived = true;
    await assert.rejects(f.offices.saveOffice(null, officeBody(), f.pool), { statusCode: 400 });
    f.state.profiles.find(person => person.user_id === DEAN).is_archived = false;
    const ro = structuredClone(f.state.ro), pd = structuredClone(f.state.pdAssignments);
    await f.offices.saveOffice(null, officeBody(), f.pool);
    assert.deepEqual(f.state.ro, ro); assert.deepEqual(f.state.pdAssignments, pd);
    assert.ok(!f.calls.some(call => /^(INSERT INTO|UPDATE|DELETE FROM)\s+public\.(ro_|rbac_role_permissions)/.test(call.sql)));
    assert.ok(f.calls.some(call => call.sql.includes("role_code='dean'")));
    assert.equal((await f.offices.listOffices(f.pool)).programDirectors[0].course_id, IT);
    assert.equal((await f.offices.listOffices(f.pool)).members[0].roles[0], 'Program Director');
});

test('Dean replacement/removal requires confirmation; only managed supplemental grants are revoked', async () => {
    const f = fixture();
    await f.offices.saveOffice(null, officeBody(), f.pool);
    assert.deepEqual(f.state.deanRoles, [DEAN]);
    await assert.rejects(f.offices.saveOffice(OFFICE, officeBody({ leaders: { dean: null } }), f.pool), { statusCode: 409 });
    assert.equal(f.state.leaders[0].user_id, DEAN);
    await assert.rejects(f.offices.saveOffice(OFFICE, officeBody({ leaders: { dean: null }, expected_dean_user_id: PD, confirm_dean_change: true }), f.pool), { statusCode: 409 });
    await f.offices.saveOffice(OFFICE, officeBody({ leaders: { dean: null }, expected_dean_user_id: DEAN, confirm_dean_change: true }), f.pool);
    assert.equal(f.state.leaders.length, 0); assert.deepEqual(f.state.deanRoles, []);
    f.state.deanRoles.push(DEAN); // Previously granted manually, outside office management.
    await f.offices.saveOffice(OFFICE, officeBody({ confirm_dean_change: true }), f.pool);
    await f.offices.saveOffice(OFFICE, officeBody({ leaders: { dean: null }, confirm_dean_change: true }), f.pool);
    assert.deepEqual(f.state.deanRoles, [DEAN]);
});

test('Program Directors follow their course ownership without modifying review assignments', async () => {
    const f = fixture(); await f.offices.saveOffice(null, officeBody(), f.pool);
    assert.equal((await f.offices.listOffices(f.pool)).programDirectors[0].office_id, OFFICE);
    await f.offices.saveOffice(null, officeBody({ office_name: 'Hospitality', office_code: 'CHTM', course_ids: [], leaders: {} }), f.pool);
    await f.courses.updateCourse(IT, { course_code: 'BSIT', course_name: 'Information Technology', office_id: OTHER, previous_office_id: OFFICE, confirm_office_change: true });
    assert.equal((await f.offices.listOffices(f.pool)).programDirectors[0].office_id, OTHER);
    assert.deepEqual(f.state.pdAssignments, [{ course_id: IT, pd_user_id: PD }]);
});

test('Community Service links are optional, unique, stale-safe and independent of eligibility/PIC/course ownership', async () => {
    const f = fixture(); await f.offices.saveOffice(null, officeBody(), f.pool);
    const before = structuredClone({ ro: f.state.ro, courses: f.state.courses, pd: f.state.pdAssignments });
    assert.deepEqual((await f.community.getLinks(f.pool)).links, []);
    await f.community.setLink(IT, OFFICE, null, f.pool);
    assert.deepEqual((await f.community.getLinks(f.pool)).links, [{ department_id: IT, office_id: OFFICE }]);
    await assert.rejects(f.community.setLink(IT, null, null, f.pool), { statusCode: 409 });
    f.state.ro.push({ department_id: CS, is_active: true });
    await assert.rejects(f.community.setLink(CS, OFFICE, null, f.pool), { statusCode: 409 });
    f.state.ro.pop();
    await f.community.setLink(IT, null, OFFICE, f.pool);
    assert.deepEqual(f.state.serviceLinks, []);
    assert.deepEqual({ ro: f.state.ro, courses: f.state.courses, pd: f.state.pdAssignments }, before);
    f.missingMigration();
    assert.equal((await f.community.getLinks(f.pool)).ready, false);
    await assert.rejects(f.community.setLink(IT, OFFICE, null, f.pool), { statusCode: 503 });
});

test('using an office as a service area creates once, supports existing areas and preserves academic/PIC records', async () => {
    const f = fixture(); await f.offices.saveOffice(null, officeBody(), f.pool);
    const historical = structuredClone({ courses: f.state.courses, pd: f.state.pdAssignments, pic: f.state.ro[0] });
    const created = await f.community.useOfficeAsArea(OFFICE, null, f.pool);
    assert.equal(created.department_id, CS);
    assert.equal(f.state.ro.length, 2);
    const repeated = await f.community.useOfficeAsArea(OFFICE, null, f.pool);
    assert.equal(repeated.department_id, CS); assert.equal(repeated.already_linked, true);
    assert.equal(f.state.ro.length, 2);
    await assert.rejects(f.community.useOfficeAsArea(OFFICE, IT, f.pool), { statusCode: 409 });
    await f.community.setLink(CS, null, OFFICE, f.pool);
    await f.community.useOfficeAsArea(OFFICE, IT, f.pool);
    assert.equal(f.state.ro.length, 2);
    assert.deepEqual({ courses: f.state.courses, pd: f.state.pdAssignments, pic: f.state.ro[0] }, historical);
    f.state.ro[1].is_active = false;
    await assert.rejects(f.community.useOfficeAsArea(OTHER, CS, f.pool), { statusCode: 400 });
});

test('failed audit rolls office, course and leadership changes back together', async () => {
    const f = fixture(); f.failAudit();
    await assert.rejects(f.offices.saveOffice(null, officeBody(), f.pool), /Audit insert failed/);
    assert.equal(f.state.offices.length, 0); assert.equal(f.state.leaders.length, 0);
    assert.ok(f.state.courses.every(course => course.office_id === null));
    assert.ok(f.calls.some(call => call.sql === 'ROLLBACK'));
});

test('archive protects active account workflows and preserves links when archived then restored', async () => {
    const f = fixture(); await f.offices.saveOffice(null, officeBody(), f.pool);
    await assert.rejects(f.offices.setOfficeStatus(OFFICE, false, f.pool), { statusCode: 409 });
    f.state.profiles.forEach(person => { person.is_archived = true; });
    await f.offices.setOfficeStatus(OFFICE, false, f.pool);
    assert.equal(f.state.offices[0].is_active, false); assert.equal(f.state.courses[0].office_id, OFFICE);
    await assert.rejects(f.courses.createCourse({ course_code: 'NEW', course_name: 'New', office_id: OFFICE }), { statusCode: 400 });
    await f.offices.setOfficeStatus(OFFICE, true, f.pool);
    assert.equal(f.state.offices[0].is_active, true); assert.equal(f.state.leaders.length, 1);
});

test('missing migration is read-safe and fails closed before mutation', async () => {
    const f = fixture(); f.missingMigration();
    const overview = await f.offices.listOffices(f.pool); assert.equal(overview.schemaReady, false);
    await assert.rejects(f.offices.saveOffice(null, officeBody(), f.pool), { statusCode: 503 });
    assert.equal(f.state.offices.length, 0);
});

test('invalid IDs, duplicates, protected offices and excessive data are rejected', async () => {
    const f = fixture();
    for (const body of [officeBody({ course_ids: [IT, IT] }), officeBody({ office_code: '' }), officeBody({ description: 'x'.repeat(2001) }), officeBody({ leaders: { other: DEAN } })]) await assert.rejects(f.offices.saveOffice(null, body, f.pool), { statusCode: 400 });
    await f.offices.saveOffice(null, officeBody(), f.pool);
    await assert.rejects(f.offices.saveOffice(null, officeBody(), f.pool), { statusCode: 409 });
    f.state.offices[0].is_protected = true;
    await f.offices.saveOffice(OFFICE, officeBody({ description: 'Updated protected office details' }), f.pool);
    assert.equal(f.state.offices[0].description, 'Updated protected office details');
    await assert.rejects(f.offices.setOfficeStatus(OFFICE, false, f.pool), { statusCode: 403 });
});

// Endpoint authorization is verified with real permission middleware in enforce mode.
test('office endpoints require authentication, admin role and their specific backend permissions', async () => {
    const routes = new Map(); let globalHandlers;
    const router = { use(...handlers) { globalHandlers = handlers; } };
    for (const method of ['get', 'post', 'patch', 'put']) router[method] = (route, ...handlers) => routes.set(method + ' ' + route, handlers.flat());
    const real = Module._load;
    const mode = process.env.RBAC_PERMISSION_MODE; process.env.RBAC_PERMISSION_MODE = 'enforce';
    const middlewarePath = require.resolve('../middleware/rbacMiddleware'); delete require.cache[middlewarePath];
    const routePath = require.resolve('../routes/officeRoutes'); delete require.cache[routePath];
    let permitted = new Set();
    Module._load = function (request, parent) {
        if (request === 'express') return { Router: () => router };
        if (request === '../middleware/authMiddleware') return { protect: (req, res, next) => req.user ? next() : res.status(401).json({}), authorizeRoles: () => (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({}) };
        if (request === '../services/rbacService') return { hasPermission: async (_id, code) => permitted.has(code) };
        if (request === '../config/db') return { query: async () => ({ rows: [] }) };
        if (request === '../services/officeService' && parent?.filename === routePath) return { listOffices: async () => ({ offices: [] }) };
        if (['../utils/socketEvents', '../config/appCache'].includes(request)) return {};
        return real.apply(this, arguments);
    };
    try {
        require('../routes/officeRoutes');
        for (const [user, grants, expected] of [[null, [], 401], [{ role: 'sdo', user_id: PD }, [], 403], [{ role: 'admin', user_id: PD }, [], 403], [{ role: 'admin', user_id: PD }, ['settings.view', 'accounts.view', 'courses.view'], 200]]) {
            permitted = new Set(grants); let status = 200, done = false;
            const res = { status(code) { status = code; return this; }, set() { }, json() { done = true; } };
            const handlers = [...globalHandlers, ...routes.get('get /')];
            for (const handler of handlers) { let next = false; await handler({ user, method: 'GET', path: '/offices' }, res, () => { next = true; }); if (!next || done) break; }
            assert.equal(status, expected);
        }
        assert.equal(routes.get('get /:id/history').length, 5);
        assert.equal(routes.get('post /').length, 4);
        for (const grants of [[], ['settings.manage'], ['ro.settings_manage']]) {
            permitted = new Set(grants); let status = 200;
            const res = { status(code) { status = code; return this; }, json() { } };
            for (const handler of [...globalHandlers, ...routes.get('post /:id/community-area')]) {
                let next = false;
                await handler({ user: { role: 'admin', user_id: PD }, method: 'POST', path: '/offices/community-area' }, res, () => { next = true; });
                if (!next) break;
            }
            assert.equal(status, 403, 'Office-to-area creation requires both office settings and Community Service management permissions');
        }
    } finally { Module._load = real; if (mode === undefined) delete process.env.RBAC_PERMISSION_MODE; else process.env.RBAC_PERMISSION_MODE = mode; delete require.cache[middlewarePath]; delete require.cache[routePath]; }
});


test('verified college aliases reuse existing areas; ambiguous or inactive matches never create duplicates', async () => {
    for (const [name, alias] of [['College of Computer Studies (CCS)', 'CCS Office'], ['College of Hospitality and Tourism Management (CHTM)', 'CHTM Office'], ['Student Welfare and Development Office', 'Student Disciplinary Office']]) {
        const f = fixture();
        f.state.offices.push({ office_id: OFFICE, office_name: name, is_active: true });
        f.state.ro[0].name = alias;
        const before = structuredClone(f.state.ro);
        const linked = await f.community.useOfficeAsArea(OFFICE, null, f.pool);
        assert.equal(linked.department_id, IT);
        assert.deepEqual(f.state.ro, before);
        assert.equal((await f.community.useOfficeAsArea(OFFICE, null, f.pool)).already_linked, true);
    }
    const f = fixture();
    f.state.offices.push({ office_id: OFFICE, office_name: 'College of Computer Studies (CCS)', is_active: true });
    f.state.ro[0].name = 'CCS Office';
    f.state.ro[0].is_active = false;
    await assert.rejects(f.community.useOfficeAsArea(OFFICE, null, f.pool), { statusCode: 409 });
    f.state.ro[0].is_active = true;
    f.state.ro.push({ department_id: CS, name: 'College of Computer Studies (CCS)', is_active: true });
    await assert.rejects(f.community.useOfficeAsArea(OFFICE, null, f.pool), { statusCode: 409 });
    assert.equal(f.state.serviceLinks.length, 0);
    assert.equal(f.state.ro.length, 2);
});
