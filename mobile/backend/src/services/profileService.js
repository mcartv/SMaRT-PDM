const supabase = require('../config/supabase');
const notificationService = require('./notificationService');
const {
  AVATAR_BUCKET,
  ensureAvatarBucketExists,
  resolveAvatarUrl,
} = require('./avatarService');
const { validateProfilePhoto } = require('../utils/profilePhotoValidation');
const {
  optimizeImageForStorage,
} = require('./storageImageOptimizer');
const { validateEmail } = require('../utils/emailValidation');

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

async function getLatestAvatarReview(studentId) {
  if (!studentId) return null;

  const { data, error } = await supabase
    .from('profile_photo_reviews')
    .select(`
      review_id,
      storage_path,
      status,
      submitted_at,
      reviewed_at,
      rejection_reason,
      remarks
    `)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function buildAvatarReviewFields(review) {
  const status = review?.status || null;

  return {
    avatar_review_id: review?.review_id || null,
    avatar_review_status: status,
    avatar_pending_url:
      status === 'pending' ? await resolveAvatarUrl(review.storage_path) : null,
    avatar_rejection_reason:
      status === 'rejected' ? review.rejection_reason || '' : '',
    avatar_reviewed_at: review?.reviewed_at || null,
    avatar_submitted_at: review?.submitted_at || null,
  };
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
      scholarship_status,
      scholar_is_archived,
      scholar_archived_at,
      scholar_removal_reason
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
        section: '',
        current_section: '',
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
        avatar_review_id: null,
        avatar_review_status: null,
        avatar_pending_url: null,
        avatar_rejection_reason: '',
        avatar_reviewed_at: null,
        avatar_submitted_at: null,
        account_status: '',
        sdo_status: '',
        is_profile_complete: false,
        has_scholar_access: false,
        scholar_privilege_removed: false,
        scholar_removed_at: null,
        scholar_removal_reason: '',
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

  // Section is application-cycle data. Prefer the active saved draft, then
  // fall back to the most recent submitted application that actually has a Section.
  const [sectionDraftResult, recentApplicationsResult] = await Promise.all([
    supabase
      .from('application_form_drafts')
      .select('payload, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('applications')
      .select('application_payload, updated_at')
      .eq('student_id', student.student_id)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(20),
  ]);

  if (sectionDraftResult.error) throw sectionDraftResult.error;
  if (recentApplicationsResult.error) throw recentApplicationsResult.error;

  const draftAcademic = sectionDraftResult.data?.payload?.academic || {};
  const submittedAcademic = (recentApplicationsResult.data || [])
    .map((row) => row?.application_payload?.academic || {})
    .find((academic) =>
      firstNonEmpty(academic.current_section, academic.section)
    ) || {};
  const currentSection = firstNonEmpty(
    draftAcademic.current_section,
    draftAcademic.section,
    submittedAcademic.current_section,
    submittedAcademic.section
  );

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

  const avatarReviewFields = await buildAvatarReviewFields(
    await getLatestAvatarReview(student.student_id)
  );

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
      section: currentSection,
      current_section: currentSection,

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

      avatar_url: await resolveAvatarUrl(student.profile_photo_url || null),
      ...avatarReviewFields,

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
      scholar_privilege_removed: student.scholar_is_archived === true,
      scholar_removed_at: student.scholar_archived_at || null,
      scholar_removal_reason: student.scholar_removal_reason || '', 
    },
  };
}

