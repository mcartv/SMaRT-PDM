const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../services/roService.js'), 'utf8');
const assignment = source.slice(source.indexOf('exports.assignScholarRO ='), source.indexOf('exports.assignScholarsToRequest ='));
const writes = source.slice(source.indexOf('async function createPlacementRequest('), source.indexOf('async function sendCoordinatorRequestNotification('));

function harness(failPlacement) {
  const statements = [];
  let saved = [];
  let pending = [];
  let notifications = 0;
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql === 'BEGIN') pending = [...saved];
      if (sql === 'COMMIT') saved = pending;
      if (sql === 'ROLLBACK') pending = [];
      if (sql.startsWith('INSERT INTO return_of_obligations')) {
        pending.push('assignment');
        return { rows: [{ ro_id: 'ro' }] };
      }
      if (sql.startsWith('INSERT INTO ro_placements')) {
        if (failPlacement) throw Object.assign(new Error('Placement rejected'), { code: '23514' });
        pending.push('placement');
        return { rows: [{ placement_id: 'placement' }] };
      }
      return { rows: [] };
    },
    release() { statements.push('RELEASE'); },
  };
  const context = {
    exports: {}, db: { connect: async () => client },
    SCHOLAR_REQUEST_ASSIGNMENT_TOKEN: Symbol(),
    createHttpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
    cleanText: (value) => String(value ?? '').trim(), toNumber: (value) => Number(value || 0),
    fullName: () => 'Coordinator', getUserId: () => 'admin',
    getCurrentAcademicPeriod: async () => ({ period_id: 'period', academic_year_id: 'year' }),
    getApprovedApplicationForStudent: async () => ({ application_id: 'application' }),
    getROByApplication: async () => null,
    getStudentForRoNotice: async () => ({ student_id: 'student', user_id: 'user' }),
    getActiveRoSettingForAssignments: async () => ({ required_hours: 8 }),
    resolveAssignedDepartment: async () => ({ department_id: 'area', department_name: 'Library' }),
    findRoCoordinator: async () => ({ coordinator_assignment_id: 'coordinator', user_id: 'coordinator-user' }),
    getCurrentPlacement: async () => null,
    sendCoordinatorRequestNotification: async () => {
      assert.ok(statements.includes('COMMIT'), 'notification must follow commit');
      notifications++;
    },
  };
  vm.createContext(context);
  vm.runInContext(writes + '\n' + assignment, context);
  return {
    run: () => context.exports.assignScholarRO('student', { assignedArea: 'Library' }),
    saved: () => saved, notifications: () => notifications, statements,
  };
}

test('placement rejection rolls back the assignment and sends no notification', async () => {
  const h = harness(true);
  await assert.rejects(h.run(), { statusCode: 409 });
  assert.deepEqual(h.saved(), []);
  assert.equal(h.notifications(), 0);
  assert.ok(h.statements.includes('ROLLBACK'));
  assert.equal(h.statements.at(-1), 'RELEASE');
});

test('successful assignment commits both records before notifying', async () => {
  const h = harness(false);
  await h.run();
  assert.deepEqual(h.saved(), ['assignment', 'placement']);
  assert.equal(h.notifications(), 1);
  assert.equal(h.statements.at(-1), 'RELEASE');
});
