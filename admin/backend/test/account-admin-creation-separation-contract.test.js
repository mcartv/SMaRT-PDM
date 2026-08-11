const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('normal Create Account excludes Admin and Create Admin Account has a separate UI flow', () => {
    const source = read('frontend/src/pages/maintenance/AccountsPanel.jsx');

    assert.match(source, /const OPERATIONAL_ROLE_OPTIONS = ROLE_OPTIONS\.filter\(\(option\) => option\.value !== 'admin'\)/);
    assert.match(source, /Create Account/);
    assert.match(source, /Create Admin Account/);
    assert.match(source, /OPERATIONAL_ROLE_OPTIONS\.map/);
    assert.match(source, /buildApiUrl\('\/api\/accounts\/staff'\)/);
    assert.match(source, /buildApiUrl\('\/api\/accounts\/admin'\)/);
    assert.doesNotMatch(
        source,
        /Create Account/,
        'The ordinary creation action should use the approved Create Account wording.'
    );
});

test('backend exposes a separate Admin creation endpoint', () => {
    const routes = read('backend/routes/accountRoutes.js');
    const controller = read('backend/controllers/accountController.js');

    assert.match(
        routes,
        /router\.post\('\/staff', protect, authorizeRoles\('admin'\), accountController\.createStaffAccount\)/
    );
    assert.match(
        routes,
        /router\.post\('\/admin', protect, authorizeRoles\('admin'\), accountController\.createAdminAccount\)/
    );
    assert.match(controller, /exports\.createAdminAccount = async/);
    assert.match(controller, /CREATE_ADMIN_ACCOUNT/);
});

test('ordinary account creation rejects Admin while dedicated Admin creation fixes the role and office', () => {
    const service = read('backend/services/accountService.js');

    assert.match(
        service,
        /const OPERATIONAL_ROLE_VALUES = \['pd', 'guidance', 'sdo', 'ro_coordinator'\]/
    );
    assert.match(
        service,
        /Admin accounts must be created through Create Admin Account\./
    );
    assert.match(service, /async function createAdminAccount\(payload, actorUserId = null\)/);
    assert.match(service, /const config = ROLE_CONFIG\.admin/);
    assert.match(service, /role: 'admin'/);
    assert.match(service, /department: config\.department/);
    assert.match(service, /position: config\.position/);
});

test('Admin and department accounts cannot be converted into each other through Edit Account', () => {
    const service = read('backend/services/accountService.js');
    const frontend = read('frontend/src/pages/maintenance/AccountsPanel.jsx');

    assert.match(service, /const crossesAdminBoundary =/);
    assert.match(
        service,
        /Admin accounts and department accounts cannot be converted into each other/
    );

    assert.match(
        frontend,
        /const editRoleOptions = form\.role === 'admin'[\s\S]*OPERATIONAL_ROLE_OPTIONS/
    );
    assert.match(frontend, /disabled=\{saving \|\| form\.role === 'admin'\}/);
    assert.match(
        frontend,
        /Department roles can change among PD, SDO, Guidance, and RO Coordinator, but cannot become Admin\./
    );
});
