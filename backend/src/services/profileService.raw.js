// Extracted student/profile helpers
async function resolveStudentByUserId(userId) {
  const { data: studentRecord, error } = await supabase
    .from('students')
    .select(`
      student_id,
      user_id,
      pdm_id,
      first_name,
      middle_name,
      last_name,
      year_level,
      course_id,
      profile_photo_url
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return studentRecord || null;
}

async function loadStudentProfileContextByUserId(userId) {
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('user_id, username, email, phone_number, role, is_otp_verified')
    .eq('user_id', userId)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  if (!userRecord) {
    return null;
  }

  const studentRecord = await resolveStudentByUserId(userId);
  let profileRecord = null;
  let courseRecord = null;

  if (studentRecord?.student_id) {
    const [
      studentProfileResult,
      courseLookupResult,
    ] = await Promise.all([
      supabase
        .from('student_profiles')
        .select(`
          student_id,
          date_of_birth,
          place_of_birth,
          sex,
          civil_status,
          maiden_name,
          religion,
          citizenship,
          street_address,
          subdivision,
          city,
          province,
          zip_code,
          landline_number,
          learners_reference_number
        `)
        .eq('student_id', studentRecord.student_id)
        .maybeSingle(),
      studentRecord.course_id
        ? supabase
          .from('academic_course')
          .select('course_id, course_code')
          .eq('course_id', studentRecord.course_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (studentProfileResult.error) {
      throw studentProfileResult.error;
    }

    if (courseLookupResult.error) {
      throw courseLookupResult.error;
    }

    profileRecord = studentProfileResult.data || null;
    courseRecord = courseLookupResult.data || null;
  }

  return {
    user: userRecord,
    student: studentRecord,
    student_profile: profileRecord,
    course: courseRecord,
  };
}

async function buildMyProfileResponse(context = {}) {
  const user = context.user || {};
  const student = context.student || {};
  const profile = context.student_profile || {};
  const course = context.course || {};
  const registrarStudent = await resolveRegistrarStudentByStudentNumber(
    student.pdm_id || user.username || ''
  );
  const avatarUrl = await resolveAvatarUrl(student.profile_photo_url ?? null);
  const eligibility = await resolveStudentEligibilityByStudentNumber(
    student.pdm_id || user.username || ''
  );
  const registrarCourse = !course?.course_id && registrarStudent?.course_id
    ? await resolveCourseById(registrarStudent.course_id)
    : course;

  return {
    profile: {
      user_id: user.user_id ?? null,
      student_id: student.pdm_id || user.username || null,
      first_name: student.first_name ?? registrarStudent?.first_name ?? null,
      middle_name: student.middle_name ?? registrarStudent?.middle_name ?? null,
      last_name: student.last_name ?? registrarStudent?.last_name ?? null,
      year_level: student.year_level ?? registrarStudent?.year_level ?? null,
      email: user.email ?? registrarStudent?.email_address ?? null,
      phone_number: user.phone_number ?? registrarStudent?.phone_number ?? null,
      avatar_url: avatarUrl,
      course_code: course.course_code ?? registrarCourse?.course_code ?? null,
      date_of_birth: profile.date_of_birth ?? null,
      place_of_birth: profile.place_of_birth ?? null,
      sex: profile.sex ?? registrarStudent?.sex_at_birth ?? null,
      civil_status: profile.civil_status ?? null,
      maiden_name: profile.maiden_name ?? null,
      religion: profile.religion ?? null,
      citizenship: profile.citizenship ?? null,
      street_address: profile.street_address ?? null,
      subdivision: profile.subdivision ?? null,
      city: profile.city ?? null,
      province: profile.province ?? null,
      zip_code: profile.zip_code ?? null,
      landline_number: profile.landline_number ?? null,
      learners_reference_number:
        profile.learners_reference_number ??
        registrarStudent?.learners_reference_number ??
        null,
      has_scholar_access: eligibility.hasScholarAccess,
      has_application: eligibility.hasApplication,
      eligibility_status: eligibility.status,
      is_pdm_student: eligibility.isRegistrarMatch,
    },
  };
}

const SUPPORT_TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

