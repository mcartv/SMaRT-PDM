const supabase = require('../config/supabase');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = safeText(value);
    if (text) return text;
  }
  return '';
}

async function getMyProfile(userId) {
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('user_id, username, email, phone_number, role, is_otp_verified')
    .eq('user_id', userId)
    .maybeSingle();

  if (userError) throw userError;

  if (!user) {
    throw createHttpError(404, 'User account not found.');
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      student_id,
      master_student_id,
      user_id,
      pdm_id,
      registrar_student_number,
      learners_reference_number,
      course_id,
      first_name,
      middle_name,
      last_name,
      year_level,
      gwa,
      sex_at_birth,
      email_address,
      phone_number,
      profile_photo_url,
      account_status,
      sdo_status,
      is_profile_complete,
      is_active_scholar,
      scholarship_status
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (studentError) throw studentError;

  if (!student) {
    return {
      profile: {
        user_id: user.user_id,
        student_uuid: null,
        student_id: user.username,
        pdm_id: user.username,
        first_name: '',
        middle_name: '',
        last_name: '',
        full_name: '',
        course_id: null,
        course_code: '',
        course_name: '',
        year_level: null,
        gwa: null,
        sex: '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        date_of_birth: null,
        civil_status: '',
        street_address: '',
        subdivision: '',
        barangay: '',
        city: '',
        province: '',
        zip_code: '',
        avatar_url: null,
        account_status: '',
        sdo_status: '',
        is_profile_complete: false,
        has_scholar_access: false,
      },
    };
  }

  const [masterResult, profileResult, courseResult] = await Promise.all([
    student.master_student_id
      ? supabase
        .from('student_master_records')
        .select(`
            master_student_id,
            student_number,
            pdm_id,
            learners_reference_number,
            first_name,
            middle_name,
            last_name,
            sex_at_birth,
            email_address,
            phone_number,
            course_id,
            year_level,
            sequence_number,
            source_registry,
            is_active,
            is_archived
          `)
        .eq('master_student_id', student.master_student_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    supabase
      .from('student_profiles')
      .select(`
        profile_id,
        student_id,
        date_of_birth,
        place_of_birth,
        civil_status,
        maiden_name,
        religion,
        citizenship,
        street_address,
        subdivision,
        barangay,
        city,
        province,
        zip_code,
        landline_number,
        financial_support_type,
        financial_support_other,
        has_prior_scholarship,
        prior_scholarship_details,
        has_disciplinary_record,
        disciplinary_details,
        self_description,
        aims_and_ambitions
      `)
      .eq('student_id', student.student_id)
      .maybeSingle(),

    student.course_id
      ? supabase
        .from('academic_course')
        .select('course_id, course_code, course_name')
        .eq('course_id', student.course_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (masterResult.error) throw masterResult.error;
  if (profileResult.error) throw profileResult.error;
  if (courseResult.error) throw courseResult.error;

  const master = masterResult.data || {};
  const profile = profileResult.data || {};
  let course = courseResult.data || null;

  const effectiveCourseId =
    master.course_id || student.course_id || null;

  if (!course && effectiveCourseId) {
    const { data: fallbackCourse, error: fallbackCourseError } = await supabase
      .from('academic_course')
      .select('course_id, course_code, course_name')
      .eq('course_id', effectiveCourseId)
      .maybeSingle();

    if (fallbackCourseError) throw fallbackCourseError;
    course = fallbackCourse || null;
  }

  const firstName = firstNonEmpty(master.first_name, student.first_name);
  const middleName = firstNonEmpty(master.middle_name, student.middle_name);
  const lastName = firstNonEmpty(master.last_name, student.last_name);

  const fullName = [firstName, middleName, lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const hasScholarAccess =
    student.is_active_scholar === true ||
    String(student.scholarship_status || '').toLowerCase() === 'active';

  return {
    profile: {
      user_id: user.user_id,
      student_uuid: student.student_id,

      student_id: firstNonEmpty(
        student.pdm_id,
        student.registrar_student_number,
        master.student_number,
        master.pdm_id,
        user.username
      ),

      pdm_id: firstNonEmpty(
        student.pdm_id,
        master.pdm_id,
        master.student_number,
        user.username
      ),

      registrar_student_number: firstNonEmpty(
        student.registrar_student_number,
        master.student_number
      ),

      learners_reference_number: firstNonEmpty(
        student.learners_reference_number,
        master.learners_reference_number
      ),

      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      full_name: fullName,

      course_id: effectiveCourseId,
      course_code: course?.course_code || '',
      course_name: course?.course_name || '',

      year_level: master.year_level || student.year_level || null,
      gwa: student.gwa || null,

      sex: firstNonEmpty(student.sex_at_birth, master.sex_at_birth),
      sex_at_birth: firstNonEmpty(student.sex_at_birth, master.sex_at_birth),

      email: firstNonEmpty(
        master.email_address,
        student.email_address,
        user.email
      ),

      phone_number: firstNonEmpty(
        master.phone_number,
        student.phone_number,
        user.phone_number
      ),

      avatar_url: student.profile_photo_url || null,

      date_of_birth: profile.date_of_birth || null,
      place_of_birth: profile.place_of_birth || '',
      civil_status: profile.civil_status || '',
      maiden_name: profile.maiden_name || '',
      religion: profile.religion || '',
      citizenship: profile.citizenship || 'Filipino',

      street_address: profile.street_address || '',
      subdivision: profile.subdivision || '',
      barangay: profile.barangay || '',
      city: profile.city || '',
      province: profile.province || '',
      zip_code: profile.zip_code || '',
      landline_number: profile.landline_number || '',

      financial_support_type: profile.financial_support_type || '',
      financial_support_other: profile.financial_support_other || '',
      has_prior_scholarship: profile.has_prior_scholarship || false,
      prior_scholarship_details: profile.prior_scholarship_details || '',
      has_disciplinary_record: profile.has_disciplinary_record || false,
      disciplinary_details: profile.disciplinary_details || '',
      self_description: profile.self_description || '',
      aims_and_ambitions: profile.aims_and_ambitions || '',

      account_status: student.account_status || '',
      sdo_status: student.sdo_status || '',
      is_profile_complete: student.is_profile_complete || false,
      has_scholar_access: hasScholarAccess,
      scholarship_status: student.scholarship_status || 'None',
    },
  };
}

async function updateMyProfile(userId, payload = {}) {
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id, user_id, course_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (studentError) throw studentError;

  if (!student) {
    throw createHttpError(404, 'No student profile is linked to this account.');
  }

  const email = safeText(payload.email);
  const phoneNumber = safeText(payload.phone_number);

  if (email) {
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        email,
        phone_number: phoneNumber || null,
      })
      .eq('user_id', userId);

    if (userUpdateError) throw userUpdateError;
  }

  let courseId = payload.course_id || null;

  if (!courseId && payload.course_code) {
    const { data: course, error: courseError } = await supabase
      .from('academic_course')
      .select('course_id')
      .eq('course_code', safeText(payload.course_code))
      .maybeSingle();

    if (courseError) throw courseError;
    courseId = course?.course_id || null;
  }

  const studentUpdate = {
    first_name: safeText(payload.first_name),
    middle_name: safeText(payload.middle_name) || null,
    last_name: safeText(payload.last_name),
    year_level: payload.year_level ? Number(payload.year_level) : null,
    sex_at_birth: safeText(payload.sex || payload.sex_at_birth) || null,
    email_address: email || null,
    phone_number: phoneNumber || null,
    is_profile_complete: true,
  };

  if (courseId) {
    studentUpdate.course_id = courseId;
  }

  Object.keys(studentUpdate).forEach((key) => {
    if (studentUpdate[key] === '') {
      studentUpdate[key] = null;
    }
  });

  const { error: updateStudentError } = await supabase
    .from('students')
    .update(studentUpdate)
    .eq('student_id', student.student_id);

  if (updateStudentError) throw updateStudentError;

  const profilePayload = {
    student_id: student.student_id,
    date_of_birth: safeText(payload.date_of_birth) || null,
    place_of_birth: safeText(payload.place_of_birth) || null,
    civil_status: safeText(payload.civil_status) || null,
    maiden_name: safeText(payload.maiden_name) || null,
    religion: safeText(payload.religion) || null,
    citizenship: safeText(payload.citizenship) || 'Filipino',
    street_address: safeText(payload.street_address) || null,
    subdivision: safeText(payload.subdivision) || null,
    barangay: safeText(payload.barangay) || null,
    city: safeText(payload.city) || null,
    province: safeText(payload.province) || null,
    zip_code: safeText(payload.zip_code) || null,
    landline_number: safeText(payload.landline_number) || null,
    financial_support_type: safeText(payload.financial_support_type) || null,
    financial_support_other: safeText(payload.financial_support_other) || null,
    has_prior_scholarship: payload.has_prior_scholarship === true,
    prior_scholarship_details:
      safeText(payload.prior_scholarship_details) || null,
    has_disciplinary_record: payload.has_disciplinary_record === true,
    disciplinary_details: safeText(payload.disciplinary_details) || null,
    self_description: safeText(payload.self_description) || null,
    aims_and_ambitions: safeText(payload.aims_and_ambitions) || null,
  };

  const { error: upsertProfileError } = await supabase
    .from('student_profiles')
    .upsert(profilePayload, {
      onConflict: 'student_id',
    });

  if (upsertProfileError) throw upsertProfileError;

  return getMyProfile(userId);
}

module.exports = {
  getMyProfile,
  updateMyProfile,
};