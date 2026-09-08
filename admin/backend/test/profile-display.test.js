const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveStaffRole } = require('../utils/staffRoles');

const displayModule = import('../../frontend/src/utils/profileDisplay.js');

test('approved office labels never modify stored identity or operational role', async () => {
  const { getProfileDisplay } = await displayModule;
  for (const [role, position, department, expected] of [
    ['sdo', 'Student Discipline Officer', 'Student Welfare and Development Office', {
      accountRole: 'Student Discipline Office Administrator',
      position: 'Student Discipline Office Coordinator',
      organizationalUnit: 'Student Discipline Office',
    }],
    ['guidance', 'Guidance Counselor', 'Guidance and Counselling Office', {
      accountRole: 'Guidance and Counseling Administrator',
      position: 'Psychologist',
      organizationalUnit: 'Guidance and Counseling Office',
    }],
    ['admin', 'Registrar', 'Student Personnel Services', {
      accountRole: 'Student Personnel Service Administrator',
      position: 'Registrar',
      organizationalUnit: "Registrar's Office",
    }],
  ]) {
    const profile = Object.freeze({ role, position, department });
    const original = JSON.stringify(profile);
    const operationalRole = resolveStaffRole(profile);
    assert.deepEqual(getProfileDisplay(profile), expected);
    assert.equal(JSON.stringify(profile), original);
    assert.equal(resolveStaffRole(profile), operationalRole);
    assert.equal(profile.role, role);
  }
});

test('PD and RO labels retain real assignments and do not invent a program', async () => {
  const { getProfileDisplay } = await displayModule;
  const courses = Object.freeze([Object.freeze({ course_name: 'BS Computer Science', course_code: 'BSCS' })]);
  assert.deepEqual(getProfileDisplay(Object.freeze({ role: 'pd', assigned_courses: courses })), {
    accountRole: 'Program Director Administrator',
    position: 'Program Director – BS Computer Science',
    organizationalUnit: 'BS Computer Science',
  });
  assert.deepEqual(getProfileDisplay({ role: 'pd' }), {
    accountRole: 'Program Director Administrator', position: 'Program Director', organizationalUnit: '—',
  });
  assert.equal(getProfileDisplay({ role: 'ro_coordinator', department: 'Library' }).organizationalUnit, 'Library');
  assert.equal(getProfileDisplay({ role: 'ro_coordinator', department: 'Library' }).accountRole, 'RO Coordinator');
});

test('fallback profiles and unknown labels remain readable', async () => {
  const { getProfileDisplay, formatSystemLabel } = await displayModule;
  assert.equal(getProfileDisplay({}, 'guidance').position, 'Psychologist');
  assert.equal(getProfileDisplay({ role: 'SDO User' }).accountRole, 'Student Discipline Office Administrator');
  assert.equal(getProfileDisplay({ role: 'custom_reviewer' }).accountRole, 'Custom Reviewer');
  assert.equal(formatSystemLabel('BSCS / IT Office'), 'BSCS / IT Office');
  assert.equal(formatSystemLabel(null), '—');
});

test('workflow values are formatted for display without changing decision keys', async () => {
  const { formatSystemLabel } = await displayModule;
  const workflow = Object.freeze({ stage: 'pending_sdo', decision: 'good_moral_standing' });
  assert.equal(formatSystemLabel(workflow.stage), 'Pending SDO');
  assert.equal(formatSystemLabel(workflow.decision), 'Good Moral Standing');
  assert.equal(formatSystemLabel('pending_pd'), 'Pending Program Director');
  assert.equal(formatSystemLabel('pending_guidance'), 'Pending Guidance');
  assert.equal(formatSystemLabel('major_offense'), 'Major Offense');
  assert.equal(formatSystemLabel('minor_offense'), 'Minor Offense');
  assert.equal(formatSystemLabel('no_offense'), 'No Offense');
  assert.deepEqual(workflow, { stage: 'pending_sdo', decision: 'good_moral_standing' });
});
