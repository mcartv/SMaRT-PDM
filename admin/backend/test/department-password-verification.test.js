const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..', '..');
const service = fs.readFileSync(path.join(root, 'backend/services/accountService.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'backend/controllers/accountController.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'backend/routes/accountRoutes.js'), 'utf8');
const frontend = fs.readFileSync(path.join(root, 'frontend/src/components/department/DepartmentSettingsPage.jsx'), 'utf8');

assert(service.includes('async function verifyCurrentStaffPassword'));
assert(service.includes('bcrypt.compare(currentPassword, passwordHash)'));
assert(service.includes("throw createHttpError(401, 'Current password is incorrect.')"));
assert(controller.includes('exports.verifyCurrentStaffPassword'));
assert(routes.includes("router.post('/me/password/verify'"));
assert(frontend.includes("/api/accounts/me/password/verify"));
assert(frontend.includes('currentPasswordVerified ? ('));
assert(frontend.includes('Verify Current Password'));
assert(frontend.includes('Current password verified'));
console.log('department password verification test passed');
