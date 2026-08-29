const supabase = require('../config/supabase');
const { resolveAvatarUrl } = require('./avatarService');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

// SMART-PDM_PROFILE_PHOTO_PENDING_SUPERSEDED_V2
// SMART-PDM_PROFILE_PHOTO_BLOB_LIFECYCLE_V1

const AVATAR_BUCKET = 'avatars';

async function purgeProfilePhotoBlobs(rows = []) {
  const candidates = (rows || [])
    .map((row) => ({
      review_id: safeText(row?.review_id),
      storage_path: safeText(row?.storage_path),
    }))
    .filter((row) => row.review_id && row.storage_path);

  if (!candidates.length) return;

  const paths = Array.from(
    new Set(candidates.map((row) => row.storage_path))
  );

  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove(paths.slice(index, index + 100));

    if (error) {
      console.warn(
        'PROFILE PHOTO BLOB CLEANUP WARNING:',
        error.message
      );
      return;
    }
  }

  const reviewIds = candidates.map((row) => row.review_id);

  const { error: clearError } = await supabase
    .from('profile_photo_reviews')
    .update({ storage_path: null })
    .in('review_id', reviewIds);

  if (clearError) {
    console.warn(
      'PROFILE PHOTO PATH CLEANUP WARNING:',
      clearError.message
    );
  }
}

async function getAdminProfileId(adminUserId) {
  if (!adminUserId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const { data, error } = await supabase
    .from('admin_profiles')
    .select('admin_id')
    .eq('user_id', adminUserId)
    .maybeSingle();

  if (error) throw error;

  if (!data?.admin_id) {
    throw createHttpError(403, 'Admin access is required.');
  }

  return data.admin_id;
}

function buildStudentName(student = {}) {
  return [student.first_name, student.middle_name, student.last_name]
    .map(safeText)
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function getStudentsByIds(studentIds = []) {
  const uniqueStudentIds = Array.from(
    new Set(studentIds.map((studentId) => safeText(studentId)).filter(Boolean))
  );

  if (!uniqueStudentIds.length) {
    return new Map();
  }

  const { data: students, error: studentError } = await supabase
    .from('students')
    .select(`
      student_id,
      pdm_id,
      registrar_student_number,
      first_name,
      middle_name,
      last_name,
      year_level,
      email_address,
      phone_number,
      profile_photo_url,
      course_id
    `)
    .in('student_id', uniqueStudentIds);

  if (studentError) throw studentError;

  const courseIds = Array.from(
    new Set((students || []).map((student) => safeText(student.course_id)).filter(Boolean))
  );

  let courseById = new Map();

  if (courseIds.length) {
    const { data: courses, error: courseError } = await supabase
      .from('academic_course')
      .select('course_id, course_code, course_name')
      .in('course_id', courseIds);

    if (courseError) throw courseError;

    courseById = new Map(
      (courses || []).map((course) => [safeText(course.course_id), course])
    );
  }

  return new Map(
    (students || []).map((student) => [
      safeText(student.student_id),
      {
        ...student,
        academic_course: courseById.get(safeText(student.course_id)) || null,
      },
    ])
  );
}

async function serializeReview(row, student = null) {
  if (!row) return null;

  const studentRecord = student || {};
  const course = studentRecord.academic_course || {};
  const currentProfilePath = safeText(studentRecord.profile_photo_url);
  const reviewStoragePath = safeText(row.storage_path);
  const isCurrentProfilePhoto =
    safeText(row.status).toLowerCase() === 'approved' &&
    !!currentProfilePath &&
    currentProfilePath === reviewStoragePath;

  return {
    review_id: row.review_id,
    student_id: row.student_id,
    user_id: row.user_id,
    storage_path: row.storage_path,
    submitted_url: await resolveAvatarUrl(row.storage_path),
    status: row.status,
    is_current_profile_photo: isCurrentProfilePhoto,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    reviewed_by_admin_id: row.reviewed_by_admin_id,
    rejection_reason: row.rejection_reason,
    remarks: row.remarks,
    student: {
      student_id: studentRecord.student_id || row.student_id,
      display_name: buildStudentName(studentRecord),
      first_name: studentRecord.first_name || '',
      middle_name: studentRecord.middle_name || '',
      last_name: studentRecord.last_name || '',
      pdm_id: studentRecord.pdm_id || '',
      registrar_student_number: studentRecord.registrar_student_number || '',
      email_address: studentRecord.email_address || '',
      phone_number: studentRecord.phone_number || '',
      year_level: studentRecord.year_level || null,
      course_code: course.course_code || '',
      course_name: course.course_name || '',
      profile_photo_url: studentRecord.profile_photo_url || null,
      current_avatar_url: await resolveAvatarUrl(studentRecord.profile_photo_url || null),
    },
  };
}

function reviewSelect() {
  return `
    review_id,
    student_id,
    user_id,
    storage_path,
    status,
    submitted_at,
    reviewed_at,
    reviewed_by_admin_id,
    rejection_reason,
    remarks
  `;
}

async function hydrateReviews(rows = []) {
  const studentsById = await getStudentsByIds(rows.map((row) => row.student_id));

  return Promise.all(
    (rows || []).map((row) => serializeReview(row, studentsById.get(safeText(row.student_id))))
  );
}

async function getProfilePhotoReviews({ adminUserId, query = {} }) {
  await getAdminProfileId(adminUserId);

  const status = safeText(query.status || 'pending').toLowerCase();
  const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'superseded']);

  let request = supabase
    .from('profile_photo_reviews')
    .select(reviewSelect())
    .order('submitted_at', { ascending: false });

  if (status && allowedStatuses.has(status)) {
    request = request.eq('status', status);
  }

  const [queueResult, statusResult] = await Promise.all([
    request,
    supabase
      .from('profile_photo_reviews')
      .select('status'),
  ]);

  if (queueResult.error) throw queueResult.error;
  if (statusResult.error) throw statusResult.error;

  const statusCounts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    superseded: 0,
  };

  for (const row of statusResult.data || []) {
    const rowStatus = safeText(row.status).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(statusCounts, rowStatus)) {
      statusCounts[rowStatus] += 1;
    }
  }

  return {
    items: await hydrateReviews(queueResult.data || []),
    status_counts: statusCounts,
  };
}

