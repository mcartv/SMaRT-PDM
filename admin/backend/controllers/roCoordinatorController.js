const db = require('../config/db');
const auditLogService = require('../services/auditLogService');
const notificationService = require('../services/notificationService');
const socketEvents = require('../utils/socketEvents');

function currentUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.sub || null;
}

async function getCoordinator(req) {
  const userId = currentUserId(req);
  const result = await db.query(
    `SELECT
       ap.first_name,
       ap.last_name,
       rac.coordinator_assignment_id,
       rd.department_id,
       rd.department_name AS department
     FROM admin_profiles ap
     JOIN ro_area_coordinators rac
       ON rac.user_id = ap.user_id
      AND rac.is_active = true
     JOIN ro_departments rd
       ON rd.department_id = rac.ro_area_id
      AND rd.is_active = true
     WHERE ap.user_id = $1
       AND COALESCE(ap.is_archived, false) = false
     ORDER BY rd.department_name`,
    [userId]
  );

  if (!result.rows.length) {
    const error = new Error('You do not have an active RO Area coordinator assignment.');
    error.statusCode = 403;
    throw error;
  }

  return {
    userId,
    first_name: result.rows[0].first_name,
    last_name: result.rows[0].last_name,
    assignments: result.rows,
    assignmentIds: result.rows.map((row) => row.coordinator_assignment_id),
    departments: result.rows.map((row) => row.department),
    department: result.rows.map((row) => row.department).join(', '),
  };
}

function emitUpdate(req, payload) {
  const io = req.app.get('io');
  if (socketEvents?.roUpdated) {
    socketEvents.roUpdated(io, { source: 'ro-coordinator', updated_at: new Date().toISOString(), ...payload });
  } else if (io) {
    io.emit('ro:updated', { source: 'ro-coordinator', updated_at: new Date().toISOString(), ...payload });
  }
}

async function notify(req, coordinator, request, decision, remarks) {
  const io = req.app.get('io');
  const student = await db.query(
    'SELECT user_id, first_name, last_name FROM students WHERE student_id = $1 LIMIT 1',
    [request.student_id]
  );
  const studentUserId = student.rows[0]?.user_id;
  const studentName = [student.rows[0]?.first_name, student.rows[0]?.last_name].filter(Boolean).join(' ') || 'Scholar';
  const officeName = request.assigned_area || coordinator.department;

  if (decision === 'Approved' && studentUserId) {
    const notification = await notificationService.createUserNotification({
      userId: studentUserId,
      type: 'Return of Obligation',
      title: 'RO assignment approved',
      message: `${officeName} approved your Return of Obligation request. You may now complete your assigned RO requirements.`,
      referenceId: request.ro_id,
      referenceType: 'return_of_obligation',
    });
    socketEvents.notificationCreated(io, studentUserId, { ...notification, target_user_id: studentUserId });
  }

  const adminNotifications = await notificationService.createStaffNotifications({
    roles: ['admin'],
    type: 'Return of Obligation',
    title: `RO request ${decision.toLowerCase()}`,
    message: `${officeName} ${decision.toLowerCase()} the RO request for ${studentName}${remarks ? `: ${remarks}` : '.'}`,
    referenceId: request.ro_id,
    referenceType: 'return_of_obligation',
  });

  adminNotifications.forEach((notification) => {
    const targetUserId = notification.target_user_id || notification.user_id;
    if (targetUserId) socketEvents.notificationCreated(io, targetUserId, { ...notification, target_user_id: targetUserId });
  });
}

