const supabase = require('../config/supabase');

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

async function getAdminProfileId(adminUserId) {
    if (!adminUserId) return null;

    const { data, error } = await supabase
        .from('admin_profiles')
        .select('admin_id')
        .eq('user_id', adminUserId)
        .maybeSingle();

    if (error) throw error;
    return data?.admin_id || null;
}

async function notifyPayoutStudents({ payoutBatch, students }) {
    if (!Array.isArray(students) || students.length === 0) return;

    const payoutDateText = payoutBatch.payout_date
        ? new Date(payoutBatch.payout_date).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
        : 'a scheduled date';

    const notifications = students
        .filter((student) => student.user_id)
        .map((student) => ({
            user_id: student.user_id,
            type: 'Payout',
            title: 'Payout Scheduled',
            message: `Your scholarship payout has been scheduled for ${payoutDateText}. Please check the Payouts page for details.`,
            reference_id: payoutBatch.payout_batch_id,
            reference_type: 'payout_batch',
            is_read: false,
            push_sent: false,
        }));

    if (notifications.length === 0) return;

    const { error } = await supabase.from('notifications').insert(notifications);

    if (error) {
        console.warn('PAYOUT NOTIFICATION INSERT WARNING:', error);
    }
}

async function getEligibleScholars({ programId, applicationIds = [] }) {
    let request = supabase
        .from('students')
        .select(`
      student_id,
      user_id,
      current_program_id,
      current_application_id,
      is_active_scholar,
      scholarship_status
    `)
        .eq('is_active_scholar', true)
        .eq('scholarship_status', 'Active');

    if (programId) {
        request = request.eq('current_program_id', programId);
    }

    if (applicationIds.length > 0) {
        request = request.in('current_application_id', applicationIds);
    }

    const { data, error } = await request;

    if (error) throw error;

    return data || [];
}

async function createPayoutBatch({ adminUserId, body }) {
    const adminId = await getAdminProfileId(adminUserId);

    const programId = safeText(body.program_id);
    const openingId = safeText(body.opening_id) || null;
    const academicYearId = safeText(body.academic_year_id);
    const periodId = safeText(body.period_id);
    const payoutTitle = safeText(body.payout_title) || 'Scholarship Payout';
    const payoutDate = safeText(body.payout_date) || null;
    const paymentMode = safeText(body.payment_mode) || 'Cash';
    const amountPerScholar = Number(body.amount_per_scholar || 0);

    if (!programId) throw createHttpError(400, 'Program ID is required.');
    if (!academicYearId) throw createHttpError(400, 'Academic year is required.');
    if (!periodId) throw createHttpError(400, 'Academic period is required.');
    if (amountPerScholar <= 0) {
        throw createHttpError(400, 'Amount per scholar must be greater than zero.');
    }

    const eligibleScholars = await getEligibleScholars({ programId });

    const totalAmount = eligibleScholars.length * amountPerScholar;

    const { data: batch, error: batchError } = await supabase
        .from('payout_batches')
        .insert([
            {
                program_id: programId,
                opening_id: openingId,
                academic_year_id: academicYearId,
                period_id: periodId,
                payout_title: payoutTitle,
                payout_date: payoutDate,
                payment_mode: paymentMode,
                amount_per_scholar: amountPerScholar,
                total_amount: totalAmount,
                batch_status: payoutDate ? 'In Release' : 'Draft',
                remarks: safeText(body.remarks),
            },
        ])
        .select('*')
        .single();

    if (batchError) throw batchError;

    if (eligibleScholars.length > 0) {
        const entries = eligibleScholars.map((student) => ({
            payout_batch_id: batch.payout_batch_id,
            student_id: student.student_id,
            program_id: programId,
            application_id: student.current_application_id,
            amount_received: amountPerScholar,
            release_status: 'Pending',
        }));

        const { error: entriesError } = await supabase
            .from('payout_batch_students')
            .insert(entries);

        if (entriesError) throw entriesError;
    }

    if (payoutDate) {
        await notifyPayoutStudents({
            payoutBatch: batch,
            students: eligibleScholars,
        });
    }

    return {
        message: payoutDate
            ? 'Payout batch created and scholars notified.'
            : 'Payout batch created as draft.',
        batch,
        scholars_count: eligibleScholars.length,
        notified_count: payoutDate ? eligibleScholars.length : 0,
        created_by: adminId,
    };
}

