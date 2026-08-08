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
      title: 'Required RO assignment approved',
      message: `${officeName} approved your mandatory Return of Obligation assignment. Open the scholar app, review the details, and acknowledge it. You may report a legitimate conflict, but the assignment cannot be directly rejected.`,
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
    const [placementResult, attendanceResult, scholarRequestResult] = await Promise.all([
      db.query(
        `SELECT
          COUNT(DISTINCT ro.student_id) FILTER (WHERE rp.placement_status = 'Approved')::int AS assigned_scholars,
          COUNT(*) FILTER (WHERE rp.placement_status = 'Pending')::int AS pending_placement_requests
         FROM ro_placements rp
         JOIN return_of_obligations ro ON ro.ro_id = rp.ro_id
         WHERE rp.coordinator_assignment_id = ANY($1::uuid[])`,
        [coordinator.assignmentIds]
      ),
      db.query(
        `SELECT COUNT(*)::int AS pending_validation
         FROM ro_time_logs rtl
         JOIN ro_placements rp ON rp.placement_id = rtl.placement_id
         WHERE rp.coordinator_assignment_id = ANY($1::uuid[])
           AND rp.placement_status = 'Approved'
           AND rtl.log_status = 'Timed Out'
           AND COALESCE(rtl.department_validation_status, 'Pending') = 'Pending'`,
        [coordinator.assignmentIds]
      ),
      db.query(
        `SELECT COUNT(*)::int AS pending_ro_requests
         FROM ro_scholar_requests rsr
         WHERE rsr.coordinator_assignment_id = ANY($1::uuid[])
           AND COALESCE(rsr.request_status, 'Pending') IN ('Pending', 'Acknowledged')`,
        [coordinator.assignmentIds]
      ),
    ]);

    return res.json({
      department: coordinator.department,
      departments: coordinator.departments,
      assigned_scholars: Number(placementResult.rows[0]?.assigned_scholars || 0),
      pending_validation: Number(attendanceResult.rows[0]?.pending_validation || 0),
      pending_ro_requests: Number(scholarRequestResult.rows[0]?.pending_ro_requests || 0),
      pending_count: Number(placementResult.rows[0]?.pending_placement_requests || 0),
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

exports.getScholarRequests = async (req, res) => {
  try {
    const coordinator = await getCoordinator(req);
    const result = await db.query(
      `SELECT
         rsr.request_id,
         rsr.ro_area_id,
         rd.department_name AS assigned_area,
         rsr.requested_scholar_count,
         rsr.purpose,
         rsr.preferred_date,
         rsr.request_status,
         rsr.admin_remarks,
         rsr.handled_at,
         rsr.created_at,
         rsr.updated_at
       FROM ro_scholar_requests rsr
       JOIN ro_departments rd ON rd.department_id = rsr.ro_area_id
       WHERE rsr.coordinator_assignment_id = ANY($1::uuid[])
       ORDER BY
         CASE rsr.request_status
           WHEN 'Pending' THEN 0
           WHEN 'Acknowledged' THEN 1
           ELSE 2
         END,
         rsr.created_at DESC`,
      [coordinator.assignmentIds]
    );

    return res.json({
      areas: coordinator.assignments.map((assignment) => ({
        ro_area_id: assignment.department_id,
        department_name: assignment.department,
      })),
      items: result.rows,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to load scholar requests.',
    });
  }
};

exports.createScholarRequest = async (req, res) => {
  try {
    const coordinator = await getCoordinator(req);
    const requestedAreaId = String(req.body?.roAreaId || req.body?.ro_area_id || '').trim();
    const assignment = requestedAreaId
      ? coordinator.assignments.find(
          (item) => String(item.department_id) === requestedAreaId
        )
      : coordinator.assignments.length === 1
        ? coordinator.assignments[0]
        : null;
    const requestedCount = Number.parseInt(
      req.body?.requestedScholarCount || req.body?.requested_scholar_count || 1,
      10
    );
    const purpose = String(req.body?.purpose || '').trim();
    const preferredDate = String(
      req.body?.preferredDate || req.body?.preferred_date || ''
    ).trim();

    if (!assignment) {
      return res.status(400).json({ message: 'Select one of your assigned RO Areas.' });
    }
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 20) {
      return res.status(400).json({ message: 'Requested scholar count must be from 1 to 20.' });
    }
    if (purpose.length < 3 || purpose.length > 1000) {
      return res.status(400).json({ message: 'Describe why your area needs scholars.' });
    }
    if (preferredDate && !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return res.status(400).json({ message: 'Preferred date is invalid.' });
    }

    const result = await db.query(
      `INSERT INTO ro_scholar_requests (
         ro_area_id,
         coordinator_assignment_id,
         requested_by_user_id,
         requested_scholar_count,
         purpose,
         preferred_date
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        assignment.department_id,
        assignment.coordinator_assignment_id,
        coordinator.userId,
        requestedCount,
        purpose,
        preferredDate || null,
      ]
    );
    const request = result.rows[0];

    try {
      const adminNotifications = await notificationService.createStaffNotifications({
        roles: ['admin'],
        type: 'Return of Obligation',
        title: 'New RO scholar request',
        message: `${assignment.department} requested ${requestedCount} scholar${requestedCount === 1 ? '' : 's'} for RO service.`,
        referenceId: request.request_id,
        referenceType: 'ro_scholar_request',
      });
      const io = req.app.get('io');
      adminNotifications.forEach((notification) => {
        const targetUserId = notification.target_user_id || notification.user_id;
        if (targetUserId) {
          socketEvents.notificationCreated(io, targetUserId, {
            ...notification,
            target_user_id: targetUserId,
          });
        }
      });
    } catch (notificationError) {
      console.error('RO SCHOLAR REQUEST NOTIFICATION ERROR:', notificationError.message);
    }

    await auditLogService.logAudit({
      req,
      userId: coordinator.userId,
      actionTaken: 'CREATE_RO_SCHOLAR_REQUEST',
      module: 'RO Coordinator',
      entityType: 'ro_scholar_request',
      entityId: request.request_id,
      description: `Requested ${requestedCount} scholar${requestedCount === 1 ? '' : 's'} for ${assignment.department}.`,
      metadata: { ro_area_id: assignment.department_id, purpose, preferred_date: preferredDate || null },
    }).catch(() => {});

    emitUpdate(req, {
      action: 'scholar-request-created',
      request_id: request.request_id,
      department: assignment.department,
    });
    return res.status(201).json({
      message: 'Scholar request sent to Admin.',
      request: {
        ...request,
        assigned_area: assignment.department,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to send scholar request.',
    });
  }
};

exports.cancelScholarRequest = async (req, res) => {
  try {
    const coordinator = await getCoordinator(req);
    const result = await db.query(
      `UPDATE ro_scholar_requests
       SET request_status = 'Cancelled', updated_at = now()
       WHERE request_id = $1
         AND coordinator_assignment_id = ANY($2::uuid[])
         AND requested_by_user_id = $3
         AND request_status = 'Pending'
       RETURNING request_id`,
      [req.params.requestId, coordinator.assignmentIds, coordinator.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: 'This pending scholar request is unavailable.',
      });
    }

    emitUpdate(req, {
      action: 'scholar-request-cancelled',
      request_id: req.params.requestId,
    });
    return res.json({ message: 'Scholar request cancelled.' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to cancel scholar request.',
    });
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

exports.getAttendanceQueue = async (req, res) => {
  try {
    const coordinator = await getCoordinator(req);
    const status = String(req.query.status || 'pending').trim().toLowerCase();
    const statusValue = status === 'all'
      ? null
      : status === 'approved'
        ? 'Approved'
        : status === 'returned'
          ? 'Returned'
          : 'Pending';

    const result = await db.query(
      `SELECT
         rtl.log_id,
         rtl.ro_id,
         rtl.placement_id,
         rtl.student_id,
         rtl.time_in_at,
         rtl.time_out_at,
         rtl.duration_minutes,
         rtl.validated_minutes,
         rtl.student_note,
         rtl.log_status,
         rtl.department_validation_status,
         rtl.department_validation_remarks,
         rtl.department_validated_at,
         rp.placement_status,
         rd.department_name AS assigned_area,
         ro.required_hours,
         ro.ro_status,
         s.pdm_id,
         s.first_name,
         s.last_name,
         ac.course_code,
         COALESCE(
           json_agg(
             json_build_object(
               'proof_id', proof.proof_id,
               'proof_type', proof.proof_type,
               'file_url', proof.file_url,
               'file_path', proof.file_path,
               'captured_at_device', proof.captured_at_device,
               'captured_at_server', proof.captured_at_server,
               'latitude', proof.latitude,
               'longitude', proof.longitude,
               'accuracy_meters', proof.accuracy_meters,
               'proof_status', proof.proof_status
             ) ORDER BY proof.created_at
           ) FILTER (WHERE proof.proof_id IS NOT NULL),
           '[]'::json
         ) AS proofs
       FROM ro_time_logs rtl
       JOIN ro_placements rp ON rp.placement_id = rtl.placement_id
       JOIN ro_departments rd ON rd.department_id = rp.ro_area_id
       JOIN return_of_obligations ro ON ro.ro_id = rtl.ro_id
       JOIN students s ON s.student_id = rtl.student_id
       LEFT JOIN academic_course ac ON ac.course_id = s.course_id
       LEFT JOIN ro_time_log_proofs proof ON proof.log_id = rtl.log_id
       WHERE rp.coordinator_assignment_id = ANY($1::uuid[])
         AND rp.placement_status = 'Approved'
         AND rtl.log_status = 'Timed Out'
         AND ($2::text IS NULL OR rtl.department_validation_status = $2)
       GROUP BY rtl.log_id, rp.placement_status, rd.department_name,
                ro.required_hours, ro.ro_status, s.pdm_id, s.first_name,
                s.last_name, ac.course_code
       ORDER BY CASE rtl.department_validation_status WHEN 'Pending' THEN 0 WHEN 'Returned' THEN 1 ELSE 2 END,
                rtl.time_out_at DESC NULLS LAST`,
      [coordinator.assignmentIds, statusValue]
    );

    return res.json({ items: result.rows, department: coordinator.department });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to load RO attendance evidence.',
    });
  }
};

exports.validateAttendance = async (req, res) => {
  try {
    const coordinator = await getCoordinator(req);
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    const remarks = String(req.body?.remarks || '').trim();

    if (!['approve', 'return'].includes(decision)) {
      return res.status(400).json({ message: 'Choose approve or return.' });
    }
    if (decision === 'return' && !remarks) {
      return res.status(400).json({ message: 'Remarks are required when returning attendance evidence.' });
    }

    const nextDepartmentStatus = decision === 'approve' ? 'Approved' : 'Returned';
    const nextValidationStatus = decision === 'approve' ? 'Approved' : 'Rejected';
    const client = await db.connect();
    let log;

    try {
      await client.query('BEGIN');

      if (decision === 'approve') {
        const proofCheck = await client.query(
          `SELECT COUNT(DISTINCT proof.proof_type)::int AS valid_proof_types
           FROM ro_time_logs rtl
           JOIN ro_placements rp ON rp.placement_id = rtl.placement_id
           LEFT JOIN ro_time_log_proofs proof
             ON proof.log_id = rtl.log_id
            AND proof.proof_type IN ('time_in', 'time_out')
            AND COALESCE(
              NULLIF(BTRIM(proof.file_url), ''),
              NULLIF(BTRIM(proof.file_path), '')
            ) IS NOT NULL
            AND proof.latitude IS NOT NULL
            AND proof.longitude IS NOT NULL
            AND COALESCE(proof.proof_status, 'Pending Review') <> 'Rejected'
           WHERE rtl.log_id = $1
             AND rp.coordinator_assignment_id = ANY($2::uuid[])
             AND rp.placement_status = 'Approved'`,
          [req.params.logId, coordinator.assignmentIds]
        );

        if (Number(proofCheck.rows[0]?.valid_proof_types || 0) < 2) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            message: 'Both time-in and time-out photos with GPS coordinates are required before attendance can be validated.',
          });
        }
      }

      const updateResult = await client.query(
        `UPDATE ro_time_logs rtl
         SET department_validation_status = $1,
             department_validation_remarks = $2,
             department_validated_by = $3,
             department_validated_at = now(),
             validation_status = $4,
             validation_remarks = $2,
             validated_by = $3,
             validated_at = now(),
             validated_minutes = CASE WHEN $1 = 'Approved' THEN duration_minutes ELSE 0 END,
             updated_at = now()
         FROM ro_placements rp
         WHERE rtl.log_id = $5
           AND rtl.placement_id = rp.placement_id
           AND rp.coordinator_assignment_id = ANY($6::uuid[])
           AND rp.placement_status = 'Approved'
           AND rtl.log_status = 'Timed Out'
         RETURNING rtl.*`,
        [
          nextDepartmentStatus,
          remarks || null,
          coordinator.userId,
          nextValidationStatus,
          req.params.logId,
          coordinator.assignmentIds,
        ]
      );
      log = updateResult.rows[0];
      if (!log) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'This attendance log is unavailable for your department.' });
      }

      const totals = await client.query(
        `SELECT
           COALESCE(SUM(duration_minutes) FILTER (
             WHERE log_status = 'Timed Out' AND department_validation_status <> 'Returned'
           ), 0)::int AS submitted_minutes,
           COALESCE(SUM(validated_minutes) FILTER (
             WHERE department_validation_status = 'Approved'
           ), 0)::int AS validated_minutes
         FROM ro_time_logs
         WHERE ro_id = $1`,
        [log.ro_id]
      );
      const total = totals.rows[0] || {};

      await client.query(
        `UPDATE return_of_obligations
         SET submitted_minutes = $1,
             validated_minutes = $2,
             progress_status = CASE
               WHEN ro_status = 'Cleared' THEN 'Cleared'
               WHEN $2 >= required_hours * 60 AND required_hours > 0 THEN 'For Validation'
               WHEN $1 > 0 THEN 'In Progress'
               ELSE 'Not Started'
             END,
             assignment_status = CASE
               WHEN ro_status = 'Cleared' THEN 'Cleared'
               WHEN $2 >= required_hours * 60 AND required_hours > 0 THEN 'For Validation'
               WHEN $1 > 0 THEN 'In Progress'
               ELSE assignment_status
             END,
             updated_at = now()
         WHERE ro_id = $3`,
        [Number(total.submitted_minutes || 0), Number(total.validated_minutes || 0), log.ro_id]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const io = req.app.get('io');
    const studentResult = await db.query(
      'SELECT user_id FROM students WHERE student_id = $1 LIMIT 1',
      [log.student_id]
    );
    const studentUserId = studentResult.rows[0]?.user_id;
    if (studentUserId) {
      const studentNotification = await notificationService.createUserNotification({
        userId: studentUserId,
        type: 'Return of Obligation',
        title: decision === 'approve'
          ? 'RO attendance validated by department'
          : 'RO attendance evidence returned',
        message: decision === 'approve'
          ? `${coordinator.department} validated your completed attendance evidence. OSFA will perform the final clearance review after all required hours are validated.`
          : `${coordinator.department} returned your attendance evidence${remarks ? `: ${remarks}` : '. Submit corrected evidence or contact OSFA.'}`,
        referenceId: log.ro_id,
        referenceType: 'return_of_obligation',
      });
      socketEvents.notificationCreated(io, studentUserId, {
        ...studentNotification,
        target_user_id: studentUserId,
      });
    }

    const adminNotifications = await notificationService.createStaffNotifications({
      roles: ['admin'],
      type: 'Return of Obligation',
      title: decision === 'approve' ? 'RO attendance validated' : 'RO attendance returned',
      message: `${coordinator.department} ${decision === 'approve' ? 'validated' : 'returned'} a scholar attendance record${remarks ? `: ${remarks}` : '.'}`,
      referenceId: log.ro_id,
      referenceType: 'return_of_obligation',
    });
    adminNotifications.forEach((notification) => {
      const targetUserId = notification.target_user_id || notification.user_id;
      if (targetUserId) socketEvents.notificationCreated(io, targetUserId, { ...notification, target_user_id: targetUserId });
    });

    emitUpdate(req, { action: `attendance-${decision}`, ro_id: log.ro_id, log_id: log.log_id });
    return res.json({
      message: decision === 'approve'
        ? 'Attendance evidence validated. OSFA may clear the scholar after all required hours are validated.'
        : 'Attendance evidence returned to the scholar for correction.',
      log,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to validate RO attendance evidence.',
    });
  }
};