async function setupMyProfile(userId, payload = {}) {
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

  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  const userUpdate = {};
  const studentUpdate = { is_profile_complete: true };

  if (hasOwn('email')) {
    const email = safeText(payload.email);
    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        throw createHttpError(400, emailValidation.error);
      }
      userUpdate.email = emailValidation.email;
      studentUpdate.email_address = emailValidation.email;
    } else {
      userUpdate.email = null;
      studentUpdate.email_address = null;
    }
  }

  if (hasOwn('phone_number')) {
    const phoneNumber = safeText(payload.phone_number);
    userUpdate.phone_number = phoneNumber || null;
    studentUpdate.phone_number = phoneNumber || null;
  }

  if (Object.keys(userUpdate).length > 0) {
    const { error: userUpdateError } = await supabase
      .from('users')
      .update(userUpdate)
      .eq('user_id', userId);

    if (userUpdateError) throw userUpdateError;
  }

  if (hasOwn('first_name')) studentUpdate.first_name = safeText(payload.first_name) || null;
  if (hasOwn('middle_name')) studentUpdate.middle_name = safeText(payload.middle_name) || null;
  if (hasOwn('last_name')) studentUpdate.last_name = safeText(payload.last_name) || null;
  if (hasOwn('year_level')) {
    const yearLevel = Number(payload.year_level);
    studentUpdate.year_level = Number.isFinite(yearLevel) ? yearLevel : null;
  }
  if (hasOwn('sex') || hasOwn('sex_at_birth')) {
    studentUpdate.sex_at_birth = safeText(payload.sex ?? payload.sex_at_birth) || null;
  }

  let courseId = null;
  if (hasOwn('course_id')) {
    courseId = safeText(payload.course_id) || null;
  } else if (hasOwn('course_code')) {
    const courseCode = safeText(payload.course_code);
    if (courseCode) {
      const { data: course, error: courseError } = await supabase
        .from('academic_course')
        .select('course_id')
        .eq('course_code', courseCode)
        .maybeSingle();

      if (courseError) throw courseError;
      if (!course?.course_id) {
        throw createHttpError(400, 'Selected course was not found.');
      }
      courseId = course.course_id;
    }
  }

  if (hasOwn('course_id') || hasOwn('course_code')) {
    studentUpdate.course_id = courseId;
  }

  const { error: updateStudentError } = await supabase
    .from('students')
    .update(studentUpdate)
    .eq('student_id', student.student_id);

  if (updateStudentError) throw updateStudentError;

  const profilePayload = { student_id: student.student_id };
  const textProfileFields = [
    'date_of_birth',
    'place_of_birth',
    'civil_status',
    'maiden_name',
    'religion',
    'citizenship',
    'street_address',
    'subdivision',
    'barangay',
    'city',
    'province',
    'zip_code',
    'landline_number',
    'financial_support_type',
    'financial_support_other',
    'prior_scholarship_details',
    'disciplinary_details',
    'self_description',
    'aims_and_ambitions',
  ];

  for (const key of textProfileFields) {
    if (hasOwn(key)) profilePayload[key] = safeText(payload[key]) || null;
  }

  if (hasOwn('has_prior_scholarship')) {
    profilePayload.has_prior_scholarship = payload.has_prior_scholarship === true;
  }
  if (hasOwn('has_disciplinary_record')) {
    profilePayload.has_disciplinary_record = payload.has_disciplinary_record === true;
  }

  if (Object.keys(profilePayload).length > 1) {
    const { error: upsertProfileError } = await supabase
      .from('student_profiles')
      .upsert(profilePayload, { onConflict: 'student_id' });

    if (upsertProfileError) throw upsertProfileError;
  }

  return getMyProfile(userId);
}


async function updateMyProfile(userId, payload = {}) {
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id, user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (studentError) throw studentError;

  if (!student) {
    throw createHttpError(404, 'No student profile is linked to this account.');
  }

  // Profile & Account intentionally exposes only contact information for
  // self-service editing. Identity, academic fields, registered email, and
  // scholarship state are authoritative records managed by their dedicated
  // workflows and must not be writable through this endpoint.
  const allowedFields = new Set([
    'phone_number',
    'street_address',
    'subdivision',
    'barangay',
    'city',
    'province',
    'zip_code',
  ]);
  const attemptedRestrictedFields = Object.keys(payload || {}).filter(
    (key) => !allowedFields.has(key)
  );
  if (attemptedRestrictedFields.length > 0) {
    throw createHttpError(
      400,
      `Profile & Account can only update phone number and address. Unsupported field${attemptedRestrictedFields.length === 1 ? '' : 's'}: ${attemptedRestrictedFields.join(', ')}.`
    );
  }

  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload, key);

  if (hasOwn('phone_number')) {
    const phoneNumber = safeText(payload.phone_number);
    const [{ error: userUpdateError }, { error: studentUpdateError }] = await Promise.all([
      supabase
        .from('users')
        .update({ phone_number: phoneNumber || null })
        .eq('user_id', userId),
      supabase
        .from('students')
        .update({ phone_number: phoneNumber || null })
        .eq('student_id', student.student_id),
    ]);
    if (userUpdateError) throw userUpdateError;
    if (studentUpdateError) throw studentUpdateError;
  }

  const profilePayload = { student_id: student.student_id };
  for (const key of [
    'street_address',
    'subdivision',
    'barangay',
    'city',
    'province',
    'zip_code',
  ]) {
    if (hasOwn(key)) profilePayload[key] = safeText(payload[key]) || null;
  }

  if (Object.keys(profilePayload).length > 1) {
    const { error: upsertProfileError } = await supabase
      .from('student_profiles')
      .upsert(profilePayload, { onConflict: 'student_id' });
    if (upsertProfileError) throw upsertProfileError;
  }

  return getMyProfile(userId);
}

