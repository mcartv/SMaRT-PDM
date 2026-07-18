const supabase = require('../config/supabase');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeValue(value) {
  return value == null ? '' : String(value).trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const rawValue = normalizeValue(value);
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
  const rawValue = normalizeValue(value);
  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);
  if (!storagePath) return rawValue;

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (error) return rawValue;

  return data?.signedUrl || rawValue;
}

async function getStudentByUserId(userId) {
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const { data, error } = await supabase
    .from('students')
    .select(`
      student_id,
      user_id,
      pdm_id,
      first_name,
      last_name,
      profile_photo_url,
      is_active_scholar,
      account_status,
      scholarship_status,
      course_id
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw createHttpError(404, 'Student profile not found.');
  }

  return data;
}

function ensureApprovedScholar(student) {
  if (student?.is_active_scholar !== true) {
    throw createHttpError(
      403,
      'Return of Obligation is only available for approved scholars.'
    );
  }
}

async function getActiveSetting() {
  const { data, error } = await supabase
    .from('ro_settings')
    .select(`
      setting_id,
      academic_year_id,
      period_id,
      required_hours,
      is_active,
      allow_carry_over,
      remarks,
      created_at,
      updated_at
    `)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      setting_id: null,
      required_hours: 20,
      is_active: true,
      allow_carry_over: true,
      remarks: 'Default RO setting',
    };
  }

  return (
    data || {
      setting_id: null,
      required_hours: 20,
      is_active: true,
      allow_carry_over: true,
      remarks: 'Default RO setting',
    }
  );
}

async function getRoRowsForStudent(studentId) {
  const { data, error } = await supabase
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
      validated_minutes
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

async function getRoRowForStudent(studentId, roId) {
  const { data, error } = await supabase
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
      validated_minutes
    `)
    .eq('ro_id', roId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

async function getProgramMap(programIds) {
  const ids = [...new Set(programIds.filter(Boolean))];

  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('scholarship_program')
    .select('program_id, program_name')
    .in('program_id', ids);

  if (error) throw error;

  return new Map((data || []).map((row) => [row.program_id, row]));
}

async function getOpeningMap(openingIds) {
  const ids = [...new Set(openingIds.filter(Boolean))];

  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('program_openings')
    .select('opening_id, opening_title')
    .in('opening_id', ids);

  if (error) throw error;

  return new Map((data || []).map((row) => [row.opening_id, row]));
}

async function getActiveLogByStudent(studentId) {
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
    .eq('student_id', studentId)
    .is('time_out_at', null)
    .eq('log_status', 'Timed In')
    .order('time_in_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

async function getLogsForRo(roId, studentId) {
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
    .eq('ro_id', roId)
    .eq('student_id', studentId)
    .order('time_in_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return data || [];
}

async function mapLog(row = {}) {
  return {
    logId: row.log_id?.toString() || '',
    roId: row.ro_id?.toString() || '',
    studentId: row.student_id?.toString() || '',
    timeInAt: row.time_in_at?.toString() || '',
    timeOutAt: row.time_out_at?.toString() || '',
    durationMinutes: toNumber(row.duration_minutes),
    logStatus: row.log_status?.toString() || 'Timed In',
    studentNote: row.student_note?.toString() || '',
    validatedMinutes: toNumber(row.validated_minutes),
    validationStatus: row.validation_status?.toString() || 'Pending Validation',
    validationRemarks: row.validation_remarks?.toString() || '',
    validatedBy: row.validated_by?.toString() || '',
    validatedAt: row.validated_at?.toString() || '',
    createdAt: row.created_at?.toString() || '',
    updatedAt: row.updated_at?.toString() || '',
  };
}

async function mapRO(row = {}, student = {}, setting = {}, programMap, openingMap) {
  const program = programMap.get(row.program_id) || {};
  const opening = openingMap.get(row.opening_id) || {};

  const requiredHours = toNumber(
    row.required_hours,
    toNumber(setting.required_hours, 0)
  );

  const requiredMinutes = requiredHours * 60;

  const submittedMinutes =
    toNumber(row.submitted_minutes) > 0
      ? toNumber(row.submitted_minutes)
      : toNumber(row.submitted_hours) * 60;

  const validatedMinutes =
    toNumber(row.validated_minutes) > 0
      ? toNumber(row.validated_minutes)
      : toNumber(row.validated_hours) * 60;

  const logs = await getLogsForRo(row.ro_id, student.student_id);

  const activeLog = logs.find(
    (item) => item.log_status === 'Timed In' && !item.time_out_at
  );

  const submittedProgress = percentFromMinutes(
    submittedMinutes,
    requiredMinutes
  );

  const validatedProgress = percentFromMinutes(
    validatedMinutes,
    requiredMinutes
  );

  const title =
    opening.opening_title?.toString() ||
    program.program_name?.toString() ||
    'Return of Obligation';

  return {
    id: row.ro_id?.toString() || '',
    roId: row.ro_id?.toString() || '',
    studentId: row.student_id?.toString() || '',
    applicationId: row.application_id?.toString() || '',
    openingId: row.opening_id?.toString() || '',
    programId: row.program_id?.toString() || '',

    title,
    programName: program.program_name?.toString() || '',
    openingTitle: opening.opening_title?.toString() || '',

    requiredHours,
    submittedHours: toNumber(row.submitted_hours),
    validatedHours: toNumber(row.validated_hours),
    requiredMinutes,
    submittedMinutes,
    validatedMinutes,
    submittedProgress,
    validatedProgress,

    status: row.ro_status?.toString() || 'Pending',
    roStatus: row.ro_status?.toString() || 'Pending',
    progressStatus: row.progress_status?.toString() || 'Not Started',
    progressNotes: row.progress_notes?.toString() || '',
    validationRemarks: row.validation_remarks?.toString() || '',
    remarks: row.remarks?.toString() || '',

    clearedAt: row.cleared_at?.toString() || '',
    submittedAt: row.submitted_at?.toString() || '',
    validatedAt: row.validated_at?.toString() || '',
    createdAt: row.created_at?.toString() || '',
    updatedAt: row.updated_at?.toString() || '',

    isCleared: row.ro_status === 'Cleared',
    hasActiveSession: Boolean(activeLog),

    activeLog: activeLog ? await mapLog(activeLog) : null,
    logs: await Promise.all(logs.map(mapLog)),

    student: {
      name:
        `${student.first_name || ''} ${student.last_name || ''}`.trim() ||
        'Scholar',
      studentNumber: student.pdm_id?.toString() || '',
      avatarUrl: await resolveAvatarUrl(student.profile_photo_url),
    },
  };
}

async function syncRoTotals(roId) {
  const { data: ro, error: roError } = await supabase
    .from('return_of_obligations')
    .select('ro_id, required_hours, ro_status')
    .eq('ro_id', roId)
    .maybeSingle();

  if (roError) throw roError;
  if (!ro) throw createHttpError(404, 'RO assignment not found.');

  const { data: logs, error: logsError } = await supabase
    .from('ro_time_logs')
    .select(`
      duration_minutes,
      validated_minutes,
      log_status,
      validation_status
    `)
    .eq('ro_id', roId);

  if (logsError) throw logsError;

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

  let progressStatus = 'Not Started';

  if (ro.ro_status === 'Cleared') {
    progressStatus = 'Cleared';
  } else if (submittedMinutes <= 0) {
    progressStatus = 'Not Started';
  } else if (requiredMinutes > 0 && submittedMinutes >= requiredMinutes) {
    progressStatus = 'For Validation';
  } else {
    progressStatus = 'In Progress';
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('return_of_obligations')
    .update({
      submitted_minutes: submittedMinutes,
      submitted_hours: minutesToHoursFloor(submittedMinutes),
      validated_minutes: validatedMinutes,
      validated_hours: minutesToHoursFloor(validatedMinutes),
      progress_status: progressStatus,
      submitted_at: submittedMinutes > 0 ? now : null,
      updated_at: now,
    })
    .eq('ro_id', roId);

  if (updateError) throw updateError;

  return {
    submittedMinutes,
    validatedMinutes,
    progressStatus,
  };
}

async function getMyAssignments(userId) {
  const student = await getStudentByUserId(userId);
  const setting = await getActiveSetting();

  if (student.is_active_scholar !== true) {
    return {
      shouldShowModule: false,
      isApprovedScholar: false,
      message: 'Return of Obligation is only available for approved scholars.',
      setting,
      items: [],
    };
  }

  const rows = await getRoRowsForStudent(student.student_id);

  const programMap = await getProgramMap(rows.map((row) => row.program_id));
  const openingMap = await getOpeningMap(rows.map((row) => row.opening_id));

  const items = await Promise.all(
    rows.map((row) => mapRO(row, student, setting, programMap, openingMap))
  );

  return {
    shouldShowModule: true,
    isApprovedScholar: true,
    setting,
    items,
  };
}

async function getOwnedRoOrThrow(userId, roId) {
  const student = await getStudentByUserId(userId);
  ensureApprovedScholar(student);

  const ro = await getRoRowForStudent(student.student_id, roId);

  if (!ro) {
    throw createHttpError(404, 'RO assignment not found.');
  }

  return {
    student,
    ro,
  };
}

async function timeInMyRo(userId, roId, body = {}) {
  const { student, ro } = await getOwnedRoOrThrow(userId, roId);

  if (ro.ro_status === 'Cleared') {
    throw createHttpError(400, 'This Return of Obligation is already cleared.');
  }

  const activeLog = await getActiveLogByStudent(student.student_id);

  if (activeLog) {
    throw createHttpError(409, 'You already have an active time-in session.');
  }

  const note = normalizeValue(body.studentNote || body.student_note);
  const now = new Date().toISOString();

  const { error: insertError } = await supabase
    .from('ro_time_logs')
    .insert({
      ro_id: ro.ro_id,
      student_id: student.student_id,
      student_note: note || null,
      log_status: 'Timed In',
      validation_status: 'Pending Validation',
    });

  if (insertError) {
    if (insertError.code === '23505') {
      throw createHttpError(409, 'You already have an active time-in session.');
    }

    throw insertError;
  }

  const { error: updateError } = await supabase
    .from('return_of_obligations')
    .update({
      progress_status:
        ro.progress_status === 'Not Started'
          ? 'In Progress'
          : ro.progress_status,
      updated_at: now,
    })
    .eq('ro_id', ro.ro_id);

  if (updateError) throw updateError;

  const result = await getMyAssignments(userId);

  return {
    ...result,
    message: 'Timed in successfully.',
    realtime: {
      action: 'time-in',
      ro_id: ro.ro_id,
      student_id: student.student_id,
    },
  };
}

async function timeOutMyRo(userId, roId, body = {}) {
  const { student, ro } = await getOwnedRoOrThrow(userId, roId);

  if (ro.ro_status === 'Cleared') {
    throw createHttpError(400, 'This Return of Obligation is already cleared.');
  }

  const activeLog = await getActiveLogByStudent(student.student_id);

  if (!activeLog || activeLog.ro_id !== ro.ro_id) {
    throw createHttpError(400, 'You do not have an active session for this RO.');
  }

  const now = new Date();
  const timeIn = new Date(activeLog.time_in_at);
  const diffMs = now.getTime() - timeIn.getTime();

  const durationMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const note = normalizeValue(body.studentNote || body.student_note);

  const updatePayload = {
    time_out_at: now.toISOString(),
    duration_minutes: durationMinutes,
    log_status: 'Timed Out',
    updated_at: now.toISOString(),
  };

  if (note) {
    updatePayload.student_note = note;
  }

  const { error: updateLogError } = await supabase
    .from('ro_time_logs')
    .update(updatePayload)
    .eq('log_id', activeLog.log_id);

  if (updateLogError) throw updateLogError;

  await syncRoTotals(ro.ro_id);

  const result = await getMyAssignments(userId);

  return {
    ...result,
    message: 'Timed out successfully. Your session is now pending validation.',
    realtime: {
      action: 'time-out',
      ro_id: ro.ro_id,
      student_id: student.student_id,
      log_id: activeLog.log_id,
      duration_minutes: durationMinutes,
    },
  };
}

async function submitMyCompletion(userId, roId, body = {}, file = null) {
  const { student, ro } = await getOwnedRoOrThrow(userId, roId);

  if (ro.ro_status === 'Cleared') {
    throw createHttpError(400, 'This Return of Obligation is already cleared.');
  }

  const now = new Date().toISOString();
  const progressNotes = normalizeValue(body.progress_notes || body.progressNotes);

  const { error } = await supabase
    .from('return_of_obligations')
    .update({
      progress_status: 'For Validation',
      progress_notes: progressNotes || ro.progress_notes || null,
      submitted_at: now,
      updated_at: now,
    })
    .eq('ro_id', ro.ro_id)
    .eq('student_id', student.student_id);

  if (error) throw error;

  await syncRoTotals(ro.ro_id);

  const result = await getMyAssignments(userId);

  return {
    ...result,
    message: 'RO progress submitted for validation.',
    realtime: {
      action: 'submit-progress',
      ro_id: ro.ro_id,
      student_id: student.student_id,
    },
  };
}

module.exports = {
  getMyAssignments,
  timeInMyRo,
  timeOutMyRo,
  submitMyCompletion,
};