async function schedulePayoutBatch({ adminUserId, payoutBatchId, body }) {
    if (!payoutBatchId) {
        throw createHttpError(400, 'Payout batch ID is required.');
    }

    const payoutDate = safeText(body.payout_date);

    if (!payoutDate) {
        throw createHttpError(400, 'Payout date is required.');
    }

    const { data: batch, error: batchError } = await supabase
        .from('payout_batches')
        .update({
            payout_date: payoutDate,
            batch_status: 'In Release',
            remarks: safeText(body.remarks),
            updated_at: new Date().toISOString(),
        })
        .eq('payout_batch_id', payoutBatchId)
        .select('*')
        .single();

    if (batchError) throw batchError;

    const { data: payoutStudents, error: payoutStudentsError } = await supabase
        .from('payout_batch_students')
        .select(`
      student_id,
      students (
        student_id,
        user_id
      )
    `)
        .eq('payout_batch_id', payoutBatchId);

    if (payoutStudentsError) throw payoutStudentsError;

    const students = (payoutStudents || [])
        .map((row) => row.students)
        .filter(Boolean);

    await notifyPayoutStudents({
        payoutBatch: batch,
        students,
    });

    return {
        message: 'Payout scheduled and scholars notified.',
        batch,
        notified_count: students.length,
    };
}

async function getMyPayouts(userId) {
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id, user_id, is_active_scholar, scholarship_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (studentError) throw studentError;

  if (!student) {
    throw createHttpError(404, 'Student profile not found.');
  }

  if (!student.is_active_scholar && student.scholarship_status !== 'Active') {
    return {
      items: [],
      message: 'Payouts are available after your application is approved.',
    };
  }

  const { data, error } = await supabase
    .from('payout_batch_students')
    .select(`
      payout_entry_id,
      payout_batch_id,
      student_id,
      application_id,
      amount_received,
      release_status,
      released_at,
      check_number,
      remarks,
      created_at,
      payout_batches (
        payout_batch_id,
        payout_title,
        payout_date,
        payment_mode,
        amount_per_scholar,
        total_amount,
        batch_status,
        acknowledgement_status,
        remarks,
        scholarship_program (
          program_id,
          program_name
        ),
        program_openings (
          opening_id,
          opening_title
        ),
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
      )
    `)
    .eq('student_id', student.student_id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const items = (data || []).map((row) => {
    const batch = row.payout_batches || {};
    const program = batch.scholarship_program || {};
    const opening = batch.program_openings || {};
    const academicYear = batch.academic_years || {};
    const period = batch.academic_period || {};

    return {
      payout_entry_id: row.payout_entry_id,
      payout_batch_id: row.payout_batch_id,
      application_id: row.application_id,

      title: batch.payout_title || 'Scholarship Payout',
      program_name: program.program_name || 'Scholarship Program',
      opening_title: opening.opening_title || '',

      amount: Number(row.amount_received || batch.amount_per_scholar || 0),
      amount_received: Number(row.amount_received || 0),
      amount_per_scholar: Number(batch.amount_per_scholar || 0),

      payout_date: batch.payout_date || null,
      payment_mode: batch.payment_mode || '-',
      batch_status: batch.batch_status || 'Pending',
      release_status: row.release_status || 'Pending',
      acknowledgement_status: batch.acknowledgement_status || 'Pending',

      academic_year:
        academicYear.label ||
        (academicYear.start_year && academicYear.end_year
          ? `${academicYear.start_year}-${academicYear.end_year}`
          : '-'),

      semester: period.term || '-',

      reference: row.check_number || row.payout_entry_id,
      remarks: row.remarks || batch.remarks || '',
      released_at: row.released_at || null,
      created_at: row.created_at,
    };
  });

  return { items };
}

module.exports = {
    createPayoutBatch,
    schedulePayoutBatch,
    getMyPayouts,
};