async function getProfilePhotoReviewById({ adminUserId, reviewId }) {
  await getAdminProfileId(adminUserId);

  if (!reviewId) {
    throw createHttpError(400, 'Review ID is required.');
  }

  const { data: review, error } = await supabase
    .from('profile_photo_reviews')
    .select(reviewSelect())
    .eq('review_id', reviewId)
    .maybeSingle();

  if (error) throw error;

  if (!review) {
    throw createHttpError(404, 'Profile photo review not found.');
  }

  const { data: history, error: historyError } = await supabase
    .from('profile_photo_reviews')
    .select(reviewSelect())
    .eq('student_id', review.student_id)
    .order('submitted_at', { ascending: false });

  if (historyError) throw historyError;

  const [reviewMap, historyItems] = await Promise.all([
    getStudentsByIds([review.student_id]),
    hydrateReviews(history || []),
  ]);

  return {
    review: await serializeReview(review, reviewMap.get(safeText(review.student_id))),
    history: historyItems,
  };
}

async function approveProfilePhotoReview({ adminUserId, reviewId, remarks }) {
  const adminId = await getAdminProfileId(adminUserId);

  if (!reviewId) {
    throw createHttpError(400, 'Review ID is required.');
  }

  const { data: review, error } = await supabase
    .from('profile_photo_reviews')
    .select('review_id, student_id, user_id, storage_path, status')
    .eq('review_id', reviewId)
    .maybeSingle();

  if (error) throw error;

  if (!review) {
    throw createHttpError(404, 'Profile photo review not found.');
  }

  if (review.status !== 'pending') {
    throw createHttpError(409, 'Only pending profile photo reviews can be approved.');
  }

  const now = new Date().toISOString();

  const { data: staleReviews, error: staleReviewsError } = await supabase
    .from('profile_photo_reviews')
    .select('review_id, storage_path, status')
    .eq('student_id', review.student_id)
    .in('status', ['pending', 'approved'])
    .neq('review_id', review.review_id);

  if (staleReviewsError) throw staleReviewsError;

  const { error: supersedeError } = await supabase
    .from('profile_photo_reviews')
    .update({
      status: 'superseded',
      reviewed_at: now,
      reviewed_by_admin_id: adminId,
      remarks: 'Superseded by a newer approved profile photo.',
    })
    .eq('student_id', review.student_id)
    .eq('status', 'pending')
    .neq('review_id', review.review_id);

  if (supersedeError) throw supersedeError;

  // Once a newer submission becomes the active photo, any older approved
  // submission is historical and must be shown as Superseded rather than
  // remaining indistinguishable from the current approved photo. Preserve
  // its original review metadata; only its lifecycle status changes.
  const { error: previousApprovedSupersedeError } = await supabase
    .from('profile_photo_reviews')
    .update({ status: 'superseded' })
    .eq('student_id', review.student_id)
    .eq('status', 'approved')
    .neq('review_id', review.review_id);

  if (previousApprovedSupersedeError) throw previousApprovedSupersedeError;

  const { error: studentError } = await supabase
    .from('students')
    .update({ profile_photo_url: review.storage_path })
    .eq('student_id', review.student_id);

  if (studentError) throw studentError;

  const { data: updatedReview, error: updateError } = await supabase
    .from('profile_photo_reviews')
    .update({
      status: 'approved',
      reviewed_at: now,
      reviewed_by_admin_id: adminId,
      remarks: safeText(remarks) || null,
    })
    .eq('review_id', review.review_id)
    .select(reviewSelect())
    .single();

  if (updateError) throw updateError;

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert([
      {
        user_id: review.user_id,
        type: 'Profile Photo',
        title: 'Profile Photo Approved',
        message: 'Your profile photo has been approved and is now visible in your account.',
        reference_id: review.review_id,
        reference_type: 'profile_photo_review',
        is_read: false,
        push_sent: false,
      },
    ]);

  if (notificationError) {
    console.warn('PROFILE PHOTO APPROVAL NOTIFICATION WARNING:', notificationError);
  }

  // Metadata/history remains in profile_photo_reviews, but stale image bytes
  // are removed after the new current avatar is safely approved.
  await purgeProfilePhotoBlobs(staleReviews || []);

  return {
    message: 'Profile photo approved successfully.',
    review: await serializeReview(
      updatedReview,
      (await getStudentsByIds([updatedReview.student_id])).get(safeText(updatedReview.student_id))
    ),
  };
}

