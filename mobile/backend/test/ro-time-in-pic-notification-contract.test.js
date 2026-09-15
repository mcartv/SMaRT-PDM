'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const service = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'services', 'roService.js'),
  'utf8'
);

test('successful RO time-in notifies the assigned personnel-in-charge', () => {
  assert.match(service, /sendPicTimeInNotification/);
  assert.match(service, /coordinator_assignment_id/);
  assert.match(service, /Scholar timed in for RO/);
  assert.match(service, /referenceType:\s*'ro_time_log'/);

  const notificationCall = service.indexOf('await sendPicTimeInNotification');
  const attendanceInsert = service.indexOf(".from('ro_time_logs')", service.indexOf('async function timeInMyRo'));
  const proofSave = service.indexOf('await saveRoTimeLogProof', attendanceInsert);

  assert.ok(attendanceInsert >= 0 && attendanceInsert < proofSave);
  assert.ok(proofSave < notificationCall);
});
