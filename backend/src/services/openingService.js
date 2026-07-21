const supabase = require('../config/supabase');

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
      selection_status,
      queue_position,
      waitlist_position,
      can_reapply,
      reapplication_reason,
      submission_date,
      is_disqualified
    `)
    .eq('student_id', studentId)
    .order('submission_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

function isActiveApplication(application) {
  const status = String(application?.application_status || '').toLowerCase();
  const selection = String(application?.selection_status || '').toLowerCase();
  return (
    !['rejected'].includes(status) ||
    ['qualified', 'selected', 'waitlisted', 'promoted'].includes(selection)
  );
}

async function getOpeningsForMobile(userId) {
  const student = await getStudentByUserId(userId);
  const applications = await getStudentApplications(student?.student_id);
  const latestApplication = applications[0] || null;

  const { data, error } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
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
      scholarship_program (
        program_id,
        program_name,
        visibility_status,
        is_archived,
        benefactor_id,
        benefactors (
          benefactor_id,
          benefactor_name,
          benefactor_type
        )
      )
    `)
    .in('posting_status', ['open', 'closed'])
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const openingIds = (data || []).map((row) => row.opening_id).filter(Boolean);
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
      waitlistCounts.set(key, (waitlistCounts.get(key) || 0) + 1);
    }
  }

  const scholar = isApprovedScholar(student);
  const items = (data || [])
    .filter((row) => {
      const program = row.scholarship_program;
      if (!program || program.is_archived === true) return false;
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
      const existing = applications.find(
        (application) => String(application.opening_id) === String(row.opening_id)
      );

      const allocatedSlots = Number(row.allocated_slots || 0);
      const filledSlots = Number(row.filled_slots || 0);
      const availableSlots = Math.max(allocatedSlots - filledSlots, 0);
      const waitingListEnabled = row.waiting_list_enabled !== false;
      const waitingListCount = waitlistCounts.get(String(row.opening_id)) || 0;
      const waitingListLimit = Number(row.waiting_list_limit || 0);
      const waitingListHasCapacity =
        waitingListLimit <= 0 || waitingListCount < waitingListLimit;
      const waitingListAvailable =
        availableSlots <= 0 &&
        waitingListEnabled &&
        waitingListHasCapacity &&
        String(row.posting_status || '').toLowerCase() === 'open';

      const hasApplied = !!existing;
      // Reapplication is supported through a new application period (a new
      // program_openings record). Reusing the same application would inherit
      // old documents and review history, so it is intentionally blocked.
      const canReapply = false;
      const canApply =
        !scholar &&
        !existing &&
        String(row.posting_status || '').toLowerCase() === 'open' &&
        (availableSlots > 0 || waitingListAvailable);

      let applyLabel = 'Apply for Scholarship';
      if (scholar) applyLabel = 'Scholar Account';
      else if (existing?.can_reapply === true) applyLabel = 'Apply Again Next Period';
      else if (hasApplied) applyLabel = 'Application Submitted';
      else if (waitingListAvailable) applyLabel = 'Apply for Waiting List';
      else if (!canApply) applyLabel = 'Applications Closed';

      return {
        opening_id: row.opening_id,
        program_id: row.program_id,
        opening_title: row.opening_title || program.program_name || 'Scholarship',
        program_name: program.program_name || 'Scholarship Program',
        posting_status: row.posting_status || 'open',
        announcement_text: row.announcement_text || '',
        allocated_slots: allocatedSlots,
        filled_slots: filledSlots,
        available_slots: availableSlots,
        waiting_list_enabled: waitingListEnabled,
        waiting_list_limit: waitingListLimit,
        waiting_list_count: waitingListCount,
        waiting_list_available: waitingListAvailable,
        selection_status: row.selection_status || 'Not Started',
        selection_finalized_at: row.selection_finalized_at || null,
        financial_allocation: row.financial_allocation ?? 0,
        per_scholar_amount: row.per_scholar_amount ?? 0,
        benefactor_name: benefactor?.benefactor_name || null,
        benefactor_type: benefactor?.benefactor_type || null,
        has_applied: hasApplied,
        can_reapply: canReapply,
        can_apply: canApply,
        can_join_waiting_list: waitingListAvailable && canApply,
        apply_label: applyLabel,
        existing_application_id: existing?.application_id || null,
        existing_application_status: existing?.application_status || null,
        existing_selection_status: existing?.selection_status || null,
        queue_position: existing?.queue_position ?? null,
        waitlist_position: existing?.waitlist_position ?? null,
        reapplication_reason: existing?.reapplication_reason || null,
        created_at: row.created_at || null,
      };
    });

  return {
    hasBaseApplicationProfile: !!student?.student_id,
    isApprovedScholar: scholar,
    activeApplicationId: latestApplication?.application_id || '',
    activeOpeningId: latestApplication?.opening_id || '',
    items,
  };
}

