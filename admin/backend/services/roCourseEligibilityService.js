'use strict';
// Validates a new Community Service assignment against current course-to-area mappings.
// Empty mappings mean unrestricted, matching the existing Phase 2 UI contract.
const db = require('../config/db');
function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
async function assertEligible({ studentId, departmentId, client = db }) {
  if (!studentId || !departmentId) throw httpError(400, 'A scholar and Community Service area are required.');
  const result = await client.query(`
    SELECT s.course_id, d.is_active,
      (SELECT count(*)::integer FROM public.ro_department_courses dc
        WHERE dc.department_id = d.department_id) AS mapping_count,
      EXISTS (
        SELECT 1 FROM public.ro_department_courses dc
        WHERE dc.department_id = d.department_id AND dc.course_id = s.course_id
      ) AS course_allowed
    FROM public.students s
    CROSS JOIN public.ro_departments d
    WHERE s.student_id = $1 AND d.department_id = $2
  `, [studentId, departmentId]);
  if (!result.rows.length) throw httpError(404, 'Scholar or Community Service area not found.');
  const row = result.rows[0];
  if (row.is_active !== true) throw httpError(409, 'This Community Service area is inactive. Select an active area.');
  if (Number(row.mapping_count) > 0 && !row.course_allowed) {
    throw httpError(409, 'This scholar’s course is not eligible for the selected Community Service area.');
  }
  return true;
}
module.exports = { assertEligible };