async function rejectProfilePhotoReview({
  adminUserId,
  reviewId,
  rejectionReason,
  remarks,
}) {
  const adminId = await getAdminProfileId(adminUserId);
  const reason = safeText(rejectionReason);

  if (!reviewId) {
    throw createHttpError(400, 'Review ID is required.');
  }

  if (!reason) {
    throw createHttpError(400, 'Rejection reason is required.');
  }

  const { data: review, error } = await supabase
    .from('profile_photo_reviews')
    .select('review_id, student_id, user_id, status')
    .eq('review_id', reviewId)
    .maybeSingle();

  if (error) throw error;

  if (!review) {
    throw createHttpError(404, 'Profile photo review not found.');
  }

  if (review.status !== 'pending') {
    throw createHttpError(409, 'Only pending profile photo reviews can be rejected.');
  }

  const { data: updatedReview, error: updateError } = await supabase
    .from('profile_photo_reviews')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by_admin_id: adminId,
      rejection_reason: reason,
      remarks: safeText(remarks) || null,
    })
    .eq('review_id', review.review_id)
    .select(reviewSelect())
    .single();

  if (updateError) throw updateError;

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert([
      {
        user_id: review.user_id,
        type: 'Profile Photo',
        title: 'Profile Photo Rejected',
        message: `Your profile photo was not approved. Reason: ${reason}`,
        reference_id: review.review_id,
        reference_type: 'profile_photo_review',
        is_read: false,
        push_sent: false,
      },
    ]);

  if (notificationError) {
    console.warn('PROFILE PHOTO REJECTION NOTIFICATION WARNING:', notificationError);
  }

  // Rejection metadata stays in the database; the rejected image itself is
  // not useful after review and should not consume Storage indefinitely.
  await purgeProfilePhotoBlobs([review]);
  updatedReview.storage_path = null;

  return {
    message: 'Profile photo rejected successfully.',
    review: await serializeReview(
      updatedReview,
      (await getStudentsByIds([updatedReview.student_id])).get(safeText(updatedReview.student_id))
    ),
  };
}

module.exports = {
  getProfilePhotoReviews,
  getProfilePhotoReviewById,
  approveProfilePhotoReview,
  rejectProfilePhotoReview,
};
