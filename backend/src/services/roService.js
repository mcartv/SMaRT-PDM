const supabase = require('../config/supabase');
const notificationService = require('./notificationService');
const crypto = require('crypto');

const RO_PROOFS_BUCKET =
  process.env.RO_PROOFS_BUCKET ||
  'ro-proofs';

const AUTO_TIMEOUT_INTERVAL_MS = Number(
  process.env.RO_AUTO_TIMEOUT_INTERVAL_MS || 60000
);

let autoTimeoutTimer = null;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeValue(value) {
  return value == null
    ? ''
    : String(value).trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function percentFromMinutes(doneMinutes, requiredMinutes) {
  const done = toNumber(doneMinutes);
  const required = toNumber(requiredMinutes);

  if (required <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round((done / required) * 100)
    )
  );
}

function minutesBetween(startValue, endValue) {
  const startDate = new Date(startValue);
  const endDate = new Date(endValue);

  const diffMs =
    endDate.getTime() -
    startDate.getTime();

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    diffMs <= 0
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.floor(diffMs / 60000)
  );
}

function addMinutesToDate(value, minutes) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return new Date(
    date.getTime() +
    Math.max(0, Number(minutes || 0)) * 60000
  );
}

function extractAvatarStoragePath(value) {
  const rawValue = normalizeValue(value);

  if (!rawValue) {
    return null;
  }

  if (!/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(
      /^avatars\//,
      ''
    );
  }

  const markers = [
    '/storage/v1/object/public/avatars/',
    '/storage/v1/object/sign/avatars/',
    '/storage/v1/object/authenticated/avatars/',
  ];

  for (const marker of markers) {
    const markerIndex =
      rawValue.indexOf(marker);

    if (markerIndex >= 0) {
      return rawValue
        .slice(markerIndex + marker.length)
        .split('?')[0];
    }
  }

  return null;
}

function parseJsonField(value, fallback = {}) {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(String(value));
  } catch (_error) {
    return fallback;
  }
}

function cleanNumericOrNull(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

const SUPPORTED_RO_PROOF_MIME_TYPES =
  new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ]);

function detectMimeTypeFromFileName(originalName = '') {
  const name = String(originalName)
    .trim()
    .toLowerCase();

  if (name.endsWith('.png')) {
    return 'image/png';
  }

  if (name.endsWith('.webp')) {
    return 'image/webp';
  }

  if (
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg')
  ) {
    return 'image/jpeg';
  }

  return null;
}