exports.getSummary = async (req, res) => {
  try {
    const coordinator = await getCoordinator(req);
    const result = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE rp.placement_status = 'Pending')::int AS pending_count,
        COUNT(*) FILTER (WHERE rp.placement_status = 'Approved' AND rp.decided_at::date = CURRENT_DATE)::int AS approved_today,
        COUNT(*) FILTER (WHERE rp.placement_status = 'Rejected' AND rp.decided_at::date = CURRENT_DATE)::int AS rejected_today,
        COUNT(*) FILTER (WHERE rp.placement_status = 'Approved' AND COALESCE(ro.ro_status, '') <> 'Cleared')::int AS active_count
       FROM ro_placements rp
       JOIN return_of_obligations ro ON ro.ro_id = rp.ro_id
       WHERE rp.coordinator_assignment_id = ANY($1::uuid[])`,
      [coordinator.assignmentIds]
    );
    return res.json({
      department: coordinator.department,
      departments: coordinator.departments,
      ...(result.rows[0] || {}),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Failed to load RO coordinator summary.' });
  }
};

exports.getRequests = async (req, res) => {
  try {
    const coordinator = await getCoordinator(req);
    const status = String(req.query.status || 'pending').toLowerCase();
    const search = String(req.query.search || '').trim();
    const statusValue = status === 'all' ? null : status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending';
    const result = await db.query(
      `SELECT rp.placement_id, rp.placement_status AS coordinator_status,
              rp.coordinator_remarks, rp.decided_at AS coordinator_decided_at,
              rp.admin_remarks AS remarks, rp.requested_at AS assigned_at,
              rp.created_at, rp.updated_at,
              ro.ro_id, ro.student_id, ro.application_id, ro.ro_status,
              ro.required_hours, ro.assignment_status,
              rd.department_name AS assigned_area,
              s.pdm_id, s.first_name, s.last_name, s.year_level,
              ac.course_code, ac.course_name,
              sp.program_name, po.opening_title
       FROM ro_placements rp
       JOIN return_of_obligations ro ON ro.ro_id = rp.ro_id
       JOIN ro_departments rd ON rd.department_id = rp.ro_area_id
       JOIN students s ON s.student_id = ro.student_id
       LEFT JOIN academic_course ac ON ac.course_id = s.course_id
       LEFT JOIN scholarship_program sp ON sp.program_id = ro.program_id
       LEFT JOIN program_openings po ON po.opening_id = ro.opening_id
       WHERE rp.coordinator_assignment_id = ANY($1::uuid[])
         AND ($2::text IS NULL OR rp.placement_status = $2)
         AND ($3::text = '' OR CONCAT_WS(' ', s.first_name, s.last_name, s.pdm_id, ac.course_code, sp.program_name, rd.department_name) ILIKE '%' || $3 || '%')
       ORDER BY CASE rp.placement_status WHEN 'Pending' THEN 0 WHEN 'Rejected' THEN 1 ELSE 2 END,
                rp.updated_at DESC`,
      [coordinator.assignmentIds, statusValue, search]
    );
    return res.json({
      department: coordinator.department,
      departments: coordinator.departments,
      items: result.rows,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Failed to load RO requests.' });
  }
};

exports.decideRequest = async (req, res) => {
  try {
    const coordinator = await getCoordinator(req);
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    const remarks = String(req.body?.remarks || '').trim();
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Choose approve or reject.' });
    }
    if (decision === 'reject' && !remarks) {
      return res.status(400).json({ message: 'Remarks are required when rejecting an RO request.' });
    }

    const nextStatus = decision === 'approve' ? 'Approved' : 'Rejected';
    const client = await db.connect();
    let request;
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE ro_placements rp
         SET placement_status = $1,
             coordinator_remarks = $2,
             decided_by_user_id = $3,
             decided_at = now(),
             updated_at = now()
         FROM return_of_obligations ro, ro_departments rd
         WHERE rp.placement_id = $4
           AND rp.ro_id = ro.ro_id
           AND rp.ro_area_id = rd.department_id
           AND rp.coordinator_assignment_id = ANY($5::uuid[])
           AND rp.placement_status = 'Pending'
         RETURNING rp.placement_id, rp.ro_id, ro.student_id,
                   rd.department_name AS assigned_area,
                   rp.placement_status AS coordinator_status,
                   rp.coordinator_remarks, rp.decided_at AS coordinator_decided_at`,
        [
          nextStatus,
          remarks || null,
          coordinator.userId,
          req.params.placementId,
          coordinator.assignmentIds,
        ]
      );
      request = result.rows[0];
      if (!request) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'This pending RO request is unavailable.' });
      }

      const placementStateResult = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE placement_status = 'Approved')::int AS approved_count,
           COUNT(*) FILTER (WHERE placement_status = 'Pending')::int AS pending_count,
           (
             SELECT json_build_object(
               'assigned_area', approved_area.department_name,
               'remarks', approved.coordinator_remarks,
               'user_id', approved.decided_by_user_id,
               'decided_at', approved.decided_at
             )
             FROM ro_placements approved
             JOIN ro_departments approved_area
               ON approved_area.department_id = approved.ro_area_id
             WHERE approved.ro_id = $1
               AND approved.placement_status = 'Approved'
             ORDER BY approved.decided_at DESC NULLS LAST, approved.updated_at DESC
             LIMIT 1
           ) AS latest_approved
         FROM ro_placements
         WHERE ro_id = $1`,
        [request.ro_id]
      );
      const placementState = placementStateResult.rows[0] || {};
      const hasApprovedPlacement = Number(placementState.approved_count || 0) > 0;
      const hasPendingPlacement = Number(placementState.pending_count || 0) > 0;
      const approvedPlacement = placementState.latest_approved || null;
      const parentCoordinatorStatus = hasApprovedPlacement
        ? 'Approved'
        : hasPendingPlacement
          ? 'Pending'
          : 'Rejected';
      const parentAssignmentStatus = hasApprovedPlacement
        ? 'Assigned'
        : hasPendingPlacement
          ? 'Pending Coordinator Approval'
          : 'Coordinator Rejected';

      await client.query(
        `UPDATE return_of_obligations
         SET assigned_area = $1,
             coordinator_status = $2,
             coordinator_remarks = $3,
             coordinator_user_id = $4,
             coordinator_decided_at = $5,
             assignment_status = CASE
               WHEN $6 = 'Assigned'
                AND assignment_status IN ('Acknowledged', 'In Progress', 'For Validation')
               THEN assignment_status
               ELSE $6
             END,
             updated_at = now()
         WHERE ro_id = $7`,
        [
          approvedPlacement?.assigned_area || request.assigned_area,
          parentCoordinatorStatus,
          approvedPlacement?.remarks || remarks || null,
          approvedPlacement?.user_id || coordinator.userId,
          approvedPlacement?.decided_at || request.coordinator_decided_at,
          parentAssignmentStatus,
          request.ro_id,
        ]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await notify(req, coordinator, request, nextStatus, remarks).catch((notificationError) => {
      console.error('RO DECISION NOTIFICATION ERROR:', notificationError.message || notificationError);
    });
    await auditLogService.logAudit({
      req,
      userId: coordinator.userId,
      actionTaken: `RO_COORDINATOR_${nextStatus.toUpperCase()}`,
      module: 'RO Coordinator',
      entityType: 'return_of_obligation',
      entityId: request.placement_id,
      description: `${nextStatus} RO request for ${coordinator.department}.`,
      metadata: { department: coordinator.department, remarks: remarks || null },
    }).catch((auditError) => {
      console.error('RO COORDINATOR AUDIT ERROR:', auditError.message || auditError);
    });
    emitUpdate(req, {
      action: nextStatus.toLowerCase(),
      ro_id: request.ro_id,
      placement_id: request.placement_id,
      department: request.assigned_area,
    });
    return res.json({ message: `RO request ${nextStatus.toLowerCase()} successfully.`, request });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Failed to save RO decision.' });
  }
};
