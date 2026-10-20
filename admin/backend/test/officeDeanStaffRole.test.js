'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { syncStaffReferences } = require('../utils/syncStaffReferences');
const { resolveStaffRole } = require('../utils/staffRoles');

function staffFixture() {
    const roles = { pd: true, dean: true, admin: false };
    const calls = [];
    const client = { async query(sql, args = []) {
        calls.push(sql);
        if (sql.startsWith('SELECT role_id')) return { rows: [{ role_id: 'pd' }], rowCount: 1 };
        if (sql.startsWith('UPDATE public.rbac_user_roles')) { roles.pd = false; if (args[1]) roles.dean = false; }
        else if (sql.startsWith('INSERT INTO public.rbac_user_roles') && sql.includes('VALUES')) roles[args[1]] = args[2];
        else if (sql.startsWith('SELECT to_regclass')) return { rows: [{ ready: true }] };
        else if (sql.startsWith('SELECT 1 FROM public.office_academic_leaders')) return { rows: [{}], rowCount: 1 };
        else if (sql.startsWith('WITH granted AS')) roles.dean = true;
        return { rows: [], rowCount: 0 };
    } };
    return { client, roles, calls };
}
test('editing a Dean preserves the primary PD role and supplemental Dean role without administrator access', async () => {
    const f = staffFixture();
    await syncStaffReferences(f.client, 'staff', { role: 'pd', department: 'College', position: 'Dean' });
    assert.deepEqual(f.roles, { pd: true, dean: true, admin: false });
    assert.equal(resolveStaffRole({ rbac_staff_role: 'pd', user_role: 'Admin', position: 'Dean' }), 'pd');
    assert.ok(!f.calls.some(sql => sql.includes('INSERT INTO public.rbac_role_permissions')));
});
test('archiving and restoring an assigned Dean disables then restores supplemental access with the existing primary role', async () => {
    const f = staffFixture();
    await syncStaffReferences(f.client, 'staff', { role: 'pd', department: 'College', position: 'Dean', archived: true });
    assert.deepEqual(f.roles, { pd: false, dean: false, admin: false });
    await syncStaffReferences(f.client, 'staff', { role: 'pd', department: 'College', position: 'Dean', archived: false });
    assert.deepEqual(f.roles, { pd: true, dean: true, admin: false });
});

test('standalone Dean identity cannot fall back to the Admin backing account family', () => {
    assert.equal(resolveStaffRole({rbac_staff_role:'dean',user_role:'Admin',admin_id:'profile',position:'Dean'}),'dean');
    assert.equal(resolveStaffRole({rbac_staff_role:'pd',user_role:'Admin',position:'Dean'}),'pd');
});
