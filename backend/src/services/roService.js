const supabase = require('../config/supabase');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeValue(value) {
  return value == null ? '' : String(value).trim();
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
  if (!storagePath) {
    return rawValue;
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (error) {
    return rawValue;
  }

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
      updated_at,
      academic_years (
        academic_year_id,
        label,
        start_year,
        end_year
      ),
      academic_period (
        period_id,
        term
      )
    `)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return (
    data || {
      setting_id: null,
      required_hours: 20,
      is_active: true,
      allow_carry_over: true,
      remarks: 'Default RO setting',
      academic_years: null,
      academic_period: null,
    }
  );
}

function computeStatus(row = {}) {
  const currentStatus = normalizeValue(row.ro_status) || 'Pending';
  const deadline = row.deadline_date ? new Date(row.deadline_date) : null;

  if (
    currentStatus.toLowerCase() === 'pending' &&
    deadline &&
    deadline.getTime() < Date.now()
  ) {
    return 'Overdue';
  }

  return currentStatus;
}

async function mapRO(row = {}, fallbackRequiredHours = 20) {
  return {
    id: row.ro_id?.toString() || '',
    scholarId: row.scholar_id?.toString() || row.student_id?.toString() || '',
    studentId: row.student_id?.toString() || row.scholar_id?.toString() || '',
    title:
      row.department_assigned
        ? `${row.department_assigned} Assignment`
        : 'Research Opportunity Assignment',
    department: row.department_assigned?.toString() || 'Unassigned',
    supervisor: row.assigned_by_name?.toString() || 'OSFA / Scholarship Office',
    startDate: row.assigned_at?.toString() || '',
    endDate: row.deadline_date?.toString() || '',
    hoursPerWeek: null,
    requiredHours: Number(row.required_hours || fallbackRequiredHours || 0),
    hoursLogged: Number(row.rendered_hours || 0),
    status: computeStatus(row),
    description: row.task_description?.toString() || '',
    proofUrl: row.proof_file_url?.toString() || '',
    submittedAt: row.submitted_at?.toString() || '',
    verifiedAt: row.verified_at?.toString() || '',
    rejectionReason: row.rejection_reason?.toString() || '',
    isCarryOver: row.is_carry_over == true,
    previousSemester: row.previous_semester?.toString() || '',
    student: {
      'name': row.student_name?.toString() || 'Scholar',
      'studentNumber': row.student_number?.toString() || '',
      'program': row.program_name?.toString() || 'Scholar',
      'avatarUrl': await resolveAvatarUrl(row.profile_photo_url),
    },
  };
}

async function getMyAssignments(userId) {
  const student = await getStudentByUserId(userId);
  const setting = await getActiveSetting();

  const { data, error } = await supabase
    .from('return_of_obligations')
    .select(`
      ro_id,
      scholar_id,
      student_id,
      program_id,
      department_assigned,
      task_description,
      required_hours,
      rendered_hours,
      ro_status,
      deadline_date,
      proof_file_url,
      rejection_reason,
      is_carry_over,
      previous_semester,
      submitted_at,
      verified_at,
      assigned_at,
      students!return_of_obligations_student_id_fkey (
        student_id,
        pdm_id,
        first_name,
        last_name,
        profile_photo_url
      ),
      scholarship_program (
        program_name
      )
    `)
    .or(`student_id.eq.${student.student_id},scholar_id.eq.${student.student_id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const items = await Promise.all(
    (data || []).map((row) =>
      mapRO(
        {
          ...row,
          student_name: row.students
            ? `${row.students.first_name || ''} ${row.students.last_name || ''}`.trim()
            : `${student.first_name || ''} ${student.last_name || ''}`.trim(),
          student_number: row.students?.pdm_id || student.pdm_id || '',
          program_name: row.scholarship_program?.program_name || 'Scholar',
          profile_photo_url:
            row.students?.profile_photo_url || student.profile_photo_url || '',
        },
        setting.required_hours
      )
    )
  );

  return {
    setting,
    items,
  };
}

async function submitMyCompletion(userId, roId, body = {}, file = null) {
  const student = await getStudentByUserId(userId);

  const { data: existing, error: existingError } = await supabase
    .from('return_of_obligations')
    .select(`
      ro_id,
      scholar_id,
      student_id,
      task_description,
      required_hours,
      rendered_hours,
      ro_status,
      proof_file_url,
      submitted_at
    `)
    .eq('ro_id', roId)
    .or(`student_id.eq.${student.student_id},scholar_id.eq.${student.student_id}`)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing) {
    throw createHttpError(404, 'RO assignment not found.');
  }

  const renderedHours = Number(body.rendered_hours ?? body.renderedHours ?? existing.rendered_hours ?? 0);
  if (!Number.isFinite(renderedHours) || renderedHours < 0) {
    throw createHttpError(400, 'Rendered hours must be a valid non-negative number.');
  }

  let proofUrl = existing.proof_file_url || '';

  if (file?.buffer && file.originalname) {
    const safeFileName = String(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `ro-completions/${roId}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    proofUrl = publicUrlData?.publicUrl || proofUrl;
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('return_of_obligations')
    .update({
      rendered_hours: renderedHours,
      proof_file_url: proofUrl || null,
      submitted_at: now,
      ro_status: 'Pending',
      updated_at: now,
    })
    .eq('ro_id', roId);

  if (updateError) throw updateError;

  return getMyAssignments(userId);
}

module.exports = {
  getMyAssignments,
  submitMyCompletion,
};