async function getLatestOpeningForMobile(userId) {
  const payload = await getOpeningsForMobile(userId);
  return payload.items.find((item) => item.can_apply) || payload.items[0] || null;
}

async function applyToOpeningForMobile(userId, openingId, body = {}) {
  if (!userId) throw createHttpError(401, 'Authentication required.');
  if (!openingId) throw createHttpError(400, 'Scholarship ID is required.');

  const student = await getStudentByUserId(userId);
  if (!student?.student_id) {
    throw createHttpError(400, 'Complete your student profile before applying.');
  }
  if (isApprovedScholar(student)) {
    throw createHttpError(403, 'Active scholars cannot submit a new application.');
  }

  const { data: opening, error: openingError } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
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
  if (!opening) throw createHttpError(404, 'Scholarship not found.');
  if (opening.is_archived || opening.posting_status !== 'open') {
    throw createHttpError(400, 'This scholarship is not accepting applications.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('applications')
    .select('*')
    .eq('student_id', student.student_id)
    .eq('opening_id', openingId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    return {
      message: existing.can_reapply === true
        ? 'This application period already contains your previous application. Reapply when a new eligible application period is posted.'
        : 'You already submitted an application for this scholarship.',
      alreadyApplied: true,
      reapplyInFuturePeriod: existing.can_reapply === true,
      application: existing,
    };
  }

  const allocatedSlots = Number(opening.allocated_slots || 0);
  const filledSlots = Number(opening.filled_slots || 0);
  const slotsAreFull = allocatedSlots > 0 && filledSlots >= allocatedSlots;

  if (slotsAreFull) {
    if (opening.waiting_list_enabled === false) {
      throw createHttpError(409, 'All scholarship slots are filled and the waiting list is closed.');
    }

    const waitingListLimit = Number(opening.waiting_list_limit || 0);
    if (waitingListLimit > 0) {
      const { data: waitingCandidates, error: waitingCandidatesError } = await supabase
        .from('applications')
        .select('application_id, application_status, selection_status, is_disqualified, is_archived')
        .eq('opening_id', openingId);

      if (waitingCandidatesError) throw waitingCandidatesError;

      const activeWaitingCandidates = (waitingCandidates || []).filter((candidate) => {
        const applicationStatus = String(candidate.application_status || '').toLowerCase();
        const selectionStatus = String(candidate.selection_status || '').toLowerCase();
        return candidate.is_archived !== true &&
          candidate.is_disqualified !== true &&
          !['approved', 'rejected'].includes(applicationStatus) &&
          !['selected', 'promoted', 'not selected'].includes(selectionStatus);
      }).length;

      if (activeWaitingCandidates >= waitingListLimit) {
        throw createHttpError(409, 'The waiting list has reached its configured limit.');
      }
    }
  }

  const { data: application, error: insertError } = await supabase
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
        remarks: body.remarks || null,
      },
    ])
    .select('*')
    .single();

  if (insertError) throw insertError;

  return {
    message:
      Number(opening.filled_slots || 0) >= Number(opening.allocated_slots || 0) &&
      opening.waiting_list_enabled !== false
        ? 'Application submitted. Complete the requirements to be considered for the waiting list.'
        : 'Application submitted successfully.',
    application,
  };
}

module.exports = {
  getOpeningsForMobile,
  getLatestOpeningForMobile,
  applyToOpeningForMobile,
};
