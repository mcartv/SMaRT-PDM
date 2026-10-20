'use strict';
// Community Service areas accept every course. Verify scholar existence and active area only.
const db = require('../config/db');
function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
async function assertEligible({ studentId, departmentId, client = db }) {
  if (!studentId || !departmentId) throw httpError(400, 'A scholar and Community Service area are required.');
  const result = await client.query(`
    SELECT d.is_active
    FROM public.students s
    CROSS JOIN public.ro_departments d
    WHERE s.student_id = $1 AND d.department_id = $2
  `, [studentId, departmentId]);
  if (!result.rows.length) throw httpError(404, 'Scholar or Community Service area not found.');
  const row = result.rows[0];
  if (row.is_active !== true) throw httpError(409, 'This Community Service area is inactive. Select an active area.');
  return true;
}
module.exports = { assertEligible };