function detectMimeTypeFromBuffer(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    return null;
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

function normalizeRoProofMimeType(file = {}) {
  const rawMime = String(file.mimetype || '')
    .trim()
    .toLowerCase();

  if (
    SUPPORTED_RO_PROOF_MIME_TYPES.has(
      rawMime
    )
  ) {
    return rawMime === 'image/jpg'
      ? 'image/jpeg'
      : rawMime;
  }

  const mimeFromBuffer =
    detectMimeTypeFromBuffer(file.buffer);

  if (mimeFromBuffer) {
    return mimeFromBuffer;
  }

  const mimeFromName =
    detectMimeTypeFromFileName(
      file.originalname
    );

  if (mimeFromName) {
    return mimeFromName;
  }

  throw createHttpError(
    400,
    [
      'Unsupported RO proof photo type.',
      'Allowed types are JPG, JPEG, PNG, and WEBP.',
      `Received MIME: ${rawMime || 'unknown'}.`,
    ].join(' ')
  );
}

function getRoProofExtensionFromMimeType(mimeType) {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function sanitizeFileName(fileName = '') {
  return String(fileName)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180);
}

async function removeStorageObjectQuietly(filePath) {
  if (!filePath) {
    return;
  }

  try {
    const { error } = await supabase.storage
      .from(RO_PROOFS_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error(
        'FAILED TO CLEAN UP RO PROOF FILE:',
        error.message
      );
    }
  } catch (error) {
    console.error(
      'FAILED TO CLEAN UP RO PROOF FILE:',
      error.message
    );
  }
}

async function saveRoTimeLogProof({
  logId,
  roId,
  studentId,
  proofType,
  body = {},
  file = null,
}) {
  if (
    !file ||
    !Buffer.isBuffer(file.buffer) ||
    file.buffer.length === 0
  ) {
    return null;
  }

  const now = new Date().toISOString();

  const mimeType =
    normalizeRoProofMimeType(file);

  const extension =
    getRoProofExtensionFromMimeType(
      mimeType
    );

  const random =
    crypto
      .randomBytes(8)
      .toString('hex');

  const rawOriginalName =
    sanitizeFileName(
      file.originalname || ''
    );

  const fileName =
    rawOriginalName &&
      /\.(jpg|jpeg|png|webp)$/i.test(rawOriginalName)
      ? rawOriginalName
      : `${proofType}-${Date.now()}.${extension}`;

  const filePath = [
    String(studentId),
    String(roId),
    String(logId),
    [
      proofType,
      Date.now(),
      random,
    ].join('-') + `.${extension}`,
  ].join('/');

  const photoHash =
    crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

  const { error: uploadError } =
    await supabase.storage
      .from(RO_PROOFS_BUCKET)
      .upload(
        filePath,
        file.buffer,
        {
          contentType: mimeType,
          upsert: false,
          cacheControl: '3600',
        }
      );

  if (uploadError) {
    throw createHttpError(
      500,
      `Failed to upload RO proof photo: ${uploadError.message}`
    );
  }

  const publicUrlResult =
    supabase.storage
      .from(RO_PROOFS_BUCKET)
      .getPublicUrl(filePath);

  const fileUrl =
    publicUrlResult?.data?.publicUrl ||
    filePath;

  const proofPayload = {
    log_id: logId,
    ro_id: roId,
    student_id: studentId,

    proof_type: proofType,

    file_url: fileUrl,
    file_path: filePath,
    file_name: fileName,
    mime_type: mimeType,

    file_size_bytes:
      file.size ||
      file.buffer.length,

    photo_sha256: photoHash,

    captured_at_device:
      body.captured_at_device ||
      body.capturedAtDevice ||
      null,

    captured_at_server: now,

    device_timezone:
      body.device_timezone ||
      body.deviceTimezone ||
      null,

    latitude:
      cleanNumericOrNull(
        body.latitude
      ),

    longitude:
      cleanNumericOrNull(
        body.longitude
      ),

    accuracy_meters:
      cleanNumericOrNull(
        body.accuracy_meters ||
        body.accuracyMeters
      ),

    altitude_meters:
      cleanNumericOrNull(
        body.altitude_meters ||
        body.altitudeMeters
      ),

    location_permission_status:
      body.location_permission_status ||
      body.locationPermissionStatus ||
      null,

    location_source:
      body.location_source ||
      body.locationSource ||
      'device_gps',

    device_info:
      parseJsonField(
        body.device_info ||
        body.deviceInfo,
        {}
      ),

    exif_metadata:
      parseJsonField(
        body.exif_metadata ||
        body.exifMetadata,
        {}
      ),

    proof_status: 'Pending Review',
  };

  const { data, error } =
    await supabase
      .from('ro_time_log_proofs')
      .insert(proofPayload)
      .select()
      .single();

  if (error) {
    await removeStorageObjectQuietly(
      filePath
    );

    throw createHttpError(
      500,
      `Failed to save RO proof record: ${error.message}`
    );
  }

  return data;
}

async function resolveAvatarUrl(value) {
  const rawValue =
    normalizeValue(value);

  if (!rawValue) {
    return null;
  }

  const storagePath =
    extractAvatarStoragePath(
      rawValue
    );

  if (!storagePath) {
    return rawValue;
  }

  const { data, error } =
    await supabase.storage
      .from('avatars')
      .createSignedUrl(
        storagePath,
        60 * 60 * 24 * 7
      );

  if (error) {
    return rawValue;
  }

  return data?.signedUrl || rawValue;
}

async function getStudentByUserId(userId) {
  if (!userId) {
    throw createHttpError(
      401,
      'Authentication required.'
    );
  }

  const { data, error } =
    await supabase
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

  if (error) {
    throw error;
  }

  if (!data) {
    throw createHttpError(
      404,
      'Student profile not found.'
    );
  }

  return data;
}

function ensureApprovedScholar(student) {
  if (
    student?.is_active_scholar !== true
  ) {
    throw createHttpError(
      403,
      'Return of Obligation is only available for approved scholars.'
    );
  }
}

async function getActiveSetting() {
  const { data, error } =
    await supabase
      .from('ro_settings')
      .select(`
        setting_id,
        required_hours,
        is_active,
        allow_carry_over,
        remarks,
        created_at,
        updated_at
      `)
      .eq('is_active', true)
      .order(
        'updated_at',
        { ascending: false }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      'GET ACTIVE RO SETTING ERROR:',
      error.message
    );

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

const RO_SELECT = `
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
  progress_status,
  submitted_minutes,
  validated_minutes,
  assigned_area,
  assignment_status,
  assignment_acknowledged_at,
  conflict_reason,
  assigned_by,
  assigned_at,
  submitted_progress,
  ro_progress
`;

const LOG_SELECT = `
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
  auto_timed_out,
  auto_timeout_reason,
  requires_admin_attention,
  created_at,
  updated_at
`;

async function getRoRowsForStudent(studentId) {
  const { data, error } =
    await supabase
      .from('return_of_obligations')
      .select(RO_SELECT)
      .eq('student_id', studentId)
      .order(
        'created_at',
        { ascending: false }
      );

  if (error) {
    throw error;
  }

  return data || [];
}

async function getRoRowForStudent(studentId, roId) {
  const { data, error } =
    await supabase
      .from('return_of_obligations')
      .select(RO_SELECT)
      .eq('ro_id', roId)
      .eq('student_id', studentId)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getProgramMap(programIds) {
  const ids = [
    ...new Set(
      programIds.filter(Boolean)
    ),
  ];

  if (!ids.length) {
    return new Map();
  }

  const { data, error } =
    await supabase
      .from('scholarship_program')
      .select(
        'program_id, program_name'
      )
      .in('program_id', ids);

  if (error) {
    throw error;
  }

  return new Map(
    (data || []).map((row) => [
      row.program_id,
      row,
    ])
  );
}

async function getOpeningMap(openingIds) {
  const ids = [
    ...new Set(
      openingIds.filter(Boolean)
    ),
  ];

  if (!ids.length) {
    return new Map();
  }

  const { data, error } =
    await supabase
      .from('program_openings')
      .select(
        'opening_id, opening_title'
      )
      .in('opening_id', ids);

  if (error) {
    throw error;
  }

  return new Map(
    (data || []).map((row) => [
      row.opening_id,
      row,
    ])
  );
}

async function getActiveLogByStudent(studentId) {
  const { data, error } =
    await supabase
      .from('ro_time_logs')
      .select(LOG_SELECT)
      .eq('student_id', studentId)
      .is('time_out_at', null)
      .eq('log_status', 'Timed In')
      .order(
        'time_in_at',
        { ascending: false }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getActiveLogForRo(studentId, roId) {
  const { data, error } =
    await supabase
      .from('ro_time_logs')
      .select(LOG_SELECT)
      .eq('student_id', studentId)
      .eq('ro_id', roId)
      .is('time_out_at', null)
      .eq('log_status', 'Timed In')
      .order('time_in_at', { ascending: false })
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getLatestLogForRo(studentId, roId) {
  const { data, error } =
    await supabase
      .from('ro_time_logs')
      .select(LOG_SELECT)
      .eq('student_id', studentId)
      .eq('ro_id', roId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function syncRoTotalsQuietly(roId) {
  try {
    if (!roId) return null;
    return await syncRoTotals(roId);
  } catch (error) {
    console.error('SYNC RO TOTALS QUIETLY ERROR:', error.message);
    return null;
  }
}

async function getLogsForRo(roId, studentId) {
  const { data, error } =
    await supabase
      .from('ro_time_logs')
      .select(LOG_SELECT)
      .eq('ro_id', roId)
      .eq('student_id', studentId)
      .order(
        'time_in_at',
        { ascending: false }
      )
      .limit(50);

  if (error) {
    throw error;
  }

  return data || [];
}

function mapLog(row = {}) {
  return {
    logId:
      row.log_id?.toString() || '',

    roId:
      row.ro_id?.toString() || '',

    studentId:
      row.student_id?.toString() ||
      '',

    timeInAt:
      row.time_in_at?.toString() ||
      '',

    timeOutAt:
      row.time_out_at?.toString() ||
      '',

    durationMinutes:
      toNumber(
        row.duration_minutes
      ),

    logStatus:
      row.log_status?.toString() ||
      'Timed In',

    studentNote:
      row.student_note?.toString() ||
      '',

    validatedMinutes:
      toNumber(
        row.validated_minutes
      ),

    validationStatus:
      row.validation_status?.toString() ||
      'Pending Validation',

    validationRemarks:
      row.validation_remarks?.toString() ||
      '',

    validatedBy:
      row.validated_by?.toString() ||
      '',

    validatedAt:
      row.validated_at?.toString() ||
      '',

    autoTimedOut:
      row.auto_timed_out === true,

    autoTimeoutReason:
      row.auto_timeout_reason?.toString() ||
      '',

    requiresAdminAttention:
      row.requires_admin_attention === true,

    createdAt:
      row.created_at?.toString() ||
      '',

    updatedAt:
      row.updated_at?.toString() ||
      '',
  };
}

async function mapRO(
  row = {},
  student = {},
  setting = {},
  programMap,
  openingMap
) {
  const program =
    programMap.get(row.program_id) || {};

  const opening =
    openingMap.get(row.opening_id) || {};

  const requiredHours =
    toNumber(
      row.required_hours,
      toNumber(
        setting.required_hours,
        0
      )
    );

  const requiredMinutes =
    requiredHours * 60;

  const submittedMinutes =
    toNumber(
      row.submitted_minutes
    );

  const validatedMinutes =
    toNumber(
      row.validated_minutes
    );

  const logs =
    await getLogsForRo(
      row.ro_id,
      student.student_id
    );

  const activeLog =
    logs.find(
      (item) =>
        item.log_status ===
        'Timed In' &&
        !item.time_out_at
    );

  const submittedProgress =
    row.submitted_progress != null
      ? toNumber(
        row.submitted_progress
      )
      : percentFromMinutes(
        submittedMinutes,
        requiredMinutes
      );

  const validatedProgress =
    row.ro_progress != null
      ? toNumber(
        row.ro_progress
      )
      : percentFromMinutes(
        validatedMinutes,
        requiredMinutes
      );

  const title =
    opening.opening_title?.toString() ||
    program.program_name?.toString() ||
    'Return of Obligation';

  return {
    id:
      row.ro_id?.toString() || '',

    roId:
      row.ro_id?.toString() || '',

    studentId:
      row.student_id?.toString() ||
      '',

    applicationId:
      row.application_id?.toString() ||
      '',

    openingId:
      row.opening_id?.toString() ||
      '',

    programId:
      row.program_id?.toString() ||
      '',

    title,

    programName:
      program.program_name?.toString() ||
      '',

    openingTitle:
      opening.opening_title?.toString() ||
      '',

    requiredHours,
    requiredMinutes,
    submittedMinutes,
    validatedMinutes,
    submittedProgress,
    validatedProgress,

    status:
      row.ro_status?.toString() ||
      'Pending',

    roStatus:
      row.ro_status?.toString() ||
      'Pending',

    progressStatus:
      row.progress_status?.toString() ||
      'Not Started',

    assignedArea:
      row.assigned_area?.toString() ||
      '',

    assignmentStatus:
      row.assignment_status?.toString() ||
      'Assigned',

    assignmentAcknowledgedAt:
      row.assignment_acknowledged_at
        ?.toString() || '',

    conflictReason:
      row.conflict_reason?.toString() ||
      '',

    remarks:
      row.remarks?.toString() || '',

    clearedAt:
      row.cleared_at?.toString() ||
      '',

    createdAt:
      row.created_at?.toString() ||
      '',

    updatedAt:
      row.updated_at?.toString() ||
      '',

    isCleared:
      row.ro_status === 'Cleared' ||
      row.assignment_status ===
      'Cleared',

    hasActiveSession:
      Boolean(activeLog),

    activeLog:
      activeLog
        ? mapLog(activeLog)
        : null,

    logs:
      logs.map(mapLog),

    student: {
      name:
        [
          student.first_name || '',
          student.last_name || '',
        ]
          .join(' ')
          .trim() ||
        'Scholar',

      studentNumber:
        student.pdm_id?.toString() ||
        '',

      avatarUrl:
        await resolveAvatarUrl(
          student.profile_photo_url
        ),
    },
  };
}

async function getSubmittedMinutesForRo(roId, excludeLogId = null) {
  const { data, error } =
    await supabase
      .from('ro_time_logs')
      .select(`
        log_id,
        duration_minutes,
        log_status,
        validation_status
      `)
      .eq('ro_id', roId);

  if (error) {
    throw error;
  }

  return (data || [])
    .filter((log) => {
      if (
        excludeLogId &&
        String(log.log_id) ===
        String(excludeLogId)
      ) {
        return false;
      }

      return (
        log.log_status === 'Timed Out' &&
        log.validation_status !== 'Rejected'
      );
    })
    .reduce(
      (sum, log) =>
        sum +
        toNumber(
          log.duration_minutes
        ),
      0
    );
}

async function getRemainingMinutesForRo(ro, excludeLogId = null) {
  const requiredMinutes =
    Math.max(
      0,
      toNumber(ro.required_hours) * 60
    );

  const submittedMinutes =
    await getSubmittedMinutesForRo(
      ro.ro_id,
      excludeLogId
    );

  return Math.max(
    0,
    requiredMinutes - submittedMinutes
  );
}

async function syncRoTotals(roId) {
  const { data: ro, error: roError } =
    await supabase
      .from('return_of_obligations')
      .select(
        'ro_id, required_hours, ro_status'
      )
      .eq('ro_id', roId)
      .maybeSingle();

  if (roError) {
    throw roError;
  }

  if (!ro) {
    throw createHttpError(
      404,
      'RO assignment not found.'
    );
  }

  const { data: logs, error: logsError } =
    await supabase
      .from('ro_time_logs')
      .select(`
        duration_minutes,
        validated_minutes,
        log_status,
        validation_status
      `)
      .eq('ro_id', roId);

  if (logsError) {
    throw logsError;
  }

  const submittedMinutes =
    (logs || [])
      .filter(
        (log) =>
          log.log_status === 'Timed Out' &&
          log.validation_status !== 'Rejected'
      )
      .reduce(
        (sum, log) =>
          sum + toNumber(log.duration_minutes),
        0
      );

  const validatedMinutes =
    (logs || [])
      .filter(
        (log) =>
          log.validation_status === 'Approved'
      )
      .reduce(
        (sum, log) =>
          sum + toNumber(log.validated_minutes),
        0
      );

  const requiredMinutes =
    toNumber(ro.required_hours) * 60;

  let progressStatus = 'Not Started';
  let assignmentStatus = null;

  if (ro.ro_status === 'Cleared') {
    progressStatus = 'Cleared';
    assignmentStatus = 'Cleared';
  } else if (submittedMinutes <= 0) {
    progressStatus = 'Not Started';
  } else if (
    requiredMinutes > 0 &&
    submittedMinutes >= requiredMinutes
  ) {
    progressStatus = 'For Validation';
    assignmentStatus = 'For Validation';
  } else {
    progressStatus = 'In Progress';
    assignmentStatus = 'In Progress';
  }

  const now = new Date().toISOString();

  const updatePayload = {
    submitted_minutes: submittedMinutes,
    validated_minutes: validatedMinutes,
    progress_status: progressStatus,
    updated_at: now,
  };

  if (assignmentStatus) {
    updatePayload.assignment_status = assignmentStatus;
  }

  const { data, error: updateError } =
    await supabase
      .from('return_of_obligations')
      .update(updatePayload)
      .eq('ro_id', roId)
      .select()
      .single();

  if (updateError) {
    throw updateError;
  }

  return data;
}

async function sendAutoTimeoutNotification({
  studentId,
  roId,
  durationMinutes,
}) {
  try {
    if (
      typeof notificationService?.createUserNotification !==
      'function'
    ) {
      return null;
    }

    const { data: student, error } =
      await supabase
        .from('students')
        .select('student_id, user_id')
        .eq('student_id', studentId)
        .maybeSingle();

    if (error || !student?.user_id) {
      return null;
    }

    return await notificationService.createUserNotification({
      userId: student.user_id,
      type: 'RO Auto Timeout',
      title: 'RO Session Auto Timed Out',
      message:
        `Your RO session was automatically timed out after reaching the required remaining time. Recorded time: ${durationMinutes} minute(s). The log is pending admin validation.`,
      referenceId: roId,
      referenceType: 'return_of_obligation',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      'RO AUTO TIMEOUT NOTIFICATION ERROR:',
      error.message
    );

    return null;
  }
}

async function getMyAssignments(userId) {
  const student =
    await getStudentByUserId(
      userId
    );

  const setting =
    await getActiveSetting();

  if (
    student.is_active_scholar !== true
  ) {
    return {
      shouldShowModule: false,
      isApprovedScholar: false,

      message:
        'Return of Obligation is only available for approved scholars.',

      setting,
      student,
      items: [],
    };
  }

  await autoTimeoutActiveLogsForStudent(
    student.student_id,
    null
  );

  const rowsBeforeSync =
    await getRoRowsForStudent(
      student.student_id
    );

  await Promise.all(
    rowsBeforeSync
      .filter((row) => row.ro_id)
      .map((row) => syncRoTotalsQuietly(row.ro_id))
  );

  const rows =
    await getRoRowsForStudent(
      student.student_id
    );

  const programMap =
    await getProgramMap(
      rows.map(
        (row) => row.program_id
      )
    );

  const openingMap =
    await getOpeningMap(
      rows.map(
        (row) => row.opening_id
      )
    );

  const items =
    await Promise.all(
      rows.map((row) =>
        mapRO(
          row,
          student,
          setting,
          programMap,
          openingMap
        )
      )
    );

  return {
    shouldShowModule: true,
    isApprovedScholar: true,
    setting,
    student,
    items,
  };
}

async function getOwnedRoOrThrow(
  userId,
  roId
) {
  const student =
    await getStudentByUserId(
      userId
    );

  ensureApprovedScholar(student);

  const ro =
    await getRoRowForStudent(
      student.student_id,
      roId
    );

  if (!ro) {
    throw createHttpError(
      404,
      'RO assignment not found.'
    );
  }

  return {
    student,
    ro,
  };
}

async function acknowledgeMyRo(
  userId,
  roId
) {
  const {
    student,
    ro,
  } = await getOwnedRoOrThrow(
    userId,
    roId
  );

  if (
    ro.ro_status === 'Cleared' ||
    ro.assignment_status ===
    'Cleared'
  ) {
    throw createHttpError(
      400,
      'This RO assignment is already cleared.'
    );
  }

  if (
    ro.assignment_status ===
    'Conflict Reported'
  ) {
    throw createHttpError(
      400,
      'This RO assignment has a reported concern and cannot be acknowledged yet.'
    );
  }

  if (
    ro.assignment_status !==
    'Assigned'
  ) {
    throw createHttpError(
      400,
      'This RO assignment has already been acknowledged.'
    );
  }

  const now =
    new Date().toISOString();

  const { error } =
    await supabase
      .from('return_of_obligations')
      .update({
        assignment_status:
          'Acknowledged',

        assignment_acknowledged_at:
          now,

        progress_status:
          'Not Started',

        conflict_reason: null,
        updated_at: now,
      })
      .eq('ro_id', ro.ro_id)
      .eq(
        'student_id',
        student.student_id
      );

  if (error) {
    throw error;
  }

  const result =
    await getMyAssignments(
      userId
    );

  return {
    ...result,

    message:
      'RO assignment acknowledged.',

    realtime: {
      action: 'acknowledge',
      ro_id: ro.ro_id,
      student_id:
        student.student_id,
    },
  };
}

async function reportMyRoConflict(
  userId,
  roId,
  body = {}
) {
  const {
    student,
    ro,
  } = await getOwnedRoOrThrow(
    userId,
    roId
  );

  if (
    ro.ro_status === 'Cleared' ||
    ro.assignment_status ===
    'Cleared'
  ) {
    throw createHttpError(
      400,
      'This RO assignment is already cleared.'
    );
  }

  const reason =
    normalizeValue(
      body.reason ||
      body.conflictReason
    );

  if (!reason) {
    throw createHttpError(
      400,
      'Please provide a reason for the concern.'
    );
  }

  const now =
    new Date().toISOString();

  const { error } =
    await supabase
      .from('return_of_obligations')
      .update({
        assignment_status:
          'Conflict Reported',

        conflict_reason:
          reason,

        progress_status:
          'Revision Needed',

        updated_at: now,
      })
      .eq('ro_id', ro.ro_id)
      .eq(
        'student_id',
        student.student_id
      );

  if (error) {
    throw error;
  }

  const result =
    await getMyAssignments(
      userId
    );

  return {
    ...result,

    message:
      'RO concern submitted.',

    realtime: {
      action: 'conflict',
      ro_id: ro.ro_id,
      student_id:
        student.student_id,
    },
  };
}

async function timeInMyRo(
  userId,
  roId,
  body = {},
  file = null
) {
  if (
    file &&
    file.buffer &&
    file.buffer.length
  ) {
    normalizeRoProofMimeType(file);
  }

  const {
    student,
    ro,
  } = await getOwnedRoOrThrow(
    userId,
    roId
  );

  if (
    ro.ro_status === 'Cleared' ||
    ro.assignment_status ===
    'Cleared'
  ) {
    throw createHttpError(
      400,
      'This Return of Obligation is already cleared.'
    );
  }

  const activeLogForThisRo =
    await getActiveLogForRo(
      student.student_id,
      ro.ro_id
    );

  if (activeLogForThisRo) {
    const result =
      await getMyAssignments(
        userId
      );

    return {
      ...result,
      message:
        'You already have an active time-in session for this RO.',
      alreadyTimedIn: true,
      activeLog: mapLog(activeLogForThisRo),
      realtime: {
        action: 'refresh',
        ro_id: ro.ro_id,
        student_id: student.student_id,
        log_id: activeLogForThisRo.log_id,
      },
    };
  }

  const activeLog =
    await getActiveLogByStudent(
      student.student_id
    );

  if (activeLog) {
    throw createHttpError(
      409,
      'You already have an active time-in session.'
    );
  }

  const remainingMinutes =
    await getRemainingMinutesForRo(
      ro
    );

  if (remainingMinutes <= 0) {
    await syncRoTotalsQuietly(ro.ro_id);

    const result =
      await getMyAssignments(
        userId
      );

    return {
      ...result,
      message:
        'The required RO hours have already been submitted for validation.',
      alreadySubmittedForValidation: true,
      realtime: {
        action: 'refresh',
        ro_id: ro.ro_id,
        student_id: student.student_id,
      },
    };
  }

  const note =
    normalizeValue(
      body.studentNote ||
      body.student_note ||
      body.note
    );

  const now =
    new Date().toISOString();

  const {
    data: insertedLog,
    error: insertError,
  } = await supabase
    .from('ro_time_logs')
    .insert({
      ro_id: ro.ro_id,

      student_id:
        student.student_id,

      student_note:
        note || null,

      time_in_at: now,

      log_status:
        'Timed In',

      validation_status:
        'Pending Validation',

      auto_timed_out:
        false,

      auto_timeout_reason:
        null,

      requires_admin_attention:
        false,
    })
    .select()
    .single();

  if (insertError) {
    if (
      insertError.code === '23505'
    ) {
      throw createHttpError(
        409,
        'You already have an active time-in session.'
      );
    }

    throw insertError;
  }

  let proof = null;

  try {
    proof =
      await saveRoTimeLogProof({
        logId:
          insertedLog.log_id,

        roId:
          ro.ro_id,

        studentId:
          student.student_id,

        proofType:
          'time_in',

        body,
        file,
      });
  } catch (error) {
    const { error: cleanupError } =
      await supabase
        .from('ro_time_logs')
        .delete()
        .eq(
          'log_id',
          insertedLog.log_id
        );

    if (cleanupError) {
      console.error(
        'FAILED TO ROLLBACK RO TIME-IN LOG:',
        cleanupError.message
      );
    }

    throw error;
  }

  const { error: updateError } =
    await supabase
      .from('return_of_obligations')
      .update({
        progress_status:
          'In Progress',

        assignment_status:
          'In Progress',

        updated_at: now,
      })
      .eq('ro_id', ro.ro_id);

  if (updateError) {
    throw updateError;
  }

  const result =
    await getMyAssignments(
      userId
    );

  return {
    ...result,

    message:
      proof
        ? 'Timed in successfully. Photo proof uploaded.'
        : 'Timed in successfully.',

    proof,

    realtime: {
      action: 'time-in',
      ro_id: ro.ro_id,

      student_id:
        student.student_id,

      log_id:
        insertedLog.log_id,

      has_proof:
        Boolean(proof),
    },
  };
}

async function timeOutMyRo(
  userId,
  roId,
  body = {},
  file = null
) {
  if (
    file &&
    file.buffer &&
    file.buffer.length
  ) {
    normalizeRoProofMimeType(file);
  }

  const {
    student,
    ro,
  } = await getOwnedRoOrThrow(
    userId,
    roId
  );

  if (
    ro.ro_status === 'Cleared' ||
    ro.assignment_status ===
    'Cleared'
  ) {
    throw createHttpError(
      400,
      'This Return of Obligation is already cleared.'
    );
  }

  const activeLog =
    await getActiveLogForRo(
      student.student_id,
      ro.ro_id
    );

  if (!activeLog) {
    await syncRoTotalsQuietly(ro.ro_id);

    const latestLog =
      await getLatestLogForRo(
        student.student_id,
        ro.ro_id
      );

    const result =
      await getMyAssignments(
        userId
      );

    return {
      ...result,
      message: latestLog?.time_out_at
        ? 'This RO session was already timed out. The latest record has been refreshed.'
        : 'No active time-in session was found for this RO.',
      alreadyTimedOut:
        Boolean(latestLog?.time_out_at),
      latestLog:
        latestLog ? mapLog(latestLog) : null,
      realtime: {
        action: 'refresh',
        ro_id: ro.ro_id,
        student_id: student.student_id,
        log_id: latestLog?.log_id || null,
        already_timed_out:
          Boolean(latestLog?.time_out_at),
      },
    };
  }

  const remainingMinutes =
    await getRemainingMinutesForRo(
      ro,
      activeLog.log_id
    );

  const now = new Date();

  const actualDurationMinutes =
    minutesBetween(
      activeLog.time_in_at,
      now
    );

  const cappedDurationMinutes =
    remainingMinutes <= 0
      ? 0
      : Math.min(
        actualDurationMinutes,
        remainingMinutes
      );

  const wasCapped =
    actualDurationMinutes >
    cappedDurationMinutes ||
    remainingMinutes <= 0;

  const cappedTimeOutAt =
    cappedDurationMinutes <= 0
      ? now
      : wasCapped
        ? addMinutesToDate(
          activeLog.time_in_at,
          cappedDurationMinutes
        )
        : now;

  const note =
    normalizeValue(
      body.studentNote ||
      body.student_note ||
      body.note
    );

  const proof =
    await saveRoTimeLogProof({
      logId:
        activeLog.log_id,

      roId:
        ro.ro_id,

      studentId:
        student.student_id,

      proofType:
        'time_out',

      body,
      file,
    });

  const updatePayload = {
    time_out_at:
      cappedTimeOutAt.toISOString(),

    duration_minutes:
      cappedDurationMinutes,

    log_status:
      'Timed Out',

    validation_status:
      'Pending Validation',

    auto_timed_out:
      wasCapped,

    auto_timeout_reason:
      wasCapped
        ? 'Required RO hours reached. Extra elapsed time was not counted.'
        : null,

    requires_admin_attention:
      wasCapped,

    updated_at:
      new Date().toISOString(),
  };

  if (note) {
    updatePayload.student_note =
      note;
  }

  const {
    data: updatedLog,
    error: updateLogError,
  } = await supabase
    .from('ro_time_logs')
    .update(updatePayload)
    .eq(
      'log_id',
      activeLog.log_id
    )
    .select()
    .single();

  if (updateLogError) {
    if (proof?.file_path) {
      await removeStorageObjectQuietly(
        proof.file_path
      );

      const {
        error: proofDeleteError,
      } = await supabase
        .from(
          'ro_time_log_proofs'
        )
        .delete()
        .eq(
          'proof_id',
          proof.proof_id
        );

      if (proofDeleteError) {
        console.error(
          'FAILED TO ROLLBACK TIME-OUT PROOF RECORD:',
          proofDeleteError.message
        );
      }
    }

    throw updateLogError;
  }

  await syncRoTotals(
    ro.ro_id
  );

  if (wasCapped) {
    await sendAutoTimeoutNotification({
      studentId:
        student.student_id,

      roId:
        ro.ro_id,

      durationMinutes:
        cappedDurationMinutes,
    });
  }

  const result =
    await getMyAssignments(
      userId
    );

  return {
    ...result,

    message:
      wasCapped
        ? `Timed out successfully. Only ${cappedDurationMinutes} minute(s) were recorded because the required RO time was already reached.`
        : proof
          ? 'Timed out successfully. Photo proof uploaded and your session is pending validation.'
          : 'Timed out successfully. Your session is now pending validation.',

    log: updatedLog,
    proof,

    realtime: {
      action: 'time-out',

      ro_id:
        ro.ro_id,

      student_id:
        student.student_id,

      log_id:
        activeLog.log_id,

      duration_minutes:
        cappedDurationMinutes,

      actual_duration_minutes:
        actualDurationMinutes,

      auto_timed_out:
        wasCapped,

      has_proof:
        Boolean(proof),
    },
  };
}

async function submitMyCompletion(
  userId,
  roId,
  body = {},
  file = null
) {
  if (
    file &&
    file.buffer &&
    file.buffer.length
  ) {
    normalizeRoProofMimeType(file);
  }

  const {
    student,
    ro,
  } = await getOwnedRoOrThrow(
    userId,
    roId
  );

  if (
    ro.ro_status === 'Cleared' ||
    ro.assignment_status ===
    'Cleared'
  ) {
    throw createHttpError(
      400,
      'This Return of Obligation is already cleared.'
    );
  }

  const now =
    new Date().toISOString();

  const remarks =
    normalizeValue(
      body.remarks ||
      body.progressNotes ||
      body.progress_notes
    );

  let completionProof = null;

  if (
    file &&
    file.buffer &&
    file.buffer.length
  ) {
    const { data: latestLog, error: latestLogError } =
      await supabase
        .from('ro_time_logs')
        .select(
          'log_id, ro_id, student_id'
        )
        .eq('ro_id', ro.ro_id)
        .eq(
          'student_id',
          student.student_id
        )
        .order(
          'created_at',
          { ascending: false }
        )
        .limit(1)
        .maybeSingle();

    if (latestLogError) {
      throw latestLogError;
    }

    if (!latestLog) {
      throw createHttpError(
        400,
        'A time log is required before uploading a completion proof.'
      );
    }

    completionProof =
      await saveRoTimeLogProof({
        logId:
          latestLog.log_id,

        roId:
          ro.ro_id,

        studentId:
          student.student_id,

        proofType:
          'completion',

        body,
        file,
      });
  }

  const updatePayload = {
    progress_status:
      'For Validation',

    assignment_status:
      'For Validation',

    updated_at: now,
  };

  if (remarks) {
    updatePayload.remarks =
      remarks;
  }

  const { error } =
    await supabase
      .from('return_of_obligations')
      .update(updatePayload)
      .eq('ro_id', ro.ro_id)
      .eq(
        'student_id',
        student.student_id
      );

  if (error) {
    if (
      completionProof?.file_path
    ) {
      await removeStorageObjectQuietly(
        completionProof.file_path
      );

      if (
        completionProof.proof_id
      ) {
        const {
          error: proofDeleteError,
        } = await supabase
          .from(
            'ro_time_log_proofs'
          )
          .delete()
          .eq(
            'proof_id',
            completionProof.proof_id
          );

        if (proofDeleteError) {
          console.error(
            'FAILED TO ROLLBACK COMPLETION PROOF:',
            proofDeleteError.message
          );
        }
      }
    }

    throw error;
  }

  await syncRoTotals(
    ro.ro_id
  );

  const result =
    await getMyAssignments(
      userId
    );

  return {
    ...result,

    message:
      completionProof
        ? 'RO progress and completion proof submitted for validation.'
        : 'RO progress submitted for validation.',

    proof:
      completionProof,

    realtime: {
      action:
        'submit-progress',

      ro_id:
        ro.ro_id,

      student_id:
        student.student_id,

      has_proof:
        Boolean(
          completionProof
        ),
    },
  };
}

async function autoTimeoutSingleActiveLog(activeLog, ro, io = null) {
  const remainingMinutes =
    await getRemainingMinutesForRo(
      ro,
      activeLog.log_id
    );

  const now = new Date();

  const actualElapsedMinutes =
    minutesBetween(
      activeLog.time_in_at,
      now
    );

  if (
    remainingMinutes > 0 &&
    actualElapsedMinutes <
    remainingMinutes
  ) {
    return null;
  }

  const durationMinutes =
    remainingMinutes <= 0
      ? 0
      : remainingMinutes;

  const cappedTimeOutAt =
    durationMinutes <= 0
      ? now
      : addMinutesToDate(
        activeLog.time_in_at,
        durationMinutes
      );

  const updatePayload = {
    time_out_at:
      cappedTimeOutAt.toISOString(),

    duration_minutes:
      durationMinutes,

    log_status:
      'Timed Out',

    validation_status:
      'Pending Validation',

    auto_timed_out:
      true,

    auto_timeout_reason:
      durationMinutes <= 0
        ? 'Required RO hours were already submitted. Session auto timed out with no additional counted time.'
        : 'Required RO hours reached. Session auto timed out.',

    requires_admin_attention:
      true,

    updated_at:
      new Date().toISOString(),
  };

  const { data: updatedLog, error } =
    await supabase
      .from('ro_time_logs')
      .update(updatePayload)
      .eq(
        'log_id',
        activeLog.log_id
      )
      .is('time_out_at', null)
      .select()
      .single();

  if (error) {
    console.error(
      'RO AUTO TIMEOUT UPDATE ERROR:',
      error.message
    );

    return null;
  }

  const updatedRo =
    await syncRoTotals(
      ro.ro_id
    );

  await sendAutoTimeoutNotification({
    studentId:
      activeLog.student_id,

    roId:
      ro.ro_id,

    durationMinutes,
  });

  const realtime = {
    source:
      'mobile-backend-auto-timeout',

    action:
      'auto-timeout',

    updated_at:
      new Date().toISOString(),

    ro_id:
      ro.ro_id,

    student_id:
      activeLog.student_id,

    log_id:
      activeLog.log_id,

    duration_minutes:
      durationMinutes,

    actual_elapsed_minutes:
      actualElapsedMinutes,

    auto_timed_out:
      true,

    data: {
      log: updatedLog,
      ro: updatedRo,
    },
  };

  if (io) {
    io.emit('ro:updated', realtime);
    io.emit('roUpdated', realtime);
    io.emit('ro:time-log-updated', realtime);
  }

  return {
    log: updatedLog,
    ro: updatedRo,
    realtime,
  };
}

async function autoTimeoutActiveLogsForStudent(studentId, io = null) {
  const { data: activeLogs, error } =
    await supabase
      .from('ro_time_logs')
      .select(`
        log_id,
        ro_id,
        student_id,
        time_in_at,
        time_out_at,
        duration_minutes,
        log_status
      `)
      .eq('student_id', studentId)
      .is('time_out_at', null)
      .eq('log_status', 'Timed In');

  if (error) {
    console.error(
      'RO AUTO TIMEOUT STUDENT QUERY ERROR:',
      error.message
    );

    return [];
  }

  const results = [];

  for (const activeLog of activeLogs || []) {
    const { data: ro, error: roError } =
      await supabase
        .from('return_of_obligations')
        .select(RO_SELECT)
        .eq('ro_id', activeLog.ro_id)
        .maybeSingle();

    if (roError || !ro) {
      continue;
    }

    const result =
      await autoTimeoutSingleActiveLog(
        activeLog,
        ro,
        io
      );

    if (result) {
      results.push(result);
    }
  }

  return results;
}

async function runAutoTimeoutSweep(io = null) {
  const { data: activeLogs, error } =
    await supabase
      .from('ro_time_logs')
      .select(`
        log_id,
        ro_id,
        student_id,
        time_in_at,
        time_out_at,
        duration_minutes,
        log_status
      `)
      .is('time_out_at', null)
      .eq('log_status', 'Timed In')
      .order(
        'time_in_at',
        { ascending: true }
      )
      .limit(100);

  if (error) {
    console.error(
      'RO AUTO TIMEOUT SWEEP QUERY ERROR:',
      error.message
    );

    return {
      checked: 0,
      timed_out: 0,
      error: error.message,
    };
  }

  let timedOut = 0;

  for (const activeLog of activeLogs || []) {
    try {
      const { data: ro, error: roError } =
        await supabase
          .from('return_of_obligations')
          .select(RO_SELECT)
          .eq('ro_id', activeLog.ro_id)
          .maybeSingle();

      if (roError || !ro) {
        continue;
      }

      const result =
        await autoTimeoutSingleActiveLog(
          activeLog,
          ro,
          io
        );

      if (result) {
        timedOut += 1;
      }
    } catch (error) {
      console.error(
        'RO AUTO TIMEOUT ITEM ERROR:',
        error.message
      );
    }
  }

  return {
    checked:
      activeLogs?.length || 0,

    timed_out:
      timedOut,
  };
}

function startAutoTimeoutWorker(io = null) {
  if (autoTimeoutTimer) {
    return autoTimeoutTimer;
  }

  console.log(
    `[RO Auto Timeout] Worker started. Interval: ${AUTO_TIMEOUT_INTERVAL_MS}ms`
  );

  runAutoTimeoutSweep(io).catch((error) => {
    console.error(
      'RO AUTO TIMEOUT INITIAL SWEEP ERROR:',
      error.message
    );
  });

  autoTimeoutTimer = setInterval(() => {
    runAutoTimeoutSweep(io).catch((error) => {
      console.error(
        'RO AUTO TIMEOUT SWEEP ERROR:',
        error.message
      );
    });
  }, AUTO_TIMEOUT_INTERVAL_MS);

  return autoTimeoutTimer;
}

function stopAutoTimeoutWorker() {
  if (!autoTimeoutTimer) {
    return;
  }

  clearInterval(autoTimeoutTimer);
  autoTimeoutTimer = null;
}

module.exports = {
  getMyAssignments,
  acknowledgeMyRo,
  reportMyRoConflict,
  timeInMyRo,
  timeOutMyRo,
  submitMyCompletion,
  runAutoTimeoutSweep,
  startAutoTimeoutWorker,
  stopAutoTimeoutWorker,
};