async function uploadAvatar(userId, file) {
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

  if (!file) {
    throw createHttpError(400, 'An avatar image is required.');
  }

  validateProfilePhoto(file);

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id, user_id, profile_photo_url')
    .eq('user_id', userId)
    .maybeSingle();

  if (studentError) throw studentError;

  if (!student?.student_id) {
    throw createHttpError(404, 'No student profile is linked to this account.');
  }

  const { data: pendingReview, error: pendingReviewError } = await supabase
    .from('profile_photo_reviews')
    .select('review_id')
    .eq('student_id', student.student_id)
    .eq('status', 'pending')
    .maybeSingle();

  if (pendingReviewError) throw pendingReviewError;

  if (pendingReview?.review_id) {
    throw createHttpError(409, 'You already have a profile picture pending review.');
  }

  // Always store a small review-ready avatar copy. The original selected
  // image is never persisted in Supabase Storage.
  const optimizedAvatar = await optimizeImageForStorage({
    buffer: file.buffer,
    mimeType: file.mimetype,
    fileName: file.originalname,
    maxWidth: 640,
    maxHeight: 640,
    quality: 74,
    minQuality: 62,
    targetBytes: 120 * 1024,
  });

  if (!optimizedAvatar) {
    throw createHttpError(
      415,
      'The selected profile photo could not be compressed.'
    );
  }

  const storagePath =
    `${userId}/avatar/${Date.now()}-avatar.webp`;

  await ensureAvatarBucketExists();

  const { error: storageError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, optimizedAvatar.buffer, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });

  if (storageError) throw storageError;

  const { data: review, error: reviewError } = await supabase
    .from('profile_photo_reviews')
    .insert([
      {
        student_id: student.student_id,
        user_id: student.user_id || userId,
        storage_path: storagePath,
        status: 'pending',
      },
    ])
    .select(`
      review_id,
      storage_path,
      status,
      submitted_at,
      reviewed_at,
      rejection_reason,
      remarks
    `)
    .single();

  if (reviewError) throw reviewError;

  const profile = await getMyProfile(userId);
  const profileDetails = profile?.profile || {};
  const studentName =
    [
      profileDetails.first_name,
      profileDetails.middle_name,
      profileDetails.last_name,
    ]
      .map(safeText)
      .filter(Boolean)
      .join(' ') ||
    profileDetails.pdm_id ||
    'An applicant';

  await notificationService
    .createStaffNotifications({
      roles: ['admin'],
      type: 'Profile Photo',
      title: 'Profile photo awaiting review',
      message: `${studentName} uploaded a new profile photo for approval.`,
      referenceId: review.review_id,
      referenceType: 'profile_photo_review',
    })
    .catch((notificationError) => {
      console.error(
        'PROFILE PHOTO STAFF NOTIFICATION ERROR:',
        notificationError?.message || notificationError
      );
    });

  return {
    message: 'Profile photo submitted for review.',
    review: {
      review_id: review.review_id,
      status: review.status,
      submitted_at: review.submitted_at,
      pending_url: await resolveAvatarUrl(review.storage_path),
    },
    pendingAvatarUrl: await resolveAvatarUrl(storagePath),
    ...profile,
  };
}

async function getMyOnboardingPreference(userId) {
  if (!userId) throw createHttpError(401, 'Authentication required.');

  const { data, error } = await supabase
    .from('mobile_user_preferences')
    .select('onboarding_seen_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    has_seen_onboarding: Boolean(data?.onboarding_seen_at),
    onboarding_seen_at: data?.onboarding_seen_at || null,
  };
}

async function markMyOnboardingSeen(userId) {
  if (!userId) throw createHttpError(401, 'Authentication required.');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('mobile_user_preferences')
    .upsert(
      {
        user_id: userId,
        onboarding_seen_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('onboarding_seen_at')
    .single();

  if (error) throw error;

  return {
    has_seen_onboarding: true,
    onboarding_seen_at: data.onboarding_seen_at,
  };
}

module.exports = {
  getMyProfile,
  getMyOnboardingPreference,
  markMyOnboardingSeen,
  setupMyProfile,
  updateMyProfile,
  uploadAvatar,
};
