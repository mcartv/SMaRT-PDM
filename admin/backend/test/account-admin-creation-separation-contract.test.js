'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('ordinary and Admin account creation remain separate current-system flows', () => {
  const panel = read('frontend/src/pages/maintenance/AccountsPanel.jsx');
  const routes = read('backend/routes/accountRoutes.js');
  const service = read('backend/services/accountService.js');

  assert.match(panel, /Create Account/);
  assert.match(panel, /Create Admin Account/);
  assert.match(panel, /OPERATIONAL_ROLE_OPTIONS/);

  assert.match(routes, /router\.post\('\/staff'[\s\S]*createStaffAccount/);
  assert.match(routes, /router\.post\('\/admin'[\s\S]*createAdminAccount/);

  assert.match(
    service,
    /const OPERATIONAL_ROLE_VALUES = \['pd', 'guidance', 'sdo', 'ro_coordinator'\]/
  );
  assert.match(service, /async function createAdminAccount/);
});

test('Edit Account keeps the Admin boundary enforced', () => {
  const panel = read('frontend/src/pages/maintenance/AccountsPanel.jsx');
  const service = read('backend/services/accountService.js');

  assert.match(service, /crossesAdminBoundary/);
  assert.match(
    service,
    /Admin accounts and department accounts cannot be converted into each other/
  );
  assert.match(panel, /editRoleOptions/);
});

test('Create and Edit Account enforce the same optional Philippine mobile format', () => {
  const panel = read('frontend/src/pages/maintenance/AccountsPanel.jsx');
  const service = read('backend/services/accountService.js');

  assert.ok(panel.includes('const PHONE_NUMBER_PATTERN = /^09\\d{9}$/;'));
  assert.ok(panel.includes('function validateOptionalPhoneNumber(value)'));
  assert.match(
    panel,
    /function validateCreateForm[\s\S]*?validateOptionalPhoneNumber\(form\.phone_number\)/
  );
  assert.match(
    panel,
    /function validateEditForm[\s\S]*?validateOptionalPhoneNumber\(form\.phone_number\)/
  );
  assert.equal((panel.match(/inputMode="numeric"/g) || []).length >= 2, true);
  assert.equal((panel.match(/maxLength=\{11\}/g) || []).length >= 2, true);

  assert.ok(service.includes('const PHONE_NUMBER_PATTERN = /^09\\d{9}$/;'));
  assert.ok(service.includes('phone_number: optionalPhoneNumberSchema'));
  assert.match(
    service,
    /payload\.phone_number !== undefined[\s\S]*?validateOptionalPhoneNumber\(payload\.phone_number\)/
  );

  const isValidOptionalPhone = (value) => !value || /^09\d{9}$/.test(value);
  assert.equal(isValidOptionalPhone(''), true);
  assert.equal(isValidOptionalPhone('09123456789'), true);
  assert.equal(isValidOptionalPhone('08123456789'), false);
  assert.equal(isValidOptionalPhone('0912345678'), false);
  assert.equal(isValidOptionalPhone('091234567890'), false);
  assert.equal(isValidOptionalPhone('+639123456789'), false);
  assert.equal(isValidOptionalPhone('0912-345-6789'), false);
});

test('Create Account modals preserve drafts on backdrop clicks and expose clear close controls', () => {
  const panel = read('frontend/src/pages/maintenance/AccountsPanel.jsx');
  const createModal = panel.slice(
    panel.indexOf('function AccountCreateModal'),
    panel.indexOf('function AdminCreateModal')
  );
  const adminCreateModal = panel.slice(
    panel.indexOf('function AdminCreateModal'),
    panel.indexOf('function AccountEditModal')
  );
  const createOverlayOpening = createModal.slice(
    createModal.indexOf('return ('),
    createModal.indexOf('<div className="max-h')
  );
  const adminOverlayOpening = adminCreateModal.slice(
    adminCreateModal.indexOf('return ('),
    adminCreateModal.indexOf('<div className="max-h')
  );

  assert.doesNotMatch(createOverlayOpening, /onClick=\{onClose\}/);
  assert.doesNotMatch(adminOverlayOpening, /onClick=\{onClose\}/);
  assert.match(createModal, /aria-label="Close Create Account"/);
  assert.match(adminCreateModal, /aria-label="Close Create Admin Account"/);
  assert.equal((panel.match(/placeholder="name@example\.com"/g) || []).length >= 3, true);
  assert.match(panel, /import \{ createPortal \} from 'react-dom'/);
  assert.match(panel, /function AccountModalPortal\(\{ children \}\)/);
  assert.equal((panel.match(/<AccountModalPortal>/g) || []).length >= 4, true);
  assert.match(createModal, /showPdCourseGroup=\{false\}/);
});

test('Accounts can be filtered individually and grouped into organized role sections', () => {
  const panel = read('frontend/src/pages/maintenance/AccountsPanel.jsx');
  const groupHeader = panel.slice(
    panel.indexOf("if (item.type === 'group')"),
    panel.indexOf('const account = item.account')
  );

  assert.ok(
    panel.includes(
      "const ACCOUNT_ROLE_GROUP_ORDER = ['admin', 'sdo', 'guidance', 'pd', 'ro_coordinator'];"
    )
  );
  assert.match(panel, /<SelectItem value="sdo">Student Discipline Officer<\/SelectItem>/);
  assert.match(panel, /<SelectItem value="guidance">Guidance Counselor \(GCO\)<\/SelectItem>/);
  assert.match(panel, /const \[roleFilter, setRoleFilter\] = useState\('grouped'\)/);
  assert.match(panel, /<SelectItem value="grouped">Group by Role<\/SelectItem>/);
  assert.doesNotMatch(panel, /<label[^>]*>Group Accounts<\/label>/);
  assert.match(
    panel,
    /accountCreatedTimestamp\(right\.created_at\) - accountCreatedTimestamp\(left\.created_at\)/
  );
  assert.match(panel, /accountListItems\.map\(\(item\) =>/);
  assert.match(panel, /item\.type === 'group'/);
  assert.doesNotMatch(groupHeader, /roleTone|rounded-full/);
  assert.match(panel, /Date Created: \{formatAccountCreatedDate\(account\.created_at\)\}/);
  assert.match(panel, /Account Management/);
  assert.match(
    panel,
    /Manage authorized staff accounts, role assignments, and Program Director course access\./
  );
  assert.doesNotMatch(panel, /activePdCount|activeRoleCount|assignedCourseCount|Account Records|Account Overview/);
});
