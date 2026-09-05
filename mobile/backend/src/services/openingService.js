const supabase = require('../config/supabase');
const {
  loadApplicationAvailabilityPolicy,
  assertGlobalApplicationAvailability,
  assertOpeningInActivePeriod,
} = require('./applicationAvailabilityService');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isApprovedScholar(student) {
  return (
    student?.is_active_scholar === true ||
    String(student?.scholarship_status || '').toLowerCase() === 'active'
  );
}

const REQUIRED_APPLICATION_UPLOAD_KEYS = Object.freeze([
  'certificate_of_registration',
  'student_grade_forms',
  'certificate_of_indigency',
  'letter_of_request',
]);

function normalizeApplicationDocumentKey(value = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (
    normalized === 'birth certificate' ||
    normalized === 'birth certificate / psa' ||
    normalized === 'certificate of live birth' ||
    normalized === 'psa' ||
    normalized === 'nso'
  ) {
    return 'birth_certificate';
  }

  if (
    normalized === 'certificate of registration' ||
    normalized === 'cor' ||
    normalized === 'registration' ||
    normalized === 'registration form'
  ) {
    return 'certificate_of_registration';
  }

  if (
    normalized === 'student grade forms' ||
    normalized === 'grade forms' ||
    normalized === 'grade form' ||
    normalized === 'grade report' ||
    normalized === 'grades' ||
    normalized === 'grade card' ||
    normalized === 'report card'
  ) {
    return 'student_grade_forms';
  }

  if (
    normalized === 'certificate of indigency' ||
    normalized === 'indigency'
  ) {
    return 'certificate_of_indigency';
  }

  if (
    normalized === 'letter of request' ||
    normalized === 'request letter' ||
    normalized === 'lor'
  ) {
    return 'letter_of_request';
  }

  return normalized.replace(/\s+/g, '_');
}

