const supabase = require('../config/supabase');
const db = require('../config/db');
const notificationService = require('./notificationService');

const APPROVED_APPLICATION_STATUSES = ['Approved', 'Approved Scholar', 'Accepted'];
const RO_PROOFS_BUCKET = process.env.RO_PROOFS_BUCKET || 'ro-proofs';
const SCHOLAR_REQUEST_ASSIGNMENT_TOKEN = Symbol('scholar-request-assignment');

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function cleanText(value) {
    return String(value || '').trim();
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function fullName(student = {}) {
    return [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isClearedStatus(status) {
    return normalizeText(status) === 'cleared';
}

function percentFromMinutes(doneMinutes, requiredMinutes) {
    const done = toNumber(doneMinutes);
    const required = toNumber(requiredMinutes);

    if (required <= 0) return 0;

    return Math.min(100, Math.max(0, Math.round((done / required) * 100)));
}

function extractAvatarStoragePath(value) {
    const rawValue = String(value || '').trim();

    if (!rawValue) return null;

    if (!/^https?:\/\//i.test(rawValue)) {
        return rawValue.replace(/^avatars\//, '');
    }

    const markers = [
        '/storage/v1/object/public/avatars/',
        '/storage/v1/object/sign/avatars/',
        '/storage/v1/object/authenticated/avatars/',
    ];

    for (const marker of markers) {
        const markerIndex = rawValue.indexOf(marker);

        if (markerIndex >= 0) {
            return rawValue.slice(markerIndex + marker.length).split('?')[0];
        }
    }

    return null;
}

async function resolveAvatarUrl(value) {
    const rawValue = String(value || '').trim();

    if (!rawValue) return null;

    const storagePath = extractAvatarStoragePath(rawValue);

    if (!storagePath) return rawValue;

    const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    if (error) return rawValue;

    return data?.signedUrl || rawValue;
}

function extractStoragePath(value, bucketName) {
    const rawValue = String(value || '').trim();

    if (!rawValue) return null;

    if (!/^https?:\/\//i.test(rawValue)) {
        return rawValue
            .replace(new RegExp(`^${bucketName}/`), '')
            .replace(/^\/+/, '');
    }

    const markers = [
        `/storage/v1/object/public/${bucketName}/`,
        `/storage/v1/object/sign/${bucketName}/`,
        `/storage/v1/object/authenticated/${bucketName}/`,
    ];

    for (const marker of markers) {
        const markerIndex = rawValue.indexOf(marker);

        if (markerIndex >= 0) {
            return rawValue.slice(markerIndex + marker.length).split('?')[0];
        }
    }

    return null;
}

async function resolveRoProofUrl(fileUrl, filePath) {
    const rawFileUrl = String(fileUrl || '').trim();
    const rawFilePath = String(filePath || '').trim();

    const storagePath =
        extractStoragePath(rawFilePath, RO_PROOFS_BUCKET) ||
        extractStoragePath(rawFileUrl, RO_PROOFS_BUCKET);

    if (!storagePath) {
        return rawFileUrl || null;
    }

    const { data, error } = await supabase.storage
        .from(RO_PROOFS_BUCKET)
        .createSignedUrl(storagePath, 60 * 60);

    if (error) {
        console.error('RO PROOF SIGNED URL ERROR:', error.message);
        return rawFileUrl || rawFilePath || null;
    }

    return data?.signedUrl || rawFileUrl || rawFilePath || null;
}

function getUserId(user = {}) {
    return user?.userId || user?.user_id || user?.id || user?.sub || null;
}

async function getCurrentAcademicPeriod() {
    const { data, error } = await supabase
        .from('academic_period')
        .select('period_id, academic_year_id, term, is_active')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    if (!data) {
        throw createHttpError(
            409,
            'No current academic semester is active. Set the current semester in Maintenance > Academic Years.'
        );
    }

    return data;
}

async function getApprovedApplicationForStudent(studentId, payload = {}) {
    if (!studentId) {
        throw createHttpError(400, 'Student ID is required.');
    }

    let query = supabase
        .from('applications')
        .select(`
      application_id,
      student_id,
      program_id,
      opening_id,
      application_status,
      submission_date
    `)
        .eq('student_id', studentId)
        .in('application_status', APPROVED_APPLICATION_STATUSES)
        .order('submission_date', { ascending: false })
        .limit(1);

    if (payload.applicationId || payload.application_id) {
        query = query.eq(
            'application_id',
            payload.applicationId || payload.application_id
        );
    }

    if (payload.openingId || payload.opening_id) {
        query = query.eq('opening_id', payload.openingId || payload.opening_id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    if (!data) {
        throw createHttpError(
            404,
            'Approved scholarship application not found for this student.'
        );
    }

    return data;
}

async function getROByApplication(studentId, applicationId, periodId = null) {
    const currentPeriod =
        periodId
            ? { period_id: periodId }
            : await getCurrentAcademicPeriod();

    const { data, error } = await supabase
        .from('return_of_obligations')
        .select('*')
        .eq('student_id', studentId)
        .eq('application_id', applicationId)
        .eq('period_id', currentPeriod.period_id)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    return data || null;
}

async function getActivePlacementForRO(roId) {
    if (!roId) return null;

    const { data, error } = await supabase
        .from('ro_placements')
        .select(`
            placement_id,
            ro_id,
            ro_area_id,
            coordinator_assignment_id,
            placement_status,
            created_at,
            updated_at
        `)
        .eq('ro_id', roId)
        .in('placement_status', ['Pending', 'Approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    return data || null;
}

async function getProofsForLogIds(logIds = []) {
    const ids = [...new Set(logIds.filter(Boolean))];

    if (!ids.length) return new Map();

    const { data, error } = await supabase
        .from('ro_time_log_proofs')
        .select(`
      proof_id,
      log_id,
      ro_id,
      student_id,
      proof_type,
      file_url,
      file_path,
      file_name,
      mime_type,
      file_size_bytes,
      photo_sha256,
      captured_at_device,
      captured_at_server,
      device_timezone,
      latitude,
      longitude,
      accuracy_meters,
      altitude_meters,
      location_permission_status,
      location_source,
      device_info,
      exif_metadata,
      proof_status,
      admin_comment,
      reviewed_by,
      reviewed_at,
      created_at
    `)
        .in('log_id', ids)
        .order('created_at', { ascending: true });

    if (error) {
        throw createHttpError(500, error.message);
    }

    const map = new Map();

    for (const proof of data || []) {
        const resolvedFileUrl = await resolveRoProofUrl(
            proof.file_url,
            proof.file_path
        );

        const proofWithResolvedUrl = {
            ...proof,
            file_url: resolvedFileUrl,
        };

        const current = map.get(proof.log_id) || [];
        current.push(proofWithResolvedUrl);
        map.set(proof.log_id, current);
    }

    return map;
}

async function getLogsForROIds(roIds) {
    const ids = [...new Set(roIds.filter(Boolean))];

    if (!ids.length) return new Map();

    const { data, error } = await supabase
        .from('ro_time_logs')
        .select(`
      log_id,
      ro_id,
      placement_id,
      student_id,
      time_in_at,
      time_out_at,
      duration_minutes,
      log_status,
      student_note,
      validated_minutes,
      validation_status,
      validation_remarks,
      department_validation_status,
      department_validation_remarks,
      department_validated_by,
      department_validated_at,
      validated_by,
      validated_at,
      auto_timed_out,
      auto_timeout_reason,
      requires_admin_attention,
      created_at,
      updated_at
    `)
        .in('ro_id', ids)
        .order('time_in_at', { ascending: false });

    if (error) {
        throw createHttpError(500, error.message);
    }

    const logRows = data || [];
    const proofsByLog = await getProofsForLogIds(logRows.map((log) => log.log_id));

    const map = new Map();

    for (const log of logRows) {
        const current = map.get(log.ro_id) || [];
        current.push({
            ...log,
            proofs: proofsByLog.get(log.log_id) || [],
        });
        map.set(log.ro_id, current);
    }

    return map;
}

function serializeProof(proof = {}) {
    return {
        proof_id: proof.proof_id,
        proofId: proof.proof_id,

        log_id: proof.log_id,
        logId: proof.log_id,

        ro_id: proof.ro_id,
        roId: proof.ro_id,

        student_id: proof.student_id,
        studentId: proof.student_id,

        proof_type: proof.proof_type,
        proofType: proof.proof_type,

        file_url: proof.file_url,
        fileUrl: proof.file_url,

        file_path: proof.file_path,
        filePath: proof.file_path,

        file_name: proof.file_name,
        fileName: proof.file_name,

        mime_type: proof.mime_type,
        mimeType: proof.mime_type,

        file_size_bytes: proof.file_size_bytes,
        fileSizeBytes: proof.file_size_bytes,

        photo_sha256: proof.photo_sha256,
        photoSha256: proof.photo_sha256,

        captured_at_device: proof.captured_at_device,
        capturedAtDevice: proof.captured_at_device,

        captured_at_server: proof.captured_at_server,
        capturedAtServer: proof.captured_at_server,

        device_timezone: proof.device_timezone,
        deviceTimezone: proof.device_timezone,

        latitude: proof.latitude,
        longitude: proof.longitude,

        accuracy_meters: proof.accuracy_meters,
        accuracyMeters: proof.accuracy_meters,

        altitude_meters: proof.altitude_meters,
        altitudeMeters: proof.altitude_meters,

        location_permission_status: proof.location_permission_status,
        locationPermissionStatus: proof.location_permission_status,

        location_source: proof.location_source,
        locationSource: proof.location_source,

        device_info: proof.device_info || {},
        deviceInfo: proof.device_info || {},

        exif_metadata: proof.exif_metadata || {},
        exifMetadata: proof.exif_metadata || {},

        proof_status: proof.proof_status || 'Pending Review',
        proofStatus: proof.proof_status || 'Pending Review',

        admin_comment: proof.admin_comment || '',
        adminComment: proof.admin_comment || '',

        reviewed_by: proof.reviewed_by || null,
        reviewedBy: proof.reviewed_by || null,

        reviewed_at: proof.reviewed_at || null,
        reviewedAt: proof.reviewed_at || null,

        created_at: proof.created_at || null,
        createdAt: proof.created_at || null,
    };
}

function serializeLog(log = {}) {
    const proofs = Array.isArray(log.proofs) ? log.proofs.map(serializeProof) : [];

    return {
        log_id: log.log_id,
        logId: log.log_id,

        ro_id: log.ro_id,
        roId: log.ro_id,

        placement_id: log.placement_id || null,
        placementId: log.placement_id || null,

        student_id: log.student_id,
        studentId: log.student_id,

        time_in_at: log.time_in_at,
        timeInAt: log.time_in_at,

        time_out_at: log.time_out_at,
        timeOutAt: log.time_out_at,

        duration_minutes: toNumber(log.duration_minutes),
        durationMinutes: toNumber(log.duration_minutes),

        log_status: log.log_status || 'Timed In',
        logStatus: log.log_status || 'Timed In',

        student_note: log.student_note || '',
        studentNote: log.student_note || '',

        validated_minutes: toNumber(log.validated_minutes),
        validatedMinutes: toNumber(log.validated_minutes),

        validation_status: log.validation_status || 'Pending Validation',
        validationStatus: log.validation_status || 'Pending Validation',

        validation_remarks: log.validation_remarks || '',
        validationRemarks: log.validation_remarks || '',

        department_validation_status: log.department_validation_status || 'Pending',
        departmentValidationStatus: log.department_validation_status || 'Pending',
        department_validation_remarks: log.department_validation_remarks || '',
        departmentValidationRemarks: log.department_validation_remarks || '',
        department_validated_by: log.department_validated_by || null,
        departmentValidatedBy: log.department_validated_by || null,
        department_validated_at: log.department_validated_at || null,
        departmentValidatedAt: log.department_validated_at || null,

        validated_by: log.validated_by || null,
        validatedBy: log.validated_by || null,

        validated_at: log.validated_at || null,
        validatedAt: log.validated_at || null,

        auto_timed_out: log.auto_timed_out === true,
        autoTimedOut: log.auto_timed_out === true,

        auto_timeout_reason: log.auto_timeout_reason || '',
        autoTimeoutReason: log.auto_timeout_reason || '',

        requires_admin_attention: log.requires_admin_attention === true,
        requiresAdminAttention: log.requires_admin_attention === true,

        proofs,
        proof_count: proofs.length,
        proofCount: proofs.length,

        created_at: log.created_at || null,
        createdAt: log.created_at || null,

        updated_at: log.updated_at || null,
        updatedAt: log.updated_at || null,
    };
}

async function syncRoTotals(roId, user = {}) {
    const { data: ro, error: roError } = await supabase
        .from('return_of_obligations')
        .select('ro_id, required_hours, ro_status')
        .eq('ro_id', roId)
        .maybeSingle();

    if (roError) {
        throw createHttpError(500, roError.message);
    }

    if (!ro) {
        throw createHttpError(404, 'RO record not found.');
    }

    const { data: logs, error: logsError } = await supabase
        .from('ro_time_logs')
        .select('duration_minutes, validated_minutes, log_status, validation_status')
        .eq('ro_id', roId);

    if (logsError) {
        throw createHttpError(500, logsError.message);
    }

    const submittedMinutes = (logs || [])
        .filter(
            (log) =>
                log.log_status === 'Timed Out' &&
                log.validation_status !== 'Rejected'
        )
        .reduce((sum, log) => sum + toNumber(log.duration_minutes), 0);

    const validatedMinutes = (logs || [])
        .filter((log) => log.validation_status === 'Approved')
        .reduce((sum, log) => sum + toNumber(log.validated_minutes), 0);

    const requiredMinutes = toNumber(ro.required_hours) * 60;
    const readyForOsfaClearance =
        requiredMinutes > 0 && validatedMinutes >= requiredMinutes;
    const now = new Date().toISOString();

    let progressStatus = 'Not Started';
    let assignmentStatus = null;

    // Department validation makes the record eligible for OSFA clearance.
    // It must never clear the obligation automatically; only OSFA/Admin may do that.
    if (ro.ro_status === 'Cleared') {
        progressStatus = 'Cleared';
        assignmentStatus = 'Cleared';
    } else if (submittedMinutes <= 0) {
        progressStatus = 'Not Started';
    } else if (readyForOsfaClearance || (requiredMinutes > 0 && submittedMinutes >= requiredMinutes)) {
        progressStatus = 'For Validation';
        assignmentStatus = 'For Validation';
    } else {
        progressStatus = 'In Progress';
        assignmentStatus = 'In Progress';
    }

    const updatePayload = {
        submitted_minutes: submittedMinutes,
        validated_minutes: validatedMinutes,
        progress_status: progressStatus,
        updated_at: now,
    };

    if (assignmentStatus) {
        updatePayload.assignment_status = assignmentStatus;
    }

    const { data, error } = await supabase
        .from('return_of_obligations')
        .update(updatePayload)
        .eq('ro_id', roId)
        .select()
        .single();

    if (error) {
        throw createHttpError(500, error.message);
    }

    return data;
}

async function resolveAssignedDepartment(value) {
    const departmentName = cleanText(value);

    if (!departmentName) {
        throw createHttpError(400, 'Assigned area is required.');
    }

    const { data, error } = await supabase
        .from('ro_departments')
        .select('department_id, department_name, is_active')
        .eq('department_name', departmentName)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    if (!data) {
        throw createHttpError(400, 'Selected RO department does not exist.');
    }

    if (data.is_active === false) {
        throw createHttpError(400, 'Selected RO department is inactive.');
    }

    return data;
}

async function getPlacementsForROIds(roIds) {
    const ids = [...new Set(roIds.filter(Boolean))];
    if (!ids.length) return new Map();

    const { data, error } = await supabase
        .from('ro_placements')
        .select(`
          placement_id,
          ro_id,
          ro_area_id,
          placement_status,
          admin_remarks,
          coordinator_remarks,
          requested_at,
          decided_at,
          ro_departments (
            department_name
          )
        `)
        .in('ro_id', ids)
        .order('created_at', { ascending: true });

    if (error) throw createHttpError(500, error.message);

    const map = new Map();
    for (const placement of data || []) {
        const current = map.get(placement.ro_id) || [];
        current.push({
            placement_id: placement.placement_id,
            ro_area_id: placement.ro_area_id,
            assigned_area: placement.ro_departments?.department_name || '',
            placement_status: placement.placement_status,
            admin_remarks: placement.admin_remarks || null,
            coordinator_remarks: placement.coordinator_remarks || null,
            requested_at: placement.requested_at || null,
            decided_at: placement.decided_at || null,
        });
        map.set(placement.ro_id, current);
    }
    return map;
}

async function findRoCoordinator(department) {
    const result = await db.query(
        `
        SELECT
          rac.coordinator_assignment_id,
          rac.user_id,
          ap.first_name,
          ap.last_name,
          rd.department_id,
          rd.department_name AS department,
          ap.position
        FROM ro_area_coordinators rac
        JOIN ro_departments rd
          ON rd.department_id = rac.ro_area_id
        JOIN admin_profiles ap
          ON ap.user_id = rac.user_id
        WHERE rac.ro_area_id = $1
          AND rac.is_active = true
          AND rd.is_active = true
          AND COALESCE(ap.is_archived, false) = false
        LIMIT 1
        `,
        [department.department_id]
    );
    const coordinator = result.rows[0];

    if (!coordinator?.user_id) {
        throw createHttpError(
            400,
            `No active RO Coordinator is assigned to ${department.department_name}. Assign a coordinator first.`
        );
    }
    return coordinator;
}

async function getCurrentPlacement(roId, roAreaId) {
    const { data: current, error: currentError } = await supabase
        .from('ro_placements')
        .select('placement_id, placement_status')
        .eq('ro_id', roId)
        .eq('ro_area_id', roAreaId)
        .in('placement_status', ['Pending', 'Approved'])
        .limit(1)
        .maybeSingle();

    if (currentError) {
        throw createHttpError(500, currentError.message);
    }

    return current || null;
}

async function getScholarRequestForAssignment(requestId, client = db) {
    const normalizedRequestId = cleanText(requestId);
    if (!normalizedRequestId) return null;

    const result = await client.query(
        `SELECT
           rsr.request_id,
           rsr.ro_area_id,
           rsr.coordinator_assignment_id,
           rsr.requested_by_user_id,
           rsr.requested_scholar_count,
           rsr.purpose,
           rsr.preferred_date,
           rsr.request_status,
           rsr.admin_remarks,
           rd.department_name AS assigned_area,
           rac.user_id AS coordinator_user_id,
           ap.first_name AS coordinator_first_name,
           ap.last_name AS coordinator_last_name
         FROM ro_scholar_requests rsr
         JOIN ro_departments rd
           ON rd.department_id = rsr.ro_area_id
          AND rd.is_active = true
         JOIN ro_area_coordinators rac
           ON rac.coordinator_assignment_id = rsr.coordinator_assignment_id
          AND rac.ro_area_id = rsr.ro_area_id
          AND rac.is_active = true
         LEFT JOIN admin_profiles ap
           ON ap.user_id = rac.user_id
          AND COALESCE(ap.is_archived, false) = false
         WHERE rsr.request_id = $1::uuid
         LIMIT 1`,
        [normalizedRequestId]
    );

    const request = result.rows[0] || null;
    if (!request) {
        throw createHttpError(404, 'This RO scholar request is unavailable or its coordinator assignment is no longer active.');
    }
    if (!['Pending', 'Acknowledged'].includes(request.request_status)) {
        throw createHttpError(409, `This RO scholar request is already ${String(request.request_status || '').toLowerCase()}.`);
    }

    return request;
}

async function getScholarRequestProgress(requestId, client = db) {
    const result = await client.query(
        `SELECT
           rsr.request_id,
           rsr.requested_scholar_count,
           COUNT(rp.placement_id) FILTER (
             WHERE rp.placement_status = 'Approved'
               AND rp.conflict_reason IS NULL
           )::int AS active_assignment_count,
           COUNT(rp.placement_id) FILTER (
             WHERE rp.placement_status = 'Approved'
               AND rp.student_acknowledged_at IS NOT NULL
               AND rp.conflict_reason IS NULL
           )::int AS acknowledged_count,
           COUNT(rp.placement_id) FILTER (
             WHERE rp.placement_status = 'Approved'
               AND rp.student_acknowledged_at IS NULL
               AND rp.conflict_reason IS NULL
           )::int AS awaiting_acknowledgment_count,
           COUNT(rp.placement_id) FILTER (
             WHERE rp.placement_status = 'Approved'
               AND rp.conflict_reason IS NOT NULL
           )::int AS concern_count
         FROM ro_scholar_requests rsr
         LEFT JOIN ro_placements rp
           ON rp.scholar_request_id = rsr.request_id
         WHERE rsr.request_id = $1::uuid
         GROUP BY rsr.request_id, rsr.requested_scholar_count`,
        [requestId]
    );

    const row = result.rows[0];
    if (!row) throw createHttpError(404, 'RO scholar request not found.');

    const requested = Math.max(0, Number(row.requested_scholar_count || 0));
    const active = Math.max(0, Number(row.active_assignment_count || 0));
    const acknowledged = Math.max(0, Number(row.acknowledged_count || 0));
    const awaiting = Math.max(0, Number(row.awaiting_acknowledgment_count || 0));
    const concerns = Math.max(0, Number(row.concern_count || 0));

    return {
        requested_scholar_count: requested,
        active_assignment_count: active,
        acknowledged_count: acknowledged,
        awaiting_acknowledgment_count: awaiting,
        concern_count: concerns,
        remaining_assignment_count: Math.max(0, requested - active),
        remaining_confirmation_count: Math.max(0, requested - acknowledged),
    };
}

function getRequestAssignmentStage(progress = {}) {
    const requested = Math.max(0, Number(progress.requested_scholar_count || 0));
    const assigned = Math.max(0, Number(progress.active_assignment_count || 0));

    if (assigned <= 0) return 'Pending';
    if (requested > 0 && assigned >= requested) return 'Fully Assigned';
    return 'Partially Assigned';
}

async function syncScholarRequestStatus(requestId, adminUserId = null, client = db) {
    if (!requestId) return null;
    const progress = await getScholarRequestProgress(requestId, client);
    const nextStatus = progress.acknowledged_count >= progress.requested_scholar_count
        ? 'Fulfilled'
        : progress.active_assignment_count > 0 || progress.concern_count > 0
            ? 'Acknowledged'
            : 'Pending';

    const result = await client.query(
        `UPDATE ro_scholar_requests
         SET request_status = CASE
               WHEN request_status IN ('Declined', 'Cancelled') THEN request_status
               ELSE $2
             END,
             handled_by_user_id = COALESCE(handled_by_user_id, $3::uuid),
             handled_at = CASE
               WHEN COALESCE(handled_at, NULL) IS NULL AND $3::uuid IS NOT NULL THEN now()
               ELSE handled_at
             END,
             updated_at = now()
         WHERE request_id = $1::uuid
         RETURNING *`,
        [requestId, nextStatus, adminUserId]
    );

    return {
        request: result.rows[0] || null,
        progress: {
            ...progress,
            assignment_stage: getRequestAssignmentStage(progress),
        },
    };
}

async function sendScholarAssignmentNotification({ student, roId, assignedArea }) {
    if (!student?.user_id || typeof notificationService?.createUserNotification !== 'function') return null;
    try {
        return await notificationService.createUserNotification({
            userId: student.user_id,
            type: 'Return of Obligation',
            title: 'New required RO assignment',
            message: `You have been assigned to ${assignedArea} for your required Return of Obligation. Open the scholar app, review the details, and acknowledge the assignment. You may report a legitimate concern if needed.`,
            referenceId: roId,
            referenceType: 'return_of_obligation',
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('RO SCHOLAR ASSIGNMENT NOTIFICATION ERROR:', error.message || error);
        return null;
    }
}

async function createPlacementRequest({
    client,
    roId,
    department,
    coordinator,
    adminUserId,
    remarks,
    currentPlacement = null,
    scholarRequestId = null,
    coordinatorPreapproved = false,
}) {
    const current =
        currentPlacement ||
        (await getCurrentPlacement(roId, department.department_id));

    if (current?.placement_status === 'Approved') {
        throw createHttpError(
            409,
            `${department.department_name} is already an approved placement for this obligation.`
        );
    }

    const now = new Date().toISOString();
    const payload = {
        coordinator_assignment_id: coordinator.coordinator_assignment_id,
        scholar_request_id: scholarRequestId || null,
        placement_status: coordinatorPreapproved ? 'Approved' : 'Pending',
        admin_remarks: cleanText(remarks) || null,
        coordinator_remarks: coordinatorPreapproved
            ? 'Placement created from this RO Area coordinator scholar request.'
            : null,
        requested_by_user_id: adminUserId,
        requested_at: now,
        decided_by_user_id: coordinatorPreapproved ? coordinator.user_id : null,
        decided_at: coordinatorPreapproved ? now : null,
        student_acknowledged_at: null,
        conflict_reason: null,
        updated_at: now,
    };

    if (current?.placement_id) {
        return saveAssignmentRecord(client, 'ro_placements', payload, 'placement_id', current.placement_id);
    }

    return saveAssignmentRecord(client, 'ro_placements', {
            ro_id: roId,
            ro_area_id: department.department_id,
            ...payload,
            created_at: now,
        });
}

// Table/column names and payload keys are supplied only by the fixed assignment
// code below. Values always use parameters, including IDs and Admin remarks.
async function saveAssignmentRecord(client, table, payload, idColumn = null, id = null) {
    const keys = Object.keys(payload);
    const values = Object.values(payload);
    const sql = idColumn
        ? `UPDATE ${table} SET ${keys.map((key, index) => `${key} = $${index + 1}`).join(', ')} WHERE ${idColumn} = $${keys.length + 1} RETURNING *`
        : `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`;
    const result = await client.query(sql, idColumn ? [...values, id] : values);
    if (!result.rows[0]) throw createHttpError(409, 'The RO record changed. Refresh before assigning again.');
    return result.rows[0];
}

async function sendCoordinatorRequestNotification({ coordinator, roId, student, assignedArea }) {
    if (!coordinator?.user_id || typeof notificationService?.createUserNotification !== 'function') return null;
    try {
        return await notificationService.createUserNotification({
            userId: coordinator.user_id,
            type: 'Return of Obligation',
            title: 'RO approval request',
            message: `Admin sent an RO request for ${fullName(student) || 'a scholar'} to ${assignedArea}. Review the request in your RO Coordinator queue.`,
            referenceId: roId,
            referenceType: 'return_of_obligation',
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('RO COORDINATOR NOTIFICATION ERROR:', error.message || error);
        return null;
    }
}

async function getStudentForRoNotice(studentId) {
    const { data, error } = await supabase
        .from('students')
        .select(`
      student_id,
      user_id,
      pdm_id,
      first_name,
      middle_name,
      last_name
    `)
        .eq('student_id', studentId)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    if (!data) {
        throw createHttpError(404, 'Student not found.');
    }

    return data;
}

async function sendRoAssignmentNotification({
    student,
    roId,
    assignedArea,
}) {
    try {
        if (
            !student?.user_id ||
            typeof notificationService?.createUserNotification !== 'function'
        ) {
            return null;
        }

        const message = [
            `You have been assigned a Return of Obligation task at ${assignedArea}.`,
            'Please open the RO module to view and acknowledge your assignment.',
        ]
            .filter(Boolean)
            .join(' ');

        const notification = await notificationService.createUserNotification({
            userId: student.user_id,
            type: 'RO Assignment',
            title: 'Return of Obligation Assigned',
            message,
            referenceId: roId,
            referenceType: 'return_of_obligation',
            createdAt: new Date().toISOString(),
        });

        return notification;
    } catch (error) {
        console.error('RO ASSIGNMENT NOTIFICATION ERROR:', error.message);
        return null;
    }
}

async function getStudentNotificationTarget(studentId) {
    if (!studentId) return null;

    const { data, error } = await supabase
        .from('students')
        .select(`
      student_id,
      user_id,
      pdm_id,
      first_name,
      middle_name,
      last_name
    `)
        .eq('student_id', studentId)
        .maybeSingle();

    if (error) {
        console.error('GET RO NOTIFICATION TARGET ERROR:', error.message);
        return null;
    }

    return data || null;
}

async function sendRoTimeLogValidationNotification({
    studentId,
    log,
    validationStatus,
    validatedMinutes,
}) {
    try {
        if (typeof notificationService?.createUserNotification !== 'function') {
            return null;
        }

        const student = await getStudentNotificationTarget(studentId);

        if (!student?.user_id) return null;

        const isApproved = validationStatus === 'Approved';
        const title = isApproved
            ? 'RO Time Log Approved'
            : 'RO Time Log Rejected';

        const message = isApproved
            ? `Your Return of Obligation time log has been approved. Approved time: ${validatedMinutes} minute(s).`
            : 'Your Return of Obligation time log was rejected. Please check the RO module for details.';

        return await notificationService.createUserNotification({
            userId: student.user_id,
            type: 'RO Validation',
            title,
            message,
            referenceId: log?.log_id || null,
            referenceType: 'ro_time_log',
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('RO VALIDATION NOTIFICATION ERROR:', error.message);
        return null;
    }
}

async function getScholarObligationHistory(studentId) {
    if (!studentId) {
        throw createHttpError(400, 'Student ID is required.');
    }

    const { data: student, error: studentError } = await supabase
        .from('students')
        .select(`
            student_id,
            pdm_id,
            first_name,
            middle_name,
            last_name,
            profile_photo_url
        `)
        .eq('student_id', studentId)
        .maybeSingle();

    if (studentError) {
        throw createHttpError(500, studentError.message);
    }

    if (!student) {
        throw createHttpError(404, 'Scholar not found.');
    }

    const { data: roRows, error: roError } = await supabase
        .from('return_of_obligations')
        .select(`
            ro_id,
            student_id,
            application_id,
            opening_id,
            program_id,
            academic_year_id,
            period_id,
            ro_status,
            cleared_at,
            cleared_by,
            remarks,
            created_at,
            updated_at,
            setting_id,
            required_hours,
            progress_status,
            submitted_progress,
            ro_progress,
            submitted_minutes,
            validated_minutes,
            assigned_area,
            assignment_status,
            assignment_acknowledged_at,
            conflict_reason,
            assigned_by,
            assigned_at,
            coordinator_status,
            coordinator_remarks,
            coordinator_user_id,
            coordinator_decided_at
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

    if (roError) {
        throw createHttpError(500, roError.message);
    }

    const obligations = roRows || [];

    const studentPayload = {
        student_id: student.student_id,
        pdm_id: student.pdm_id || '',
        name: fullName(student),
        avatar_url: await resolveAvatarUrl(student.profile_photo_url),
    };

    if (!obligations.length) {
        return {
            student: studentPayload,
            history: [],
        };
    }

    const periodIds = [
        ...new Set(
            obligations
                .map((row) => row.period_id)
                .filter(Boolean)
        ),
    ];

    let periods = [];

    if (periodIds.length) {
        const { data, error } = await supabase
            .from('academic_period')
            .select(`
                period_id,
                academic_year_id,
                term,
                is_active,
                activated_at,
                created_at,
                updated_at
            `)
            .in('period_id', periodIds);

        if (error) {
            throw createHttpError(500, error.message);
        }

        periods = data || [];
    }

    const periodMap = new Map(
        periods.map((period) => [
            String(period.period_id),
            period,
        ])
    );

    const academicYearIds = [
        ...new Set(
            [
                ...periods.map((period) => period.academic_year_id),
                ...obligations.map((row) => row.academic_year_id),
            ].filter(Boolean)
        ),
    ];

    let academicYears = [];

    if (academicYearIds.length) {
        const { data, error } = await supabase
            .from('academic_years')
            .select(`
                academic_year_id,
                start_year,
                end_year,
                label
            `)
            .in('academic_year_id', academicYearIds);

        if (error) {
            throw createHttpError(500, error.message);
        }

        academicYears = data || [];
    }

    const academicYearMap = new Map(
        academicYears.map((year) => [
            String(year.academic_year_id),
            year,
        ])
    );

    const roIds = obligations
        .map((row) => row.ro_id)
        .filter(Boolean);

    const [logsByRo, placementsByRo] = await Promise.all([
        getLogsForROIds(roIds),
        getPlacementsForROIds(roIds),
    ]);

    const semesterRank = (value) => {
        const normalized = normalizeText(value);

        if (normalized.includes('second')) return 2;
        if (normalized.includes('first')) return 1;
        if (normalized.includes('summer')) return 3;

        return 0;
    };

    const history = obligations.map((ro) => {
        const period =
            periodMap.get(String(ro.period_id || '')) || {};

        const academicYearId =
            period.academic_year_id ||
            ro.academic_year_id ||
            null;

        const academicYear =
            academicYearMap.get(String(academicYearId || '')) || {};

        const academicYearLabel =
            cleanText(academicYear.label) ||
            (
                academicYear.start_year && academicYear.end_year
                    ? `${academicYear.start_year}-${academicYear.end_year}`
                    : ''
            );

        const placements =
            placementsByRo.get(ro.ro_id) || [];

        const approvedPlacement = placements.find(
            (placement) =>
                normalizeText(placement.placement_status) === 'approved'
        );

        const activePlacement =
            approvedPlacement ||
            placements.find((placement) => {
                const status = normalizeText(
                    placement.placement_status
                );

                return (
                    status === 'pending' ||
                    status === 'approved'
                );
            });

        const logs = (logsByRo.get(ro.ro_id) || []).map(
            serializeLog
        );

        const requiredMinutes =
            Math.max(0, toNumber(ro.required_hours) * 60);

        const submittedMinutes =
            Math.max(0, toNumber(ro.submitted_minutes));

        const validatedMinutes =
            Math.max(0, toNumber(ro.validated_minutes));

        const submittedProgress =
            ro.submitted_progress != null
                ? Math.min(
                    100,
                    Math.max(
                        0,
                        toNumber(ro.submitted_progress)
                    )
                )
                : percentFromMinutes(
                    submittedMinutes,
                    requiredMinutes
                );

        const validatedProgress =
            ro.ro_progress != null
                ? Math.min(
                    100,
                    Math.max(
                        0,
                        toNumber(ro.ro_progress)
                    )
                )
                : percentFromMinutes(
                    validatedMinutes,
                    requiredMinutes
                );

        const isCleared =
            isClearedStatus(ro.ro_status) ||
            isClearedStatus(ro.assignment_status);

        const assignedArea =
            activePlacement?.assigned_area ||
            cleanText(ro.assigned_area) ||
            '';

        const proofCount = logs.reduce(
            (total, log) =>
                total +
                (
                    Array.isArray(log.proofs)
                        ? log.proofs.length
                        : 0
                ),
            0
        );

        return {
            ro_id: ro.ro_id,
            roId: ro.ro_id,

            student_id: ro.student_id,
            studentId: ro.student_id,

            application_id: ro.application_id,
            applicationId: ro.application_id,

            opening_id: ro.opening_id,
            openingId: ro.opening_id,

            program_id: ro.program_id,
            programId: ro.program_id,

            academic_year_id: academicYearId,
            academicYearId: academicYearId,

            period_id: ro.period_id,
            periodId: ro.period_id,

            academic_year: academicYearLabel,
            academicYear: academicYearLabel,

            semester: cleanText(period.term),

            is_current_period: period.is_active === true,
            isCurrentPeriod: period.is_active === true,

            required_hours: toNumber(ro.required_hours),
            requiredHours: toNumber(ro.required_hours),

            required_minutes: requiredMinutes,
            requiredMinutes,

            submitted_minutes: submittedMinutes,
            submittedMinutes,

            validated_minutes: validatedMinutes,
            validatedMinutes,

            submitted_progress: submittedProgress,
            submittedProgress,

            validated_progress: validatedProgress,
            validatedProgress,

            ro_progress: validatedProgress,

            ro_status: ro.ro_status || 'Pending',
            roStatus: ro.ro_status || 'Pending',

            progress_status:
                ro.progress_status || 'Not Started',
            progressStatus:
                ro.progress_status || 'Not Started',

            assignment_status:
                ro.assignment_status || 'Unassigned',
            assignmentStatus:
                ro.assignment_status || 'Unassigned',

            assigned_area: assignedArea,
            assignedArea,

            remarks: cleanText(ro.remarks),

            conflict_reason:
                cleanText(ro.conflict_reason),
            conflictReason:
                cleanText(ro.conflict_reason),

            cleared_at: ro.cleared_at || null,
            clearedAt: ro.cleared_at || null,

            cleared_by: ro.cleared_by || null,
            clearedBy: ro.cleared_by || null,

            assigned_at: ro.assigned_at || null,
            assignedAt: ro.assigned_at || null,

            assignment_acknowledged_at:
                ro.assignment_acknowledged_at || null,
            assignmentAcknowledgedAt:
                ro.assignment_acknowledged_at || null,

            created_at: ro.created_at || null,
            createdAt: ro.created_at || null,

            updated_at: ro.updated_at || null,
            updatedAt: ro.updated_at || null,

            is_cleared: isCleared,
            isCleared,

            placements,

            logs,

            log_count: logs.length,
            logCount: logs.length,

            proof_count: proofCount,
            proofCount,
        };
    });

    history.sort((a, b) => {
        if (a.is_current_period !== b.is_current_period) {
            return a.is_current_period ? -1 : 1;
        }

        const aStartYear =
            Number(
                String(
                    a.academic_year || ''
                ).split('-')[0]
            ) || 0;

        const bStartYear =
            Number(
                String(
                    b.academic_year || ''
                ).split('-')[0]
            ) || 0;

        if (aStartYear !== bStartYear) {
            return bStartYear - aStartYear;
        }

        const semesterDifference =
            semesterRank(b.semester) -
            semesterRank(a.semester);

        if (semesterDifference !== 0) {
            return semesterDifference;
        }

        const aCreated =
            Date.parse(a.created_at || '') || 0;

        const bCreated =
            Date.parse(b.created_at || '') || 0;

        return bCreated - aCreated;
    });

    return {
        student: studentPayload,
        history,
    };
}

exports.getScholarObligationHistory =
    getScholarObligationHistory;

async function sendRoClearanceNotification({ studentId, ro }) {
    try {
        if (typeof notificationService?.createUserNotification !== 'function') {
            return null;
        }

        const student = await getStudentNotificationTarget(studentId);

        if (!student?.user_id) return null;

        return await notificationService.createUserNotification({
            userId: student.user_id,
            type: 'RO Clearance',
            title: 'Return of Obligation Completed',
            message:
                'Your Return of Obligation has been marked as completed. Please check the RO module for your updated status.',
            referenceId: ro?.ro_id || null,
            referenceType: 'return_of_obligation',
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('RO CLEARANCE NOTIFICATION ERROR:', error.message);
        return null;
    }
}

exports.getSummary = async () => {
    const currentPeriod = await getCurrentAcademicPeriod();

    const { data: roRows, error: roError } = await supabase
        .from('return_of_obligations')
        .select('ro_id, ro_status, assignment_status, progress_status')
        .eq('period_id', currentPeriod.period_id);

    if (roError) {
        throw createHttpError(500, roError.message);
    }

    const currentRoIds = (roRows || [])
        .map((row) => row.ro_id)
        .filter(Boolean);

    let pendingLogs = [];

    if (currentRoIds.length > 0) {
        const { data: logs, error: logError } = await supabase
            .from('ro_time_logs')
            .select('log_id, validation_status')
            .in('ro_id', currentRoIds)
            .eq('validation_status', 'Pending Validation');

        if (logError) {
            throw createHttpError(500, logError.message);
        }

        pendingLogs = logs || [];
    }

    const summary = {
        assigned: 0,
        acknowledged: 0,
        conflict: 0,
        inProgress: 0,
        forValidation: 0,
        cleared: 0,
        pendingLogs: pendingLogs.length,
        total: roRows?.length || 0,
        periodId: currentPeriod.period_id,
        academicYearId: currentPeriod.academic_year_id,
        term: currentPeriod.term,
    };

    for (const row of roRows || []) {
        const assignmentStatus = row.assignment_status || 'Assigned';
        const progressStatus = row.progress_status || '';

        if (row.ro_status === 'Cleared' || assignmentStatus === 'Cleared') {
            summary.cleared += 1;
        } else if (assignmentStatus === 'Conflict Reported') {
            summary.conflict += 1;
        } else if (assignmentStatus === 'Acknowledged') {
            summary.acknowledged += 1;
        } else if (assignmentStatus === 'Assigned') {
            summary.assigned += 1;
        } else if (progressStatus === 'For Validation') {
            summary.forValidation += 1;
        } else if (progressStatus === 'In Progress') {
            summary.inProgress += 1;
        }
    }

    return summary;
};

exports.getROScholars = async (filters = {}) => {
    const currentPeriod = await getCurrentAcademicPeriod();

    const {
        search = '',
        courseId = 'all',
        yearLevel = 'all',
        openingId = 'all',
        status = 'all',
    } = filters || {};

    let applicationQuery = supabase
        .from('applications')
        .select(`
      application_id,
      student_id,
      program_id,
      opening_id,
      application_status,
      submission_date
    `)
        .in('application_status', APPROVED_APPLICATION_STATUSES)
        .order('submission_date', { ascending: false });

    if (openingId && openingId !== 'all') {
        applicationQuery = applicationQuery.eq('opening_id', openingId);
    }

    const { data: applications, error: applicationError } =
        await applicationQuery;

    if (applicationError) {
        throw createHttpError(500, applicationError.message);
    }

    const approvedApplications = applications || [];

    if (!approvedApplications.length) return [];

    const studentIds = [
        ...new Set(
            approvedApplications.map((app) => app.student_id).filter(Boolean)
        ),
    ];

    let studentQuery = supabase
        .from('students')
        .select(`
      student_id,
      pdm_id,
      first_name,
      middle_name,
      last_name,
      year_level,
      profile_photo_url,
      is_active_scholar,
      course_id
    `)
        .in('student_id', studentIds)
        .eq('is_active_scholar', true);

    if (courseId && courseId !== 'all') {
        studentQuery = studentQuery.eq('course_id', courseId);
    }

    if (yearLevel && yearLevel !== 'all') {
        studentQuery = studentQuery.eq('year_level', yearLevel);
    }

    const { data: students, error: studentError } = await studentQuery;

    if (studentError) {
        throw createHttpError(500, studentError.message);
    }

    const filteredStudents = students || [];

    if (!filteredStudents.length) return [];

    const studentMap = new Map(
        filteredStudents.map((student) => [student.student_id, student])
    );

    const finalApplications = approvedApplications.filter((app) =>
        studentMap.has(app.student_id)
    );

    if (!finalApplications.length) return [];

    const courseIds = [
        ...new Set(filteredStudents.map((s) => s.course_id).filter(Boolean)),
    ];

    const programIds = [
        ...new Set(finalApplications.map((a) => a.program_id).filter(Boolean)),
    ];

    const openingIds = [
        ...new Set(finalApplications.map((a) => a.opening_id).filter(Boolean)),
    ];

    const applicationIds = [
        ...new Set(
            finalApplications.map((a) => a.application_id).filter(Boolean)
        ),
    ];

    const [courseResult, programResult, openingResult, roResult] =
        await Promise.all([
            courseIds.length
                ? supabase
                    .from('academic_course')
                    .select('course_id, course_code, course_name')
                    .in('course_id', courseIds)
                : Promise.resolve({ data: [], error: null }),

            programIds.length
                ? supabase
                    .from('scholarship_program')
                    .select('program_id, program_name, benefactor_id')
                    .in('program_id', programIds)
                : Promise.resolve({ data: [], error: null }),

            openingIds.length
                ? supabase
                    .from('program_openings')
                    .select('opening_id, opening_title, posting_status')
                    .in('opening_id', openingIds)
                : Promise.resolve({ data: [], error: null }),

            applicationIds.length
                ? supabase
                    .from('return_of_obligations')
                    .select(`
              ro_id,
              student_id,
              application_id,
              opening_id,
              program_id,
              academic_year_id,
              period_id,
              ro_status,
              cleared_at,
              cleared_by,
              remarks,
              created_at,
              updated_at,
              setting_id,
              required_hours,
              progress_status,
              submitted_progress,
              ro_progress,
              submitted_minutes,
              validated_minutes,
              assigned_area,
              assignment_status,
              assignment_acknowledged_at,
              conflict_reason,
              assigned_by,
              assigned_at,
              coordinator_status,
              coordinator_remarks,
              coordinator_user_id,
              coordinator_decided_at
            `)
                    .in('application_id', applicationIds)
                    .eq('period_id', currentPeriod.period_id)
                : Promise.resolve({ data: [], error: null }),
        ]);

    if (courseResult.error) {
        throw createHttpError(500, courseResult.error.message);
    }

    if (programResult.error) {
        throw createHttpError(500, programResult.error.message);
    }

    if (openingResult.error) {
        throw createHttpError(500, openingResult.error.message);
    }

    if (roResult.error) {
        throw createHttpError(500, roResult.error.message);
    }

    const programs = programResult.data || [];

    const benefactorIds = [
        ...new Set(programs.map((program) => program.benefactor_id).filter(Boolean)),
    ];

    const { data: benefactors, error: benefactorError } = benefactorIds.length
        ? await supabase
            .from('benefactors')
            .select('benefactor_id, benefactor_name')
            .in('benefactor_id', benefactorIds)
        : { data: [], error: null };

    if (benefactorError) {
        throw createHttpError(500, benefactorError.message);
    }

    const courseMap = new Map(
        (courseResult.data || []).map((course) => [course.course_id, course])
    );

    const programMap = new Map(
        programs.map((program) => [program.program_id, program])
    );

    const benefactorMap = new Map(
        (benefactors || []).map((benefactor) => [
            benefactor.benefactor_id,
            benefactor,
        ])
    );

    const openingMap = new Map(
        (openingResult.data || []).map((opening) => [opening.opening_id, opening])
    );

    const roRows = roResult.data || [];
    const roByApplication = new Map();

    for (const ro of roRows) {
        if (ro.application_id) {
            roByApplication.set(ro.application_id, ro);
        }
    }

    const roIds = roRows.map((row) => row.ro_id);
    const [logsByRo, placementsByRo] = await Promise.all([
        getLogsForROIds(roIds),
        getPlacementsForROIds(roIds),
    ]);

    const searchNeedle = normalizeText(search);

    const rows = await Promise.all(
        finalApplications.map(async (app) => {
            const student = studentMap.get(app.student_id);

            if (!student) return null;

            const course = courseMap.get(student.course_id) || {};
            const program = programMap.get(app.program_id) || {};
            const benefactor = benefactorMap.get(program.benefactor_id) || {};
            const opening = openingMap.get(app.opening_id) || {};
            const ro = roByApplication.get(app.application_id) || null;
            const logs = ro?.ro_id ? logsByRo.get(ro.ro_id) || [] : [];
            const placements = ro?.ro_id ? placementsByRo.get(ro.ro_id) || [] : [];
            const latestPlacement = placements.at(-1) || null;
            const placementAreaById = new Map(
                placements.map((placement) => [
                    placement.placement_id,
                    placement.assigned_area || '',
                ])
            );

            const serializedLogs = logs.map((log) => ({
                ...serializeLog(log),
                assigned_area: placementAreaById.get(log.placement_id) || '',
                assignedArea: placementAreaById.get(log.placement_id) || '',
            }));
            const pendingLogs = serializedLogs.filter(
                (log) => log.validationStatus === 'Pending Validation'
            );
            const activeLog = serializedLogs.find(
                (log) => log.logStatus === 'Timed In' && !log.timeOutAt
            );

            const name = fullName(student) || 'Unknown Scholar';
            const cleared = !!ro && isClearedStatus(ro.ro_status);

            const requiredHours = toNumber(ro?.required_hours);
            const requiredMinutes = requiredHours * 60;
            const submittedMinutes = toNumber(ro?.submitted_minutes);
            const validatedMinutes = toNumber(ro?.validated_minutes);

            const assignmentStatus = cleared
                ? 'Cleared'
                : ro?.assignment_status || 'Unassigned';

            const submittedProgress = percentFromMinutes(
                submittedMinutes,
                requiredMinutes
            );

            const validatedProgress = percentFromMinutes(
                validatedMinutes,
                requiredMinutes
            );

            return {
                student_id: student.student_id,
                pdm_id: student.pdm_id,
                first_name: student.first_name,
                middle_name: student.middle_name,
                last_name: student.last_name,
                name,
                year_level: student.year_level,
                profile_photo_url: await resolveAvatarUrl(student.profile_photo_url),
                is_active_scholar: student.is_active_scholar,

                course_id: student.course_id,
                course_code: course.course_code || null,
                course_name: course.course_name || null,

                application_id: app.application_id,
                application_status: app.application_status,
                submission_date: app.submission_date,

                program_id: app.program_id,
                program_name: program.program_name || 'Scholarship Program',
                benefactor_name: benefactor.benefactor_name || null,

                opening_id: app.opening_id,
                opening_title: opening.opening_title || 'Scholarship Opening',
                opening_status: opening.posting_status || null,

                ro_id: ro?.ro_id || null,
                ro_status: cleared ? 'Cleared' : ro?.ro_status || 'Pending',
                is_cleared: cleared,
                cleared_at: ro?.cleared_at || null,
                remarks: ro?.remarks || null,

                required_hours: requiredHours,
                requiredHours,
                required_minutes: requiredMinutes,
                requiredMinutes,

                submitted_minutes: submittedMinutes,
                submittedMinutes,

                validated_minutes: validatedMinutes,
                validatedMinutes,

                submitted_progress: submittedProgress,
                submittedProgress,

                ro_progress: validatedProgress,
                validatedProgress,

                progress_status: cleared ? 'Cleared' : ro?.progress_status || 'Not Started',
                progressStatus: cleared ? 'Cleared' : ro?.progress_status || 'Not Started',

                assigned_area: ro?.assigned_area || '',
                assignedArea: ro?.assigned_area || '',

                assignment_status: assignmentStatus,
                assignmentStatus,

                assignment_acknowledged_at: ro?.assignment_acknowledged_at || null,
                assignmentAcknowledgedAt: ro?.assignment_acknowledged_at || null,

                conflict_reason: ro?.conflict_reason || '',
                conflictReason: ro?.conflict_reason || '',

                assigned_at: ro?.assigned_at || null,
                assignedAt: ro?.assigned_at || null,

                coordinator_status:
                    latestPlacement?.placement_status ||
                    ro?.coordinator_status ||
                    (ro ? 'Approved' : null),
                coordinatorStatus:
                    latestPlacement?.placement_status ||
                    ro?.coordinator_status ||
                    (ro ? 'Approved' : null),
                coordinator_remarks:
                    latestPlacement?.coordinator_remarks || ro?.coordinator_remarks || null,
                coordinatorRemarks:
                    latestPlacement?.coordinator_remarks || ro?.coordinator_remarks || null,
                coordinator_decided_at:
                    latestPlacement?.decided_at || ro?.coordinator_decided_at || null,
                coordinatorDecidedAt:
                    latestPlacement?.decided_at || ro?.coordinator_decided_at || null,
                placements,

                logs: serializedLogs,
                pending_log_count: pendingLogs.length,
                pendingLogCount: pendingLogs.length,
                activeLog,
            };
        })
    );

    let finalRows = rows.filter(Boolean);

    if (searchNeedle) {
        finalRows = finalRows.filter((row) => {
            const haystack = normalizeText(
                [
                    row.name,
                    row.pdm_id,
                    row.course_code,
                    row.course_name,
                    row.program_name,
                    row.opening_title,
                    row.benefactor_name,
                    row.assigned_area,
                    row.assignment_status,
                ]
                    .filter(Boolean)
                    .join(' ')
            );

            return haystack.includes(searchNeedle);
        });
    }

    if (status && status !== 'all') {
        finalRows = finalRows.filter((row) => {
            const assignmentStatus = normalizeText(row.assignment_status);
            const progressStatus = normalizeText(row.progress_status);

            if (status === 'pending') return !row.is_cleared;
            if (status === 'cleared') return row.is_cleared;
            if (status === 'unassigned') return !row.ro_id;
            if (status === 'assigned') return assignmentStatus === 'assigned';
            if (status === 'acknowledged') return assignmentStatus === 'acknowledged';
            if (status === 'conflict') return assignmentStatus === 'conflict reported';
            if (status === 'in_progress') {
                return (
                    progressStatus === 'in progress' ||
                    assignmentStatus === 'in progress'
                );
            }
            if (status === 'for_validation') {
                return progressStatus === 'for validation' || row.pending_log_count > 0;
            }

            return true;
        });
    }

    return finalRows;
};

async function getActiveRoSettingForAssignments(currentPeriod = null) {
    const period = currentPeriod || await getCurrentAcademicPeriod();

    const { data, error } = await supabase
        .from('ro_settings')
        .select(`
          setting_id,
          academic_year_id,
          period_id,
          required_hours,
          allow_carry_over,
          is_active,
          updated_at
        `)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

    if (error) {
        throw createHttpError(500, error.message);
    }

    const settings = data || [];
    const selected =
        settings.find((row) => row.period_id === period.period_id) ||
        settings.find(
            (row) =>
                !row.period_id &&
                row.academic_year_id === period.academic_year_id
        ) ||
        settings.find(
            (row) => !row.period_id && !row.academic_year_id
        ) ||
        settings[0] ||
        null;

    if (!selected) {
        throw createHttpError(
            409,
            'Configure and activate the required hours in Maintenance > Obligation before sending an RO request.'
        );
    }

    const requiredHours = toNumber(selected.required_hours);

    if (requiredHours <= 0) {
        throw createHttpError(
            409,
            'The active RO setting must have required hours greater than zero.'
        );
    }

    return {
        ...selected,
        required_hours: requiredHours,
    };
}

exports.assignScholarRO = async (studentId, payload = {}, user = {}) => {
    const client = await db.connect();
    let committed = false;
    try {
    await client.query('BEGIN');
    // Serialize assignments for this student, including requests for different
    // RO areas. Read placement eligibility only after obtaining this lock.
    await client.query('SELECT student_id FROM students WHERE student_id = $1 FOR UPDATE', [studentId]);
    const currentPeriod = await getCurrentAcademicPeriod();
    const scholarRequestId = cleanText(
        payload.scholarRequestId || payload.scholar_request_id
    ) || null;
    const isScholarRequestWorkflow = payload[SCHOLAR_REQUEST_ASSIGNMENT_TOKEN] === true;

    if (scholarRequestId && !isScholarRequestWorkflow) {
        throw createHttpError(
            400,
            'Request-linked RO placements must be created from the RO Area scholar request workflow.'
        );
    }
    if (scholarRequestId) {
        await client.query('SELECT request_id FROM ro_scholar_requests WHERE request_id = $1 FOR UPDATE', [scholarRequestId]);
    }
    const scholarRequest = scholarRequestId
        ? await getScholarRequestForAssignment(scholarRequestId, client)
        : null;

    if (scholarRequest) {
        const progress = await getScholarRequestProgress(scholarRequestId, client);
        if (progress.remaining_assignment_count <= 0) {
            throw createHttpError(
                409,
                'This RO scholar request already has enough active scholar assignments. Wait for acknowledgments or resolve an existing concern before assigning more scholars.'
            );
        }
    }

    const application = await getApprovedApplicationForStudent(
        studentId,
        payload
    );
    const existingRO = await getROByApplication(
        studentId,
        application.application_id,
        currentPeriod.period_id
    );
    if (existingRO?.ro_id) {
        const activePlacement = await getActivePlacementForRO(
            existingRO.ro_id
        );

        if (activePlacement) {
            throw createHttpError(
                409,
                'This scholar is already assigned to an RO area for the current semester. Cancel or reject the existing placement before assigning another one.'
            );
        }
    }
    const student = await getStudentForRoNotice(studentId);
    const activeRoSetting = await getActiveRoSettingForAssignments(currentPeriod);

    if (existingRO?.ro_status === 'Cleared') {
        throw createHttpError(400, 'This scholar already has a cleared RO record.');
    }

    const now = new Date().toISOString();
    const adminUserId = getUserId(user);

    const assignedDepartment = scholarRequest
        ? await resolveAssignedDepartment(scholarRequest.assigned_area)
        : await resolveAssignedDepartment(payload.assignedArea || payload.assigned_area);
    const assignedDepartmentName = assignedDepartment.department_name;
    const coordinator = scholarRequest
        ? {
            coordinator_assignment_id: scholarRequest.coordinator_assignment_id,
            user_id: scholarRequest.coordinator_user_id,
            first_name: scholarRequest.coordinator_first_name,
            last_name: scholarRequest.coordinator_last_name,
            department_id: scholarRequest.ro_area_id,
            department: scholarRequest.assigned_area,
        }
        : await findRoCoordinator(assignedDepartment);

    if (
        scholarRequest &&
        String(assignedDepartment.department_id) !== String(scholarRequest.ro_area_id)
    ) {
        throw createHttpError(409, 'The selected RO Area does not match this coordinator scholar request.');
    }
    const currentPlacement = existingRO?.ro_id
        ? await getCurrentPlacement(
            existingRO.ro_id,
            assignedDepartment.department_id
        )
        : null;

    if (currentPlacement?.placement_status === 'Approved') {
        throw createHttpError(
            409,
            `${assignedDepartmentName} is already an approved placement for this obligation.`
        );
    }

    const requiredHours = Math.max(
        0,
        toNumber(activeRoSetting.required_hours)
    );

    const assignmentPayload = {
        student_id: studentId,
        application_id: application.application_id,
        opening_id: application.opening_id || payload.openingId || payload.opening_id || null,
        program_id: application.program_id || payload.programId || payload.program_id || null,
        academic_year_id: currentPeriod.academic_year_id,
        period_id: currentPeriod.period_id,

        required_hours: requiredHours,

        assigned_area: assignedDepartmentName,
        remarks: cleanText(payload.remarks) || null,

        assignment_status: scholarRequest ? 'Assigned' : 'Pending Coordinator Approval',
        coordinator_status: scholarRequest ? 'Approved' : 'Pending',
        coordinator_remarks: scholarRequest
            ? 'Coordinator approval satisfied by the originating scholar request.'
            : null,
        coordinator_user_id: scholarRequest ? coordinator.user_id : null,
        coordinator_decided_at: scholarRequest ? now : null,
        assignment_acknowledged_at: null,
        conflict_reason: null,
        assigned_by: adminUserId,
        assigned_at: now,
        updated_at: now,
    };

    let assignment;

    if (existingRO?.ro_id) {
        const preserveActivePlacement =
            ['Assigned', 'Acknowledged', 'In Progress', 'For Validation'].includes(
                existingRO.assignment_status
            );
        assignment = await saveAssignmentRecord(client, 'return_of_obligations', {
                assigned_area: preserveActivePlacement
                    ? existingRO.assigned_area
                    : assignedDepartmentName,
                remarks: cleanText(payload.remarks) || existingRO.remarks || null,
                assignment_status: preserveActivePlacement
                    ? existingRO.assignment_status
                    : scholarRequest
                        ? 'Assigned'
                        : 'Pending Coordinator Approval',
                coordinator_status: preserveActivePlacement || scholarRequest ? 'Approved' : 'Pending',
                coordinator_remarks: preserveActivePlacement
                    ? existingRO.coordinator_remarks
                    : scholarRequest
                        ? 'Coordinator approval satisfied by the originating scholar request.'
                        : null,
                coordinator_user_id: preserveActivePlacement
                    ? existingRO.coordinator_user_id
                    : scholarRequest
                        ? coordinator.user_id
                        : null,
                coordinator_decided_at: preserveActivePlacement
                    ? existingRO.coordinator_decided_at
                    : scholarRequest
                        ? now
                        : null,
                academic_year_id: currentPeriod.academic_year_id,
                period_id: currentPeriod.period_id,
                updated_at: now,
            }, 'ro_id', existingRO.ro_id);
    } else {
        assignment = await saveAssignmentRecord(client, 'return_of_obligations', {
                ...assignmentPayload,
                ro_status: 'Pending',
                setting_id: activeRoSetting?.setting_id || null,
                created_at: now,
            });
    }

    const placement = await createPlacementRequest({
        client,
        roId: assignment.ro_id,
        department: assignedDepartment,
        coordinator,
        adminUserId,
        remarks: payload.remarks || scholarRequest?.purpose,
        currentPlacement,
        scholarRequestId,
        coordinatorPreapproved: Boolean(scholarRequest),
    });

    const requestState = scholarRequest
        ? await syncScholarRequestStatus(scholarRequestId, adminUserId, client)
        : null;
    await client.query('COMMIT');
    committed = true;

    const notification = scholarRequest
        ? await sendScholarAssignmentNotification({
            student,
            roId: assignment.ro_id,
            assignedArea: assignedDepartmentName,
        })
        : await sendCoordinatorRequestNotification({
            coordinator,
            student,
            roId: assignment.ro_id,
            assignedArea: assignedDepartmentName,
        });

    return {
        message: scholarRequest
            ? 'Scholar assigned from the RO Area request and notified for acknowledgment.'
            : existingRO?.ro_id
                ? 'RO request updated and sent to the assigned coordinator.'
                : 'RO request created and sent to the assigned coordinator.',
        assignment,
        placement,
        coordinator: {
            user_id: coordinator.user_id,
            name: fullName(coordinator),
            department: coordinator.department,
        },
        notification,
        notification_target_user_id: scholarRequest ? student.user_id : coordinator.user_id,
        scholar_request_id: scholarRequestId,
        scholar_request: requestState,
    };
    } catch (error) {
        if (!committed) await client.query('ROLLBACK');
        if (error.code === '23514') {
            throw createHttpError(409, 'The RO assignment no longer meets the request or placement rules. Refresh before assigning again.');
        }
        throw error;
    } finally {
        client.release();
    }
};

exports.assignScholarsToRequest = async (requestId, payload = {}, user = {}) => {
    const normalizedRequestId = cleanText(requestId);
    if (!normalizedRequestId) {
        throw createHttpError(400, 'A valid RO scholar request is required.');
    }

    // Serialize assignments for the same request so two Admin sessions cannot
    // both observe the same remaining capacity and over-assign scholars.
    const lockClient = await db.connect();
    try {
        await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [normalizedRequestId]);

        const request = await getScholarRequestForAssignment(normalizedRequestId);
        const rawStudentIds = payload.studentIds || payload.student_ids || [];

        if (!Array.isArray(rawStudentIds) || rawStudentIds.length === 0) {
            throw createHttpError(400, 'Select at least one eligible scholar.');
        }

        const studentIds = [
            ...new Set(rawStudentIds.map((id) => cleanText(id)).filter(Boolean)),
        ];
        const initialProgress = await getScholarRequestProgress(normalizedRequestId);
        if (studentIds.length > initialProgress.remaining_assignment_count) {
            throw createHttpError(
                409,
                `This request currently needs only ${initialProgress.remaining_assignment_count} more scholar${initialProgress.remaining_assignment_count === 1 ? '' : 's'}.`
            );
        }

        const successful = [];
        const failed = [];
        for (const studentId of studentIds) {
            try {
                const result = await exports.assignScholarRO(
                    studentId,
                    {
                        scholarRequestId: normalizedRequestId,
                        assignedArea: request.assigned_area,
                        remarks: request.purpose,
                        [SCHOLAR_REQUEST_ASSIGNMENT_TOKEN]: true,
                    },
                    user
                );
                successful.push({
                    student_id: studentId,
                    ro_id: result?.assignment?.ro_id || null,
                    placement_id: result?.placement?.placement_id || null,
                    notification: result?.notification || null,
                    notification_target_user_id: result?.notification_target_user_id || null,
                    message: result?.message || 'Assigned successfully.',
                });
            } catch (error) {
                failed.push({
                    student_id: studentId,
                    error: error.message || 'Failed to assign scholar.',
                });
            }
        }

        // If a scholar reported a concern and Admin successfully assigned a
        // replacement, retire the same number of concerned placements. This
        // keeps the historical concern visible without allowing a later
        // resolution/acknowledgment to overfill the original request.
        const replacementsToRetire = Math.min(
            successful.length,
            Math.max(0, Number(initialProgress.concern_count || 0))
        );

        if (replacementsToRetire > 0) {
            const conflicted = await lockClient.query(
                `SELECT placement_id
                 FROM ro_placements
                 WHERE scholar_request_id = $1::uuid
                   AND placement_status = 'Approved'
                   AND conflict_reason IS NOT NULL
                 ORDER BY updated_at ASC, created_at ASC
                 LIMIT $2`,
                [normalizedRequestId, replacementsToRetire]
            );

            const placementIds = conflicted.rows
                .map((row) => row.placement_id)
                .filter(Boolean);

            if (placementIds.length) {
                await lockClient.query(
                    `UPDATE ro_placements
                     SET placement_status = 'Cancelled',
                         coordinator_remarks = CONCAT_WS(
                           ' ',
                           NULLIF(coordinator_remarks, ''),
                           'Replaced by Admin after the scholar reported a concern.'
                         ),
                         updated_at = now()
                     WHERE placement_id = ANY($1::uuid[])`,
                    [placementIds]
                );
            }
        }

        const state = await syncScholarRequestStatus(normalizedRequestId, getUserId(user));
        return {
            message: failed.length
                ? 'Scholar assignment completed with some records that could not be assigned.'
                : 'Selected scholars were assigned and notified for acknowledgment.',
            total: studentIds.length,
            success_count: successful.length,
            failed_count: failed.length,
            successful,
            failed,
            request: state?.request || null,
            progress: state?.progress || null,
        };
    } finally {
        try {
            await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [normalizedRequestId]);
        } finally {
            lockClient.release();
        }
    }
};

exports.batchAssignScholarsRO = async (payload = {}, user = {}) => {
    const rawStudentIds = payload.studentIds || payload.student_ids || [];

    if (!Array.isArray(rawStudentIds) || rawStudentIds.length === 0) {
        throw createHttpError(400, 'At least one scholar must be selected.');
    }

    const studentIds = [
        ...new Set(rawStudentIds.map((id) => String(id).trim()).filter(Boolean)),
    ];

    if (studentIds.length > 100) {
        throw createHttpError(
            400,
            'Batch assignment is limited to 100 scholars at a time.'
        );
    }

    const assignedArea = payload.assignedArea || payload.assigned_area;
    const remarks = payload.remarks || '';

    const successful = [];
    const failed = [];

    for (const studentId of studentIds) {
        try {
            const result = await exports.assignScholarRO(
                studentId,
                {
                    assignedArea,
                    assigned_area: assignedArea,
                    remarks,
                },
                user
            );

            successful.push({
                student_id: studentId,
                ro_id: result?.assignment?.ro_id || null,
                message: result?.message || 'Assigned successfully.',
                coordinator: result?.coordinator || null,
                notification: result?.notification || null,
            });
        } catch (error) {
            failed.push({
                student_id: studentId,
                error: error.message || 'Failed to assign RO.',
            });
        }
    }

    return {
        message:
            failed.length === 0
                ? 'Batch RO requests sent successfully.'
                : 'Batch RO requests completed with some failed records.',
        total: studentIds.length,
        success_count: successful.length,
        failed_count: failed.length,
        successful,
        failed,
    };
};

exports.validateTimeLog = async () => {
    throw createHttpError(
        409,
        'RO attendance evidence must be validated by the assigned department head. OSFA/Admin can only perform the final clearance after department validation.'
    );
};

exports.reviewTimeLogProof = async (proofId, payload = {}, user = {}) => {
    if (!proofId) {
        throw createHttpError(400, 'Proof ID is required.');
    }

    const proofStatus = cleanText(payload.proofStatus || payload.proof_status);

    if (!['Accepted', 'Rejected', 'Flagged', 'Pending Review'].includes(proofStatus)) {
        throw createHttpError(
            400,
            'Proof status must be Accepted, Rejected, Flagged, or Pending Review.'
        );
    }

    const now = new Date().toISOString();
    const adminUserId = getUserId(user);

    const { data: proof, error } = await supabase
        .from('ro_time_log_proofs')
        .update({
            proof_status: proofStatus,
            admin_comment:
                cleanText(
                    payload.adminComment ||
                    payload.admin_comment ||
                    payload.comment ||
                    payload.remarks
                ) || null,
            reviewed_by: adminUserId,
            reviewed_at: now,
        })
        .eq('proof_id', proofId)
        .select()
        .single();

    if (error) {
        throw createHttpError(500, error.message);
    }

    if (!proof) {
        throw createHttpError(404, 'RO proof not found.');
    }

    return {
        message: `Proof marked as ${proofStatus}.`,
        proof,
    };
};

exports.getScholarRequests = async (query = {}) => {
    const status = cleanText(query.status);
    const search = cleanText(query.search);
    const allowedStatuses = [
        'Pending',
        'Acknowledged',
        'Fulfilled',
        'Declined',
        'Cancelled',
    ];
    const statusFilter = allowedStatuses.includes(status) ? status : null;

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
           rsr.requested_by_user_id,
           CONCAT_WS(' ', ap.first_name, ap.last_name) AS requested_by_name,
           rsr.handled_by_user_id,
           rsr.handled_at,
           rsr.created_at,
           rsr.updated_at,
           COUNT(rp.placement_id) FILTER (
             WHERE rp.placement_status = 'Approved'
               AND rp.conflict_reason IS NULL
           )::int AS active_assignment_count,
           COUNT(rp.placement_id) FILTER (
             WHERE rp.placement_status = 'Approved'
               AND rp.student_acknowledged_at IS NOT NULL
               AND rp.conflict_reason IS NULL
           )::int AS acknowledged_count,
           COUNT(rp.placement_id) FILTER (
             WHERE rp.placement_status = 'Approved'
               AND rp.student_acknowledged_at IS NULL
               AND rp.conflict_reason IS NULL
           )::int AS awaiting_acknowledgment_count,
           COUNT(rp.placement_id) FILTER (
             WHERE rp.placement_status = 'Approved'
               AND rp.conflict_reason IS NOT NULL
           )::int AS concern_count,
           COALESCE(
             JSONB_AGG(
               JSONB_BUILD_OBJECT(
                 'placement_id', rp.placement_id,
                 'ro_id', ro.ro_id,
                 'student_id', st.student_id,
                 'pdm_id', st.pdm_id,
                 'student_name', CONCAT_WS(' ', st.first_name, st.middle_name, st.last_name),
                 'placement_status', rp.placement_status,
                 'acknowledged_at', rp.student_acknowledged_at,
                 'conflict_reason', rp.conflict_reason,
                 'assignment_status', ro.assignment_status
               ) ORDER BY rp.created_at
             ) FILTER (WHERE rp.placement_id IS NOT NULL),
             '[]'::jsonb
           ) AS assigned_scholars
         FROM ro_scholar_requests rsr
         JOIN ro_departments rd ON rd.department_id = rsr.ro_area_id
         LEFT JOIN admin_profiles ap ON ap.user_id = rsr.requested_by_user_id
         LEFT JOIN ro_placements rp ON rp.scholar_request_id = rsr.request_id
         LEFT JOIN return_of_obligations ro ON ro.ro_id = rp.ro_id
         LEFT JOIN students st ON st.student_id = ro.student_id
         WHERE ($1::text IS NULL OR rsr.request_status = $1)
           AND (
             $2::text = ''
             OR CONCAT_WS(
               ' ',
               rd.department_name,
               rsr.purpose,
               ap.first_name,
               ap.last_name
             ) ILIKE '%' || $2 || '%'
           )
         GROUP BY
           rsr.request_id,
           rd.department_name,
           ap.first_name,
           ap.last_name
         ORDER BY
           CASE rsr.request_status
             WHEN 'Pending' THEN 0
             WHEN 'Acknowledged' THEN 1
             ELSE 2
           END,
           rsr.created_at DESC`,
        [statusFilter, search]
    );

    const items = result.rows.map((row) => {
        const requested = Math.max(0, Number(row.requested_scholar_count || 0));
        const active = Math.max(0, Number(row.active_assignment_count || 0));
        const acknowledged = Math.max(0, Number(row.acknowledged_count || 0));
        return {
            ...row,
            active_assignment_count: active,
            acknowledged_count: acknowledged,
            awaiting_acknowledgment_count: Math.max(0, Number(row.awaiting_acknowledgment_count || 0)),
            concern_count: Math.max(0, Number(row.concern_count || 0)),
            remaining_assignment_count: Math.max(0, requested - active),
            remaining_confirmation_count: Math.max(0, requested - acknowledged),
            assignment_stage: getRequestAssignmentStage({
                requested_scholar_count: requested,
                active_assignment_count: active,
            }),
        };
    });

    return {
        items,
        pending_count: items.filter((item) => item.request_status === 'Pending').length,
    };
};

exports.updateScholarRequest = async (requestId, payload = {}, user = {}) => {
    const status = cleanText(payload.status || payload.requestStatus || payload.request_status);
    const remarks = cleanText(payload.remarks || payload.adminRemarks || payload.admin_remarks);
    const allowedStatuses = ['Declined'];

    if (!allowedStatuses.includes(status)) {
        throw createHttpError(400, 'RO scholar requests are fulfilled automatically from scholar acknowledgments. Admin may only decline an active request manually.');
    }
    if (status === 'Declined' && !remarks) {
        throw createHttpError(400, 'Admin remarks are required when declining a request.');
    }

    if (status === 'Declined') {
        const progress = await getScholarRequestProgress(requestId);
        if (progress.active_assignment_count > 0 || progress.concern_count > 0) {
            throw createHttpError(
                409,
                'This request already has linked scholar assignments. Resolve or cancel those placements instead of declining the request.'
            );
        }
    }

    const result = await db.query(
        `UPDATE ro_scholar_requests
         SET request_status = $1,
             admin_remarks = $2,
             handled_by_user_id = $3,
             handled_at = now(),
             updated_at = now()
         WHERE request_id = $4
           AND request_status IN ('Pending', 'Acknowledged')
         RETURNING *`,
        [status, remarks || null, getUserId(user), requestId]
    );

    if (!result.rows.length) {
        throw createHttpError(404, 'This active scholar request is unavailable.');
    }

    return {
        message: `Scholar request marked as ${status.toLowerCase()}.`,
        request: result.rows[0],
    };
};

exports.clearScholarRO = async (studentId, payload = {}, user = {}) => {
    const currentPeriod = await getCurrentAcademicPeriod();
    const application = await getApprovedApplicationForStudent(studentId, payload);
    const existingRO = await getROByApplication(
        studentId,
        application.application_id,
        currentPeriod.period_id
    );

    if (!existingRO?.ro_id) {
        throw createHttpError(409, 'Assign and complete the required RO workflow before clearing this scholar.');
    }

    const { data: clearanceLogs, error: clearanceLogsError } = await supabase
        .from('ro_time_logs')
        .select('log_id, log_status, duration_minutes, validated_minutes, validation_status, department_validation_status')
        .eq('ro_id', existingRO.ro_id);

    if (clearanceLogsError) {
        throw createHttpError(500, clearanceLogsError.message);
    }

    const completedLogs = (clearanceLogs || []).filter(
        (log) => log.log_status === 'Timed Out'
    );
    const departmentApprovedLogs = completedLogs.filter(
        (log) => log.department_validation_status === 'Approved'
    );
    const pendingDepartmentLogs = completedLogs.filter(
        (log) => !log.department_validation_status || log.department_validation_status === 'Pending'
    );
    const departmentValidatedMinutes = departmentApprovedLogs.reduce(
        (sum, log) => sum + toNumber(log.validated_minutes || log.duration_minutes),
        0
    );
    const requiredMinutes = toNumber(existingRO.required_hours) * 60;

    if (!completedLogs.length) {
        throw createHttpError(409, 'The scholar has no completed RO attendance logs to clear.');
    }

    // Returned evidence is intentionally excluded. The scholar may submit a
    // replacement log; the old returned record remains in the audit trail.
    if (pendingDepartmentLogs.length > 0) {
        throw createHttpError(409, 'The department head must decide all pending attendance evidence before OSFA can clear this scholar.');
    }

    if (requiredMinutes <= 0 || departmentValidatedMinutes < requiredMinutes) {
        throw createHttpError(
            409,
            `Department-validated time is incomplete (${departmentValidatedMinutes} of ${requiredMinutes} required minutes).`
        );
    }

    const now = new Date().toISOString();
    const adminUserId = getUserId(user);

    const updatePayload = {
        student_id: studentId,
        application_id: application.application_id,
        opening_id: application.opening_id || payload.openingId || payload.opening_id || null,
        program_id: application.program_id || payload.programId || payload.program_id || null,
        ro_status: 'Cleared',
        progress_status: 'Cleared',
        assignment_status: 'Cleared',
        cleared_by: adminUserId,
        cleared_at: now,
        remarks: cleanText(payload.remarks) || 'Marked as cleared by RO admin.',
        updated_at: now,
    };

    if (existingRO?.ro_id) {
        const { data, error } = await supabase
            .from('return_of_obligations')
            .update(updatePayload)
            .eq('ro_id', existingRO.ro_id)
            .select()
            .single();

        if (error) {
            throw createHttpError(500, error.message);
        }

        return {
            message: 'Student RO marked as cleared.',
            clearance: data,
        };
    }

    const activeRoSetting = await getActiveRoSettingForAssignments();

    const { data, error } = await supabase
        .from('return_of_obligations')
        .insert({
            ...updatePayload,
            required_hours: Math.max(
                0,
                toNumber(activeRoSetting.required_hours)
            ),
            setting_id: activeRoSetting?.setting_id || null,
            created_at: now,
        })
        .select()
        .single();

    if (error) {
        throw createHttpError(500, error.message);
    }

    return {
        message: 'Student RO marked as cleared.',
        clearance: data,
    };
};
