const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('restoring a PD revives only the latest released course batch', () => {
    const accountService = read('services/accountService.js');
    const assignmentService = read('services/pdCourseAssignmentService.js');

    assert.match(
        accountService,
        /existing\.role === 'pd'[\s\S]*restoreLatestReleasedAssignments\(userId, client\)/
    );
    assert.match(assignmentService, /SELECT MAX\(archived_at\) AS archived_at/);
    assert.match(assignmentService, /assignment\.archived_at = release_time\.archived_at/);
    assert.match(assignmentService, /COALESCE\(owner\.is_archived, false\) = false/);
});

test('archived PD ownership cannot leave a course locked or displayed as assigned', () => {
    const assignmentService = read('services/pdCourseAssignmentService.js');
    const courseService = read('services/courseService.js');

    assert.match(assignmentService, /SET is_active = false[\s\S]*COALESCE\(profile\.is_archived, false\) = true/);
    assert.match(courseService, /EXISTS \([\s\S]*COALESCE\(active_profile\.is_archived, false\) = false/);
});

test('Accounts course selector compares normalized user and course ids', () => {
    const accountsPanel = read('../frontend/src/pages/maintenance/AccountsPanel.jsx');

    assert.match(accountsPanel, /new Set\(\(form\.course_ids \|\| \[\]\)\.map\(String\)\)/);
    assert.match(accountsPanel, /String\(course\.assigned_pd\.user_id\) !== String\(currentUserId \|\| ''\)/);
});

test('Accounts UI deduplicates realtime and request results by account identity', () => {
    const accountsPanel = read('../frontend/src/pages/maintenance/AccountsPanel.jsx');
    const accountService = read('services/accountService.js');

    assert.match(accountsPanel, /function deduplicateAccounts\(accounts = \[\]\)/);
    assert.match(accountsPanel, /deduplicateAccounts\(\[createdAccount, \.\.\.current\]\)/);
    assert.match(accountsPanel, /deduplicateAccounts\(\[data\.data, \.\.\.current\]\)/);
    assert.match(accountService, /LOWER\(TRIM\(email\)\) = LOWER\(TRIM\(\$1\)\)/);
});

test('staff account create and edit reject duplicate names and invalid or duplicate emails', () => {
    const accountsPanel = read('../frontend/src/pages/maintenance/AccountsPanel.jsx');
    const accountService = read('services/accountService.js');

    assert.match(accountsPanel, /Enter a valid email address, such as name@example\.com\./);
    assert.match(accountsPanel, /Another account already uses this full name\./);
    assert.match(accountsPanel, /validateEditForm\(editForm, roAreas, accounts, editingAccountId\)/);
    assert.match(accountService, /async function assertUniqueStaffIdentity/);
    assert.match(accountService, /LOWER\(TRIM\(first_name\)\) = LOWER\(TRIM\(\$2\)\)/);
    assert.match(accountService, /admin_profiles_normalized_full_name_key/);
});
