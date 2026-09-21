const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('web login uses Admin email and department username as role-aware identifiers', () => {
    const controller = read('controllers/authController.js');
    const loginCard = read('../frontend/src/components/auth/UnifiedUserLoginCard.jsx');
    const authService = read('../frontend/src/services/authService.js');

    assert.match(controller, /resolvedRole === 'admin'[\s\S]*user\.email[\s\S]*user\.username/);
    assert.match(controller, /normalizedIdentifier !== expectedIdentifier/);
    assert.match(loginCard, /Admin email or department username/);
    assert.match(authService, /identifier:\s*String\(identifier/);
});

test('Maintenance keeps department email and manages a unique sign-in username', () => {
    const accountService = read('services/accountService.js');
    const accountsPanel = read('../frontend/src/pages/maintenance/AccountsPanel.jsx');
    const departmentSettings = read('../frontend/src/components/department/DepartmentSettingsPage.jsx');

    assert.match(accountService, /username:\s*usernameSchema/);
    assert.match(accountService, /\.min\(5, 'Username must be at least 5 characters\.'\)/);
    assert.match(accountService, /\[a-z0-9\._@-\]/);
    assert.match(accountService, /Another account is already using this username/);
    assert.match(accountsPanel, /Sign-in Username/);
    assert.match(accountsPanel, /Kept for the profile and account contact/);
    assert.match(departmentSettings, /Sign-in username/);
    assert.match(departmentSettings, /Contact email/);
    assert.doesNotMatch(departmentSettings, /Sign-in email/);
});
