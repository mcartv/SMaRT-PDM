const pool = require('../config/db');

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

async function getMyPayouts(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const studentResult = await pool.query(
        `
    SELECT
      student_id,
      user_id,
      is_active_scholar,
      scholarship_status
    FROM students
    WHERE user_id = $1
    LIMIT 1;
    `,
        [userId]
    );

    const student = studentResult.rows[0];

    if (!student) {
        throw createHttpError(404, 'Student profile not found.');
    }

    if (
        student.is_active_scholar !== true &&
        String(student.scholarship_status || '') !== 'Active'
    ) {
        return {
            items: [],
            message: 'Payouts are available after your application is approved.',
        };
    }

    const payoutResult = await pool.query(
        `
    SELECT
      pbs.payout_entry_id,
      pbs.payout_batch_id,
      pbs.student_id,
      pbs.application_id,
      pbs.amount_received,
      pbs.release_status,
      pbs.released_at,
      pbs.check_number,
      pbs.remarks AS entry_remarks,
      pbs.created_at,

      pb.payout_title,
      pb.payout_date,
      pb.payment_mode,
      pb.amount_per_scholar,
      pb.total_amount,
      pb.batch_status,
      pb.acknowledgement_status,
      pb.remarks AS batch_remarks,

      sp.program_id,
      sp.program_name,

      po.opening_id,
      po.opening_title,

      ay.academic_year_id,
      ay.label AS academic_year_label,
      ay.start_year,
      ay.end_year,

      ap.period_id,
      ap.term AS semester
    FROM payout_batch_students pbs
    INNER JOIN payout_batches pb
      ON pb.payout_batch_id = pbs.payout_batch_id
    LEFT JOIN scholarship_program sp
      ON sp.program_id = pb.program_id
    LEFT JOIN program_openings po
      ON po.opening_id = pb.opening_id
    LEFT JOIN academic_years ay
      ON ay.academic_year_id = pb.academic_year_id
    LEFT JOIN academic_period ap
      ON ap.period_id = pb.period_id
    WHERE pbs.student_id = $1
      AND COALESCE(pb.is_archived, FALSE) = FALSE
    ORDER BY pb.created_at DESC, pbs.created_at DESC;
    `,
        [student.student_id]
    );

    const items = payoutResult.rows.map((row) => ({
        payout_entry_id: row.payout_entry_id,
        payout_batch_id: row.payout_batch_id,
        application_id: row.application_id,

        title: row.payout_title || 'Scholarship Payout',
        program_name: row.program_name || 'Scholarship Program',
        opening_title: row.opening_title || '',

        amount: Number(row.amount_received || row.amount_per_scholar || 0),
        amount_received: Number(row.amount_received || 0),
        amount_per_scholar: Number(row.amount_per_scholar || 0),

        payout_date: row.payout_date || null,
        payment_mode: row.payment_mode || '-',
        batch_status: row.batch_status || 'Pending',
        release_status: row.release_status || 'Pending',
        acknowledgement_status: row.acknowledgement_status || 'Pending',

        academic_year:
            row.academic_year_label ||
            (row.start_year && row.end_year
                ? `${row.start_year}-${row.end_year}`
                : '-'),

        semester: row.semester || '-',

        reference: row.check_number || row.payout_entry_id,
        remarks: row.entry_remarks || row.batch_remarks || '',
        released_at: row.released_at || null,
        created_at: row.created_at,
    }));

    return { items };
}

module.exports = {
    getMyPayouts,
};