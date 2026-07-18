const supabase = require('../config/supabase');
const notificationService = require('./notificationService');

const APPROVED_APPLICATION_STATUSES = ['Approved', 'Approved Scholar', 'Accepted'];

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

function minutesToHoursFloor(minutes) {
    return Math.floor(toNumber(minutes) / 60);
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

function getUserId(user = {}) {
    return user?.userId || user?.user_id || user?.id || user?.sub || null;
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

    if (payload.applicationId) {
        query = query.eq('application_id', payload.applicationId);
    }

    if (payload.openingId) {
        query = query.eq('opening_id', payload.openingId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw createHttpError(500, error.message);

    if (!data) {
        throw createHttpError(404, 'Approved scholarship application not found for this student.');
    }

    return data;
}

async function getROByApplication(studentId, applicationId) {
    const { data, error } = await supabase
        .from('return_of_obligations')
        .select('*')
        .eq('student_id', studentId)
        .eq('application_id', applicationId)
        .maybeSingle();

    if (error) throw createHttpError(500, error.message);

    return data || null;
}

async function getLogsForROIds(roIds) {
    const ids = [...new Set(roIds.filter(Boolean))];

    if (!ids.length) return new Map();

    const { data, error } = await supabase
        .from('ro_time_logs')
        .select(`
      log_id,
      ro_id,
      student_id,
      time_in_at,
      time_out_at,
      duration_minutes,
      log_status,
      student_note,
      validated_minutes,
      validation_status,
      validation_remarks,
      validated_by,
      validated_at,
      created_at,
      updated_at
    `)
        .in('ro_id', ids)
        .order('time_in_at', { ascending: false });

    if (error) throw createHttpError(500, error.message);

    const map = new Map();

    for (const log of data || []) {
        const current = map.get(log.ro_id) || [];
        current.push(log);
        map.set(log.ro_id, current);
    }

    return map;
}

function serializeLog(log = {}) {
    return {
        log_id: log.log_id,
        logId: log.log_id,
        ro_id: log.ro_id,
        roId: log.ro_id,
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
        validated_by: log.validated_by || null,
        validatedBy: log.validated_by || null,
        validated_at: log.validated_at || null,
        validatedAt: log.validated_at || null,
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

    if (roError) throw createHttpError(500, roError.message);
    if (!ro) throw createHttpError(404, 'RO record not found.');

    const { data: logs, error: logsError } = await supabase
        .from('ro_time_logs')
        .select('duration_minutes, validated_minutes, log_status, validation_status')
        .eq('ro_id', roId);

    if (logsError) throw createHttpError(500, logsError.message);

    const submittedMinutes = (logs || [])
        .filter((log) => log.log_status === 'Timed Out' && log.validation_status !== 'Rejected')
        .reduce((sum, log) => sum + toNumber(log.duration_minutes), 0);

    const validatedMinutes = (logs || [])
        .filter((log) => log.validation_status === 'Approved')
        .reduce((sum, log) => sum + toNumber(log.validated_minutes), 0);

    const requiredMinutes = toNumber(ro.required_hours) * 60;
    const shouldClear = requiredMinutes > 0 && validatedMinutes >= requiredMinutes;
    const now = new Date().toISOString();
    const adminUserId = getUserId(user);

    let progressStatus = 'Not Started';

    if (shouldClear || ro.ro_status === 'Cleared') {
        progressStatus = 'Cleared';
    } else if (submittedMinutes <= 0) {
        progressStatus = 'Not Started';
    } else if (requiredMinutes > 0 && submittedMinutes >= requiredMinutes) {
        progressStatus = 'For Validation';
    } else {
        progressStatus = 'In Progress';
    }

    const updatePayload = {
        submitted_minutes: submittedMinutes,
        submitted_hours: minutesToHoursFloor(submittedMinutes),
        validated_minutes: validatedMinutes,
        validated_hours: minutesToHoursFloor(validatedMinutes),
        progress_status: progressStatus,
        assignment_status: progressStatus === 'Cleared' ? 'Cleared' : progressStatus,
        updated_at: now,
    };

    if (submittedMinutes > 0) {
        updatePayload.submitted_at = now;
    }

    if (shouldClear) {
        updatePayload.ro_status = 'Cleared';
        updatePayload.cleared_at = now;
        updatePayload.cleared_by = adminUserId || null;
    }

    const { data, error } = await supabase
        .from('return_of_obligations')
        .update(updatePayload)
        .eq('ro_id', roId)
        .select()
        .single();

    if (error) throw createHttpError(500, error.message);

    return data;
}

async function resolveAssignedDepartmentName(value) {
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

    return data.department_name;
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
    assignedTask,
}) {
    try {
        if (!student?.user_id || typeof notificationService?.createUserNotification !== 'function') {
            return null;
        }

        const message = [
            `You have been assigned a Return of Obligation task at ${assignedArea}.`,
            assignedTask ? `Task: ${assignedTask}` : null,
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

exports.getSummary = async () => {
    const [{ data: roRows, error: roError }, { data: logs, error: logError }] =
        await Promise.all([
            supabase
                .from('return_of_obligations')
                .select('ro_status, assignment_status, progress_status'),
            supabase
                .from('ro_time_logs')
                .select('validation_status')
                .eq('validation_status', 'Pending Validation'),
        ]);

    if (roError) throw createHttpError(500, roError.message);
    if (logError) throw createHttpError(500, logError.message);

    const summary = {
        assigned: 0,
        acknowledged: 0,
        conflict: 0,
        inProgress: 0,
        forValidation: 0,
        cleared: 0,
        pendingLogs: logs?.length || 0,
        total: roRows?.length || 0,
    };

    for (const row of roRows || []) {
        const assignmentStatus = row.assignment_status || 'Assigned';
        const progressStatus = row.progress_status || '';

        if (row.ro_status === 'Cleared' || assignmentStatus === 'Cleared') summary.cleared += 1;
        else if (assignmentStatus === 'Conflict Reported') summary.conflict += 1;
        else if (assignmentStatus === 'Acknowledged') summary.acknowledged += 1;
        else if (assignmentStatus === 'Assigned') summary.assigned += 1;
        else if (progressStatus === 'For Validation') summary.forValidation += 1;
        else if (progressStatus === 'In Progress') summary.inProgress += 1;
    }

    return summary;
};

exports.getROScholars = async (filters = {}) => {
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

    const { data: applications, error: applicationError } = await applicationQuery;

    if (applicationError) throw createHttpError(500, applicationError.message);

    const approvedApplications = applications || [];

    if (!approvedApplications.length) return [];

    const studentIds = [...new Set(approvedApplications.map((app) => app.student_id).filter(Boolean))];

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

    if (studentError) throw createHttpError(500, studentError.message);

    const filteredStudents = students || [];

    if (!filteredStudents.length) return [];

    const studentMap = new Map(filteredStudents.map((student) => [student.student_id, student]));
    const finalApplications = approvedApplications.filter((app) => studentMap.has(app.student_id));

    if (!finalApplications.length) return [];

    const courseIds = [...new Set(filteredStudents.map((s) => s.course_id).filter(Boolean))];
    const programIds = [...new Set(finalApplications.map((a) => a.program_id).filter(Boolean))];
    const openingIds = [...new Set(finalApplications.map((a) => a.opening_id).filter(Boolean))];
    const applicationIds = [...new Set(finalApplications.map((a) => a.application_id).filter(Boolean))];

    const [courseResult, programResult, openingResult, roResult] = await Promise.all([
        courseIds.length
            ? supabase.from('academic_course').select('course_id, course_code, course_name').in('course_id', courseIds)
            : Promise.resolve({ data: [], error: null }),

        programIds.length
            ? supabase.from('scholarship_program').select('program_id, program_name, benefactor_id').in('program_id', programIds)
            : Promise.resolve({ data: [], error: null }),

        openingIds.length
            ? supabase.from('program_openings').select('opening_id, opening_title, posting_status').in('opening_id', openingIds)
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
            ro_status,
            cleared_at,
            cleared_by,
            remarks,
            created_at,
            updated_at,
            setting_id,
            required_hours,
            submitted_hours,
            validated_hours,
            progress_status,
            progress_notes,
            validation_remarks,
            submitted_at,
            validated_at,
            submitted_progress,
            ro_progress,
            submitted_minutes,
            validated_minutes,
            assigned_area,
            assigned_task,
            assigned_location,
            assigned_schedule,
            assignment_status,
            assignment_acknowledged_at,
            conflict_reason,
            assigned_by,
            assigned_at
          `)
                .in('application_id', applicationIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (courseResult.error) throw createHttpError(500, courseResult.error.message);
    if (programResult.error) throw createHttpError(500, programResult.error.message);
    if (openingResult.error) throw createHttpError(500, openingResult.error.message);
    if (roResult.error) throw createHttpError(500, roResult.error.message);

    const programs = programResult.data || [];
    const benefactorIds = [...new Set(programs.map((program) => program.benefactor_id).filter(Boolean))];

    const { data: benefactors, error: benefactorError } = benefactorIds.length
        ? await supabase.from('benefactors').select('benefactor_id, benefactor_name').in('benefactor_id', benefactorIds)
        : { data: [], error: null };

    if (benefactorError) throw createHttpError(500, benefactorError.message);

    const courseMap = new Map((courseResult.data || []).map((course) => [course.course_id, course]));
    const programMap = new Map(programs.map((program) => [program.program_id, program]));
    const benefactorMap = new Map((benefactors || []).map((benefactor) => [benefactor.benefactor_id, benefactor]));
    const openingMap = new Map((openingResult.data || []).map((opening) => [opening.opening_id, opening]));

    const roRows = roResult.data || [];
    const roByApplication = new Map();

    for (const ro of roRows) {
        if (ro.application_id) roByApplication.set(ro.application_id, ro);
    }

    const logsByRo = await getLogsForROIds(roRows.map((row) => row.ro_id));

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

            const serializedLogs = logs.map(serializeLog);
            const pendingLogs = serializedLogs.filter((log) => log.validationStatus === 'Pending Validation');
            const activeLog = serializedLogs.find((log) => log.logStatus === 'Timed In' && !log.timeOutAt);

            const name = fullName(student) || 'Unknown Scholar';
            const cleared = !!ro && isClearedStatus(ro.ro_status);

            const requiredHours = toNumber(ro?.required_hours);
            const requiredMinutes = requiredHours * 60;
            const submittedMinutes =
                toNumber(ro?.submitted_minutes) > 0
                    ? toNumber(ro?.submitted_minutes)
                    : toNumber(ro?.submitted_hours) * 60;
            const validatedMinutes =
                toNumber(ro?.validated_minutes) > 0
                    ? toNumber(ro?.validated_minutes)
                    : toNumber(ro?.validated_hours) * 60;

            const assignmentStatus = cleared
                ? 'Cleared'
                : ro?.assignment_status || 'Unassigned';

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
                submitted_progress: percentFromMinutes(submittedMinutes, requiredMinutes),
                submittedProgress: percentFromMinutes(submittedMinutes, requiredMinutes),
                ro_progress: percentFromMinutes(validatedMinutes, requiredMinutes),
                validatedProgress: percentFromMinutes(validatedMinutes, requiredMinutes),

                progress_status: cleared ? 'Cleared' : ro?.progress_status || 'Not Started',
                progressStatus: cleared ? 'Cleared' : ro?.progress_status || 'Not Started',

                assigned_area: ro?.assigned_area || '',
                assignedArea: ro?.assigned_area || '',
                assigned_task: ro?.assigned_task || '',
                assignedTask: ro?.assigned_task || '',
                assigned_location: ro?.assigned_location || '',
                assignedLocation: ro?.assigned_location || '',
                assigned_schedule: ro?.assigned_schedule || '',
                assignedSchedule: ro?.assigned_schedule || '',
                assignment_status: assignmentStatus,
                assignmentStatus,
                assignment_acknowledged_at: ro?.assignment_acknowledged_at || null,
                assignmentAcknowledgedAt: ro?.assignment_acknowledged_at || null,
                conflict_reason: ro?.conflict_reason || '',
                conflictReason: ro?.conflict_reason || '',
                assigned_at: ro?.assigned_at || null,
                assignedAt: ro?.assigned_at || null,

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
                    row.assigned_task,
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
            if (status === 'in_progress') return progressStatus === 'in progress' || assignmentStatus === 'in progress';
            if (status === 'for_validation') return progressStatus === 'for validation' || row.pending_log_count > 0;

            return true;
        });
    }

    return finalRows;
};

async function getActiveRoSettingForAssignments() {
    const { data, error } = await supabase
        .from('ro_settings')
        .select('setting_id, required_hours, allow_carry_over, is_active')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, error.message);
    }

    return data || {
        setting_id: null,
        required_hours: 20,
        allow_carry_over: true,
        is_active: true,
    };
}

exports.assignScholarRO = async (studentId, payload = {}, user = {}) => {
    const application = await getApprovedApplicationForStudent(studentId, payload);
    const existingRO = await getROByApplication(studentId, application.application_id);
    const student = await getStudentForRoNotice(studentId);
    const activeRoSetting = await getActiveRoSettingForAssignments();

    if (existingRO?.ro_status === 'Cleared') {
        throw createHttpError(400, 'This scholar already has a cleared RO record.');
    }

    const now = new Date().toISOString();
    const adminUserId = getUserId(user);

    const assignedDepartmentName = await resolveAssignedDepartmentName(
        payload.assignedArea || payload.assigned_area
    );

    const requiredHours = Math.max(
        0,
        toNumber(activeRoSetting?.required_hours ?? 20)
    );

    const assignmentPayload = {
        student_id: studentId,
        application_id: application.application_id,
        opening_id: application.opening_id || payload.openingId || null,
        program_id: application.program_id || payload.programId || null,

        ro_status: 'Pending',
        required_hours: requiredHours,

        assigned_area: assignedDepartmentName,
        assigned_task: null,
        assigned_location: null,
        assigned_schedule: null,
        remarks: cleanText(payload.remarks) || null,

        assignment_status: 'Assigned',
        assignment_acknowledged_at: null,
        conflict_reason: null,
        assigned_by: adminUserId,
        assigned_at: now,
        updated_at: now,
    };

    let assignment;

    if (existingRO?.ro_id) {
        const { data, error } = await supabase
            .from('return_of_obligations')
            .update(assignmentPayload)
            .eq('ro_id', existingRO.ro_id)
            .select()
            .single();

        if (error) {
            throw createHttpError(500, error.message);
        }

        assignment = data;
    } else {
        const { data, error } = await supabase
            .from('return_of_obligations')
            .insert({
                ...assignmentPayload,
                setting_id: activeRoSetting?.setting_id || null,
                created_at: now,
            })
            .select()
            .single();

        if (error) {
            throw createHttpError(500, error.message);
        }

        assignment = data;
    }

    const notification = await sendRoAssignmentNotification({
        student,
        roId: assignment.ro_id,
        assignedArea: assignedDepartmentName,
        assignedTask: null,
    });

    return {
        message: existingRO?.ro_id
            ? 'RO assignment updated and notice sent to scholar.'
            : 'RO assignment created and notice sent to scholar.',
        assignment,
        notification,
    };
};

exports.batchAssignScholarsRO = async (payload = {}, user = {}) => {
    const rawStudentIds = payload.studentIds || payload.student_ids || [];

    if (!Array.isArray(rawStudentIds) || rawStudentIds.length === 0) {
        throw createHttpError(400, 'At least one scholar must be selected.');
    }

    const studentIds = [...new Set(rawStudentIds.map((id) => String(id).trim()).filter(Boolean))];

    if (studentIds.length > 100) {
        throw createHttpError(400, 'Batch assignment is limited to 100 scholars at a time.');
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
                ? 'Batch RO assignment completed successfully.'
                : 'Batch RO assignment completed with some failed records.',
        total: studentIds.length,
        success_count: successful.length,
        failed_count: failed.length,
        successful,
        failed,
    };
};

exports.validateTimeLog = async (logId, payload = {}, user = {}) => {
    if (!logId) {
        throw createHttpError(400, 'Time log ID is required.');
    }

    const validationStatus = cleanText(payload.validationStatus || payload.validation_status);

    if (!['Approved', 'Rejected'].includes(validationStatus)) {
        throw createHttpError(400, 'Validation status must be Approved or Rejected.');
    }

    const { data: existingLog, error: existingError } = await supabase
        .from('ro_time_logs')
        .select('*')
        .eq('log_id', logId)
        .maybeSingle();

    if (existingError) throw createHttpError(500, existingError.message);
    if (!existingLog) throw createHttpError(404, 'Time log not found.');

    const durationMinutes = toNumber(existingLog.duration_minutes);
    const requestedValidatedMinutes = toNumber(
        payload.validatedMinutes ?? payload.validated_minutes ?? durationMinutes
    );

    const validatedMinutes =
        validationStatus === 'Approved'
            ? Math.min(durationMinutes, Math.max(0, requestedValidatedMinutes))
            : 0;

    const now = new Date().toISOString();
    const adminUserId = getUserId(user);

    const { data: log, error: updateError } = await supabase
        .from('ro_time_logs')
        .update({
            validation_status: validationStatus,
            validated_minutes: validatedMinutes,
            validation_remarks: cleanText(payload.remarks || payload.validationRemarks || payload.validation_remarks) || null,
            validated_by: adminUserId,
            validated_at: now,
            updated_at: now,
        })
        .eq('log_id', logId)
        .select()
        .single();

    if (updateError) throw createHttpError(500, updateError.message);

    const ro = await syncRoTotals(existingLog.ro_id, user);

    return {
        message: `Time log ${validationStatus.toLowerCase()}.`,
        log,
        ro,
    };
};

exports.clearScholarRO = async (studentId, payload = {}, user = {}) => {
    const application = await getApprovedApplicationForStudent(studentId, payload);
    const existingRO = await getROByApplication(studentId, application.application_id);

    const now = new Date().toISOString();
    const adminUserId = getUserId(user);

    const updatePayload = {
        student_id: studentId,
        application_id: application.application_id,
        opening_id: application.opening_id || payload.openingId || null,
        program_id: application.program_id || payload.programId || null,
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

        if (error) throw createHttpError(500, error.message);

        return {
            message: 'Student RO marked as cleared.',
            clearance: data,
        };
    }

    const { data, error } = await supabase
        .from('return_of_obligations')
        .insert({
            ...updatePayload,
            required_hours: Math.max(0, toNumber(payload.requiredHours ?? payload.required_hours ?? 20)),
            created_at: now,
        })
        .select()
        .single();

    if (error) throw createHttpError(500, error.message);

    return {
        message: 'Student RO marked as cleared.',
        clearance: data,
    };
};