async function getApplicationUploadCounts(applicationIds = []) {
  const normalizedIds = [
    ...new Set(
      (applicationIds || [])
        .filter(Boolean)
        .map((value) => String(value))
    ),
  ];

  const counts = new Map();

  if (normalizedIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabase
    .from('application_documents')
    .select(`
      application_id,
      document_type,
      is_submitted,
      file_path,
      file_url
    `)
    .in('application_id', normalizedIds);

  if (error) throw error;

  const uploadedKeysByApplication = new Map();

  for (const document of data || []) {
    const applicationId = String(document.application_id || '');
    if (!applicationId) continue;

    const documentKey = normalizeApplicationDocumentKey(
      document.document_type
    );

    const hasFile =
      String(document.file_path || '').trim() !== '' ||
      String(document.file_url || '').trim() !== '';

    if (
      document.is_submitted === true &&
      hasFile &&
      REQUIRED_APPLICATION_UPLOAD_KEYS.includes(documentKey)
    ) {
      const uploadedKeys =
        uploadedKeysByApplication.get(applicationId) || new Set();

      uploadedKeys.add(documentKey);
      uploadedKeysByApplication.set(applicationId, uploadedKeys);
    }
  }

  for (const applicationId of normalizedIds) {
    counts.set(applicationId, {
      uploadedDocumentCount:
        uploadedKeysByApplication.get(applicationId)?.size || 0,
      requiredDocumentCount: REQUIRED_APPLICATION_UPLOAD_KEYS.length,
    });
  }

  return counts;
}

async function getMajorViolationApplicationIds(applicationIds = []) {
  const normalizedIds = [
    ...new Set(
      (applicationIds || [])
        .filter(Boolean)
        .map((value) => String(value))
    ),
  ];

  if (normalizedIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('application_document_reviews')
    .select('application_id, review_status, issue_severity')
    .in('application_id', normalizedIds)
    .eq('review_status', 'rejected')
    .eq('issue_severity', 'major');

  if (error) throw error;

  return new Set(
    (data || [])
      .map((row) => String(row.application_id || ''))
      .filter(Boolean)
  );
}

async function hasExplicitMajorViolation(applicationId) {
  if (!applicationId) return false;

  const { data, error } = await supabase
    .from('application_document_reviews')
    .select('review_id')
    .eq('application_id', applicationId)
    .eq('review_status', 'rejected')
    .eq('issue_severity', 'major')
    .limit(1);

  if (error) throw error;

  return Array.isArray(data) && data.length > 0;
}

async function getStudentByUserId(userId) {
  if (!userId) throw createHttpError(401, 'Authentication required.');

  const { data, error } = await supabase
    .from('students')
    .select(`
      student_id,
      user_id,
      pdm_id,
      is_active_scholar,
      scholarship_status,
      scholar_is_archived,
      current_program_id,
      current_application_id,
      is_archived
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getStudentApplications(studentId) {
  if (!studentId) return [];

  const { data, error } = await supabase
    .from('applications')
    .select(`
      application_id,
      student_id,
      opening_id,
      program_id,
      application_status,
      document_status,
      verification_status,
      selection_status,
      queue_position,
      waitlist_position,
      can_reapply,
      reapplication_reason,
      rejection_reason,
      submission_date,
      is_disqualified,
      is_archived,
      created_at,
      updated_at
    `)
    .eq('student_id', studentId)
    .order('submission_date', {
      ascending: false,
      nullsFirst: false,
    })
    .order('created_at', {
      ascending: false,
      nullsFirst: false,
    });

  if (error) throw error;

  return data || [];
}

function normalizedApplicationStatus(application) {
  return String(application?.application_status || '')
    .trim()
    .toLowerCase();
}

function normalizedSelectionStatus(application) {
  return String(application?.selection_status || '')
    .trim()
    .toLowerCase();
}

function isRejectedApplication(application) {
  const status = normalizedApplicationStatus(application);

  return (
    status === 'rejected' ||
    status === 'disqualified'
  );
}

function isActiveApplication(application) {
  if (!application) {
    return false;
  }

  if (application.is_archived === true) {
    return false;
  }

  if (application.is_disqualified === true) {
    return false;
  }

  const status = normalizedApplicationStatus(application);
  const selection = normalizedSelectionStatus(application);

  if (
    status === 'rejected' ||
    status === 'disqualified'
  ) {
    return false;
  }

  if (
    selection === 'not selected' ||
    selection === 'not_selected'
  ) {
    return false;
  }

  return true;
}

function canReapplyToSameOpening(application, majorViolationIds) {
  if (!application || !isRejectedApplication(application)) {
    return false;
  }

  const applicationId = String(application.application_id || '');
  const hasMajorViolation = majorViolationIds.has(applicationId);

  // An explicit major document violation is final for the current opening.
  // A normal can_reapply flag cannot bypass a fraud/tampering rejection.
  if (hasMajorViolation) {
    return false;
  }

  // Explicit admin grant is always honored for non-major rejections.
  if (application.can_reapply === true) {
    return true;
  }

  // Compatibility rule for applications rejected before the new
  // minor/major severity policy existed. If there is no explicit major
  // review row, allow one clean application attempt rather than trapping
  // the account in a legacy rejected record.
  return true;
}

async function getActiveAcademicPeriod() {
  const { data, error } = await supabase
    .from('academic_period')
    .select('period_id, academic_year_id, term')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getOpeningsForMobile(userId) {
  const student = await getStudentByUserId(userId);
  const applications = await getStudentApplications(student?.student_id);
  const activeApplication =
    applications.find(isActiveApplication) || null;

  const availability = await loadApplicationAvailabilityPolicy();
  const activePeriod = availability.activePeriod;

  const { data, error } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
      academic_year_id,
      period_id,
      opening_title,
      announcement_text,
      allocated_slots,
      filled_slots,
      financial_allocation,
      per_scholar_amount,
      posting_status,
      waiting_list_enabled,
      waiting_list_limit,
      selection_status,
      selection_finalized_at,
      is_archived,
      created_at,
      updated_at,
      academic_years (
        label
      ),
      academic_period (
        term
      ),
      scholarship_program (
        program_id,
        program_name,
        visibility_status,
        is_archived,
        benefactor_id,
        description,
        target_audience,
        gwa_threshold,
        renewal_cycle,
        benefactors (
          benefactor_id,
          benefactor_name,
          benefactor_type,
          description,
          is_archived
        )
      )
    `)
    .eq('posting_status', 'open')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const openingIds = (data || [])
    .map((row) => row.opening_id)
    .filter(Boolean);

  const waitlistCounts = new Map();

  if (openingIds.length > 0) {
    const { data: waitlistedRows, error: waitlistError } = await supabase
      .from('applications')
      .select('opening_id')
      .in('opening_id', openingIds)
      .eq('selection_status', 'Waitlisted')
      .eq('is_archived', false);

    if (waitlistError) throw waitlistError;

    for (const row of waitlistedRows || []) {
      const key = String(row.opening_id);
      waitlistCounts.set(
        key,
        (waitlistCounts.get(key) || 0) + 1
      );
    }
  }

  const applicationUploadCounts = await getApplicationUploadCounts(
    applications.map((application) => application.application_id)
  );

  const majorViolationIds = await getMajorViolationApplicationIds(
    applications.map((application) => application.application_id)
  );

  const scholar = isApprovedScholar(student);
  const scholarPrivilegeRemoved = student?.scholar_is_archived === true;

  const allItems = (data || [])
    .filter((row) => {
      const program = row.scholarship_program;

      if (!program || program.is_archived === true) return false;
      if (program.benefactors?.is_archived === true) return false;

      if (
        program.visibility_status &&
        String(program.visibility_status).toLowerCase() !== 'published'
      ) {
        return false;
      }

      return true;
    })
    .map((row) => {
      const program = row.scholarship_program || {};
      const benefactor = program.benefactors || null;
      const academicYearLabel = String(
        row.academic_years?.label || ''
      ).trim();
      const academicTerm = String(
        row.academic_period?.term || ''
      ).trim();
      const applicationPeriodLabel = [
        academicYearLabel,
        academicTerm,
      ]
        .filter(Boolean)
        .join(' · ');

      const isCurrentPeriod =
        !!activePeriod?.period_id &&
        String(row.period_id || '') ===
          String(activePeriod.period_id);

      const openingApplications = applications.filter(
        (application) =>
          application.is_archived !== true &&
          String(application.opening_id) ===
            String(row.opening_id)
      );

      const activeExisting =
        openingApplications.find(isActiveApplication) || null;

      const previousApplication =
        openingApplications[0] || null;

      const previousRejected =
        !activeExisting &&
        isRejectedApplication(previousApplication);

      const canReapply =
        previousRejected &&
        canReapplyToSameOpening(
          previousApplication,
          majorViolationIds
        );

      const blockedByMajorRejection =
        previousRejected &&
        !canReapply &&
        majorViolationIds.has(
          String(previousApplication?.application_id || '')
        );

      const allocatedSlots = Number(row.allocated_slots || 0);
      const filledSlots = Number(row.filled_slots || 0);
      const availableSlots = Math.max(
        allocatedSlots - filledSlots,
        0
      );

      const waitingListEnabled =
        row.waiting_list_enabled !== false;

      const waitingListCount =
        waitlistCounts.get(String(row.opening_id)) || 0;

      const waitingListLimit =
        Number(row.waiting_list_limit || 0);

      const waitingListHasCapacity =
        waitingListLimit <= 0 ||
        waitingListCount < waitingListLimit;

      const waitingListAvailable =
        isCurrentPeriod &&
        availableSlots <= 0 &&
        waitingListEnabled &&
        waitingListHasCapacity &&
        String(row.posting_status || '').toLowerCase() === 'open';

      // Only an active/manageable application counts as "has applied".
      // A rejected application must never send the student back to the old
      // Required Documents screen.
      const hasApplied = !!activeExisting;

      const visibleApplication =
        activeExisting || previousApplication;

      const documentSummary = activeExisting?.application_id
        ? applicationUploadCounts.get(
            String(activeExisting.application_id)
          )
        : null;

      const openingAcceptsApplications =
        isCurrentPeriod &&
        String(row.posting_status || '').toLowerCase() === 'open' &&
        (availableSlots > 0 || waitingListAvailable);

      const previousApplicationAllowsAttempt =
        !previousApplication ||
        canReapply;

      const canApply =
        !scholar &&
        !scholarPrivilegeRemoved &&
        !activeExisting &&
        previousApplicationAllowsAttempt &&
        openingAcceptsApplications;

      let applyLabel = 'Apply for Scholarship';

      if (scholar) {
        applyLabel = 'Scholar Account';
      } else if (scholarPrivilegeRemoved) {
        applyLabel = 'Eligibility Review Required';
      } else if (hasApplied) {
        applyLabel = 'Manage Documents';
      } else if (blockedByMajorRejection) {
        applyLabel = 'Application Rejected';
      } else if (canReapply) {
        applyLabel = waitingListAvailable
          ? 'Apply Again for Waiting List'
          : 'Apply Again';
      } else if (previousRejected) {
        applyLabel = 'Application Rejected';
      } else if (waitingListAvailable && canApply) {
        applyLabel = 'Apply for Waiting List';
      } else if (!canApply) {
        applyLabel = 'Applications Closed';
      }

      return {
        opening_id: row.opening_id,
        program_id: row.program_id,
        academic_year_id: row.academic_year_id || null,
        period_id: row.period_id || null,
        is_current_period: isCurrentPeriod,
        academic_year_label: academicYearLabel,
        academic_term: academicTerm,
        application_period_label: applicationPeriodLabel,
        opening_title:
          row.opening_title ||
          program.program_name ||
          'Scholarship',
        program_name:
          program.program_name ||
          'Scholarship Program',
        posting_status: row.posting_status || 'open',
        announcement_text: row.announcement_text || '',
        allocated_slots: allocatedSlots,
        filled_slots: filledSlots,
        available_slots: availableSlots,
        waiting_list_enabled: waitingListEnabled,
        waiting_list_limit: waitingListLimit,
        waiting_list_count: waitingListCount,
        waiting_list_available: waitingListAvailable,
        selection_status:
          row.selection_status || 'Not Started',
        selection_finalized_at:
          row.selection_finalized_at || null,
        financial_allocation:
          row.financial_allocation ?? 0,
        per_scholar_amount:
          row.per_scholar_amount ?? 0,
        benefactor_name:
          benefactor?.benefactor_name || null,
        benefactor_description:
          benefactor?.description || null,
        program_description:
          program.description || '',
        target_audience:
          program.target_audience || 'Applicants',
        gwa_threshold:
          program.gwa_threshold ?? null,
        renewal_cycle:
          program.renewal_cycle || 'None',
        benefactor_type:
          benefactor?.benefactor_type || null,

        has_applied: hasApplied,
        has_previous_application: !!previousApplication,
        previous_application_rejected: previousRejected,
        previous_rejection_was_major: blockedByMajorRejection,

        uploaded_document_count:
          documentSummary?.uploadedDocumentCount || 0,
        required_document_count:
          documentSummary?.requiredDocumentCount ||
          REQUIRED_APPLICATION_UPLOAD_KEYS.length,

        can_reapply: canReapply,
        can_apply: canApply,
        can_join_waiting_list:
          waitingListAvailable && canApply,
        apply_label: applyLabel,

        existing_application_id:
          visibleApplication?.application_id || null,
        existing_application_status:
          visibleApplication?.application_status || null,
        existing_selection_status:
          visibleApplication?.selection_status || null,
        queue_position:
          visibleApplication?.queue_position ?? null,
        waitlist_position:
          visibleApplication?.waitlist_position ?? null,
        reapplication_reason:
          visibleApplication?.reapplication_reason || null,
        rejection_reason:
          visibleApplication?.rejection_reason || null,

        created_at: row.created_at || null,
      };
    });

  // Do not clutter the scholarship list with old semesters. A historical
  // opening is retained only when this student already has an application
  // tied to it, so their existing status remains reachable.
  const scopedItems = allItems.filter(
    (item) => item.is_current_period === true
  );

  const items = activeApplication?.opening_id
    ? scopedItems.filter(
        (item) =>
          String(item.opening_id) ===
          String(activeApplication.opening_id)
      )
    : scopedItems;

  return {
    hasBaseApplicationProfile: !!student?.student_id,
    isApprovedScholar: scholar,
    scholarPrivilegeRemoved,
    activeApplicationId:
      activeApplication?.application_id || '',
    activeOpeningId:
      activeApplication?.opening_id || '',
    items: availability.can_apply ? items : [],
    availability: {
      can_apply: availability.can_apply,
      code: availability.code,
      message: availability.message,
      deadline: availability.deadline,
      timezone: availability.timezone,
    },
  };
}

async function getLatestOpeningForMobile(userId) {
  const payload = await getOpeningsForMobile(userId);

  return {
    item:
      payload.items.find((item) => item.can_apply) ||
      payload.items[0] ||
      null,
    availability: payload.availability,
  };
}

async function applyToOpeningForMobile(
  userId,
  openingId,
  body = {}
) {
  if (!userId) {
    throw createHttpError(
      401,
      'Authentication required.'
    );
  }

  if (!openingId) {
    throw createHttpError(
      400,
      'Scholarship ID is required.'
    );
  }

  const student = await getStudentByUserId(userId);

  if (!student?.student_id) {
    throw createHttpError(
      400,
      'Complete your student profile before applying.'
    );
  }

  if (student.scholar_is_archived === true) {
    throw createHttpError(
      409,
      'Your previous scholarship privilege was removed. Contact OSFA for an eligibility review before applying again.'
    );
  }

  if (isApprovedScholar(student)) {
    throw createHttpError(
      403,
      'Active scholars cannot submit a new application.'
    );
  }

  const availability = await loadApplicationAvailabilityPolicy();
  assertGlobalApplicationAvailability(availability);

  const { data: opening, error: openingError } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
      academic_year_id,
      period_id,
      posting_status,
      is_archived,
      allocated_slots,
      filled_slots,
      waiting_list_enabled,
      waiting_list_limit
    `)
    .eq('opening_id', openingId)
    .maybeSingle();

  if (openingError) throw openingError;

  if (!opening) {
    throw createHttpError(
      404,
      'Scholarship not found.'
    );
  }

  assertOpeningInActivePeriod(opening, availability);

  if (
    opening.is_archived ||
    opening.posting_status !== 'open'
  ) {
    throw createHttpError(
      400,
      'This scholarship is not accepting applications.'
    );
  }

  const { data: existingApplications, error: existingError } =
    await supabase
      .from('applications')
      .select('*')
      .eq('student_id', student.student_id)
      .eq('opening_id', openingId)
      .eq('is_archived', false)
      .order('submission_date', {
        ascending: false,
        nullsFirst: false,
      })
      .order('created_at', {
        ascending: false,
        nullsFirst: false,
      });

  if (existingError) throw existingError;

  const existingList =
    Array.isArray(existingApplications)
      ? existingApplications
      : [];

  const activeExisting =
    existingList.find(isActiveApplication) || null;

  if (activeExisting) {
    return {
      message:
        'You already submitted an active application for this scholarship.',
      alreadyApplied: true,
      reapplyInFuturePeriod: false,
      application: activeExisting,
    };
  }

  const previousApplication =
    existingList[0] || null;

  let isReapplication = false;

  if (previousApplication) {
    if (!isRejectedApplication(previousApplication)) {
      return {
        message:
          'A previous application already exists for this scholarship period.',
        alreadyApplied: true,
        reapplyInFuturePeriod: true,
        application: previousApplication,
      };
    }

    const majorViolation =
      await hasExplicitMajorViolation(
        previousApplication.application_id
      );

    if (majorViolation) {
      return {
        message:
          'This application was rejected for a major document violation. A new application cannot be submitted for the same scholarship period.',
        alreadyApplied: true,
        reapplyInFuturePeriod: true,
        majorRejection: true,
        application: previousApplication,
      };
    }

    // A rejected record without an explicit major review is treated as a
    // correctable/legacy rejection and may start a completely fresh
    // application. No old files or verification decisions are inherited.
    isReapplication = true;
  }

  const allocatedSlots =
    Number(opening.allocated_slots || 0);

  const filledSlots =
    Number(opening.filled_slots || 0);

  const slotsAreFull =
    allocatedSlots > 0 &&
    filledSlots >= allocatedSlots;

  if (slotsAreFull) {
    if (opening.waiting_list_enabled === false) {
      throw createHttpError(
        409,
        'All scholarship slots are filled and the waiting list is closed.'
      );
    }

    const waitingListLimit =
      Number(opening.waiting_list_limit || 0);

    if (waitingListLimit > 0) {
      const {
        data: waitingCandidates,
        error: waitingCandidatesError,
      } = await supabase
        .from('applications')
        .select(
          'application_id, application_status, selection_status, is_disqualified, is_archived'
        )
        .eq('opening_id', openingId);

      if (waitingCandidatesError) {
        throw waitingCandidatesError;
      }

      const activeWaitingCandidates =
        (waitingCandidates || []).filter((candidate) => {
          const applicationStatus = String(
            candidate.application_status || ''
          ).toLowerCase();

          const selectionStatus = String(
            candidate.selection_status || ''
          ).toLowerCase();

          return (
            candidate.is_archived !== true &&
            candidate.is_disqualified !== true &&
            !['approved', 'rejected'].includes(
              applicationStatus
            ) &&
            ![
              'selected',
              'promoted',
              'not selected',
            ].includes(selectionStatus)
          );
        }).length;

      if (
        activeWaitingCandidates >=
        waitingListLimit
      ) {
        throw createHttpError(
          409,
          'The waiting list has reached its configured limit.'
        );
      }
    }
  }

  const now = new Date().toISOString();

  const { data: application, error: insertError } =
    await supabase
      .from('applications')
      .insert([
        {
          student_id: student.student_id,
          opening_id: opening.opening_id,
          program_id: opening.program_id,
          application_status: 'Pending Review',
          document_status: 'Missing Docs',
          verification_status: 'pending',
          selection_status: 'Unranked',
          can_reapply: false,
          reapplication_reason: isReapplication
            ? 'Fresh reapplication after previous non-major or legacy rejection.'
            : null,
          remarks: body.remarks || null,
          submission_date: now,
          is_disqualified: false,
        },
      ])
      .select('*')
      .single();

  if (insertError) throw insertError;

  if (
    isReapplication &&
    previousApplication?.application_id
  ) {
    const { error: consumeReapplyError } = await supabase
      .from('applications')
      .update({
        can_reapply: false,
        updated_at: now,
      })
      .eq(
        'application_id',
        previousApplication.application_id
      );

    if (consumeReapplyError) {
      console.warn(
        'REAPPLICATION FLAG RESET WARNING:',
        consumeReapplyError
      );
    }
  }

  return {
    message:
      Number(opening.filled_slots || 0) >=
        Number(opening.allocated_slots || 0) &&
      opening.waiting_list_enabled !== false
        ? isReapplication
          ? 'Fresh application started. Complete the requirements to be considered for the waiting list.'
          : 'Application submitted. Complete the requirements to be considered for the waiting list.'
        : isReapplication
          ? 'Fresh application started successfully. Previous rejected documents were not reused.'
          : 'Application submitted successfully.',
    application,
    isReapplication,
  };
}

module.exports = {
  getOpeningsForMobile,
  getLatestOpeningForMobile,
  applyToOpeningForMobile,
};
