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
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

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

async function getLatestApplication(studentId) {
  if (!studentId) return null;

  const { data, error } = await supabase
    .from('applications')
    .select(`
      application_id,
      student_id,
      opening_id,
      program_id,
      application_status,
      document_status,
      submission_date,
      is_disqualified
    `)
    .eq('student_id', studentId)
    .order('submission_date', { ascending: false })
    .limit(1);

  if (error) throw error;

  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function getOpeningsForMobile(userId) {
  const student = await getStudentByUserId(userId);
  const latestApplication = await getLatestApplication(student?.student_id);

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
    .eq('posting_status', 'open')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const existingOpeningId = latestApplication?.opening_id || null;
  const existingProgramId = latestApplication?.program_id || null;
  const existingApplicationId = latestApplication?.application_id || null;

  const scholar = isApprovedScholar(student);

  const items = (data || [])
    .filter((row) => {
      const program = row.scholarship_program;
      if (!program) return false;
      if (program.is_archived === true) return false;
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

      const hasApplied =
        String(existingOpeningId || '') === String(row.opening_id || '') ||
        String(existingProgramId || '') === String(row.program_id || '');

      return {
        opening_id: row.opening_id,
        program_id: row.program_id,
        opening_title: row.opening_title || 'Scholarship Opening',
        program_name: program.program_name || 'Scholarship Program',
        posting_status: row.posting_status || 'open',
        announcement_text: row.announcement_text || '',
        allocated_slots: row.allocated_slots ?? 0,
        filled_slots: row.filled_slots ?? 0,
        financial_allocation: row.financial_allocation ?? 0,
        per_scholar_amount: row.per_scholar_amount ?? 0,
        benefactor_name: benefactor?.benefactor_name || null,
        benefactor_type: benefactor?.benefactor_type || null,
        has_applied: !!hasApplied,
        can_reapply: false,
        can_apply: !hasApplied && !scholar,
        apply_label: hasApplied
          ? 'Already Applied'
          : scholar
            ? 'Scholar Account'
            : 'Apply Now',
        existing_application_id: hasApplied ? existingApplicationId : null,
        created_at: row.created_at || null,
      };
    });

  return {
    hasBaseApplicationProfile: !!student?.student_id,
    isApprovedScholar: scholar,
    activeApplicationId: existingApplicationId || '',
    activeOpeningId: existingOpeningId || '',
    items,
  };
}

async function getLatestOpeningForMobile(userId) {
  const payload = await getOpeningsForMobile(userId);
  return payload.items.length > 0 ? payload.items[0] : null;
}

async function applyToOpeningForMobile(userId, openingId, body = {}) {
  if (!userId) throw createHttpError(401, 'Authentication required.');
  if (!openingId) throw createHttpError(400, 'Opening ID is required.');

  const student = await getStudentByUserId(userId);

  if (!student?.student_id) {
    throw createHttpError(400, 'Student profile is required before applying.');
  }

  if (isApprovedScholar(student)) {
    throw createHttpError(403, 'Approved scholars cannot submit a new application.');
  }

  const { data: opening, error: openingError } = await supabase
    .from('program_openings')
    .select('opening_id, program_id, posting_status, is_archived')
    .eq('opening_id', openingId)
    .maybeSingle();

  if (openingError) throw openingError;
  if (!opening) throw createHttpError(404, 'Opening not found.');
  if (opening.is_archived || opening.posting_status !== 'open') {
    throw createHttpError(400, 'This opening is not accepting applications.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('applications')
    .select('application_id')
    .eq('student_id', student.student_id)
    .eq('opening_id', openingId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    return {
      message: 'You already applied to this opening.',
      alreadyApplied: true,
      application: existing,
    };
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
        remarks: body.remarks || null,
      },
    ])
    .select('*')
    .single();

  if (insertError) throw insertError;

  return {
    message: 'Application submitted successfully.',
    application,
  };
}

module.exports = {
  getOpeningsForMobile,
  getLatestOpeningForMobile,
  applyToOpeningForMobile,
};