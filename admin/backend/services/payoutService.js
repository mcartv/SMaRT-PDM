const pool = require('../config/db');
const notificationService = require('./notificationService');

// =========================
// FETCH PAYOUT BATCHES
// =========================
async function fetchPayoutBatches() {
  const query = `
    SELECT
      pb.payout_batch_id,
      pb.opening_id,
      pb.program_id,
      pb.academic_year_id,
      pb.period_id,
      ay.label AS academic_year,
      ap.term AS semester,
      pb.payout_title,
      pb.payout_date,
      pb.payment_mode,
      pb.amount_per_scholar,
      pb.total_amount,
      pb.batch_status,
      pb.remarks,
      pb.created_at,
      pb.updated_at,
      pb.acknowledgement_status,
      pb.acknowledgement_sent_date,
      pb.acknowledgement_channel,
      pb.is_archived,

      sp.program_name,
      b.benefactor_name,

      COALESCE(
        json_agg(
          json_build_object(
            'payout_entry_id', pbs.payout_entry_id,
            'student_id', pbs.student_id,
            'program_id', pbs.program_id,
            'application_id', pbs.application_id,
            'amount_received', pbs.amount_received,
            'release_status', pbs.release_status,
            'academic_year_id', st.active_academic_year_id,
            'period_id', st.active_period_id,
            'academic_year', say.label,
            'semester', sap.term,
            'status', st.scholarship_status,
            'pdm_id', st.pdm_id,
            'student_name', CONCAT(st.last_name, ', ', st.first_name)
          )
        ) FILTER (WHERE pbs.payout_entry_id IS NOT NULL),
        '[]'::json
      ) AS scholars

    FROM payout_batches pb
    LEFT JOIN scholarship_program sp
      ON pb.program_id = sp.program_id
    LEFT JOIN benefactors b
      ON sp.benefactor_id = b.benefactor_id
    LEFT JOIN academic_years ay
      ON pb.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap
      ON pb.period_id = ap.period_id
    LEFT JOIN payout_batch_students pbs
      ON pb.payout_batch_id = pbs.payout_batch_id
    LEFT JOIN students st
      ON pbs.student_id = st.student_id
    LEFT JOIN academic_years say
      ON st.active_academic_year_id = say.academic_year_id
    LEFT JOIN academic_period sap
      ON st.active_period_id = sap.period_id

    GROUP BY
      pb.payout_batch_id,
      pb.opening_id,
      pb.program_id,
      pb.academic_year_id,
      pb.period_id,
      ay.label,
      ap.term,
      pb.payout_title,
      pb.payout_date,
      pb.payment_mode,
      pb.amount_per_scholar,
      pb.total_amount,
      pb.batch_status,
      pb.remarks,
      pb.created_at,
      pb.updated_at,
      pb.acknowledgement_status,
      pb.acknowledgement_sent_date,
      pb.acknowledgement_channel,
      pb.is_archived,
      sp.program_name,
      b.benefactor_name

    ORDER BY pb.created_at DESC;
  `;

  const { rows } = await pool.query(query);
  return rows;
}

// =========================
// FETCH OPENINGS
// =========================
async function fetchPayoutOpenings() {
  const query = `
    SELECT
      po.opening_id,
      po.program_id,
      po.created_at,
      po.opening_title,
      po.academic_year_id,
      po.period_id,
      ay.label AS academic_year,
      ap.term AS semester,
      po.per_scholar_amount AS amount_per_scholar,
      po.posting_status AS status,
      po.allocated_slots,
      po.filled_slots,
      sp.program_name,
      b.benefactor_name
    FROM program_openings po
    LEFT JOIN scholarship_program sp
      ON po.program_id = sp.program_id
    LEFT JOIN benefactors b
      ON sp.benefactor_id = b.benefactor_id
    LEFT JOIN academic_years ay
      ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap
      ON po.period_id = ap.period_id
    WHERE COALESCE(po.is_archived, FALSE) = FALSE
      AND LOWER(COALESCE(po.posting_status, '')) <> 'archived'
    ORDER BY po.created_at DESC;
  `;

  const { rows } = await pool.query(query);
  return rows;
}

// =========================
// FETCH ELIGIBLE STUDENTS BY OPENING
// =========================
async function fetchEligibleScholarsByOpening(openingId) {
  const openingQuery = `
    SELECT
      po.opening_id,
      po.program_id,
      po.opening_title,
      po.academic_year_id,
      po.period_id,
      ay.label AS academic_year,
      ap.term AS semester,
      po.per_scholar_amount AS amount_per_scholar,
      po.posting_status AS status,
      sp.program_name,
      b.benefactor_name
    FROM program_openings po
    LEFT JOIN scholarship_program sp
      ON po.program_id = sp.program_id
    LEFT JOIN benefactors b
      ON sp.benefactor_id = b.benefactor_id
    LEFT JOIN academic_years ay
      ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap
      ON po.period_id = ap.period_id
    WHERE po.opening_id = $1
      AND COALESCE(po.is_archived, FALSE) = FALSE
      AND LOWER(COALESCE(po.posting_status, '')) <> 'archived'
    LIMIT 1;
  `;

  const openingResult = await pool.query(openingQuery, [openingId]);

  if (!openingResult.rows.length) {
    throw new Error('Opening not found');
  }

  const opening = openingResult.rows[0];

  const scholarQuery = `
    SELECT
      st.student_id,
      st.current_program_id AS program_id,
      st.current_application_id AS application_id,
      st.active_academic_year_id AS academic_year_id,
      st.active_period_id AS period_id,
      say.label AS academic_year,
      sap.term AS semester,
      st.scholarship_status AS status,
      a.opening_id,
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name
    FROM students st
    INNER JOIN applications a
      ON st.current_application_id = a.application_id
    LEFT JOIN academic_years say
      ON st.active_academic_year_id = say.academic_year_id
    LEFT JOIN academic_period sap
      ON st.active_period_id = sap.period_id
    WHERE a.opening_id = $1
      AND a.application_status = 'Approved'
      AND COALESCE(st.scholar_is_archived, FALSE) = FALSE
      AND st.scholarship_status = 'Active'
    ORDER BY st.last_name, st.first_name;
  `;

  const scholarResult = await pool.query(scholarQuery, [openingId]);

  return {
    opening,
    scholars: scholarResult.rows.map((row) => ({
      ...row,
      scholar_id: row.student_id,
    })),
  };
}

// =========================
// CREATE PAYOUT BATCH
// =========================
async function createPayoutBatchFromOpening({
  opening_id,
  payout_title,
  payout_date,
  payment_mode,
  remarks,
  scholar_ids,
}) {
  if (!opening_id) {
    throw new Error('opening_id is required');
  }

  let uniqueStudentIds = Array.isArray(scholar_ids)
    ? [...new Set(scholar_ids.filter(Boolean))]
    : [];

  const openingQuery = `
    SELECT
      po.opening_id,
      po.program_id,
      po.opening_title,
      po.academic_year_id,
      po.period_id,
      ay.label AS academic_year,
      ap.term AS semester,
      po.per_scholar_amount AS amount_per_scholar,
      sp.program_name
    FROM program_openings po
    LEFT JOIN scholarship_program sp
      ON po.program_id = sp.program_id
    LEFT JOIN academic_years ay
      ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap
      ON po.period_id = ap.period_id
    WHERE po.opening_id = $1
      AND COALESCE(po.is_archived, FALSE) = FALSE
      AND LOWER(COALESCE(po.posting_status, '')) <> 'archived'
    LIMIT 1;
  `;

  const openingResult = await pool.query(openingQuery, [opening_id]);

  if (!openingResult.rows.length) {
    throw new Error('Opening not found');
  }

  const opening = openingResult.rows[0];

  const eligibleStudentQuery = `
    SELECT st.student_id
    FROM students st
    INNER JOIN applications a
      ON st.current_application_id = a.application_id
    WHERE a.opening_id = $1
      AND a.application_status = 'Approved'
      AND COALESCE(st.scholar_is_archived, FALSE) = FALSE
      AND st.scholarship_status = 'Active';
  `;

  const eligibleStudentResult = await pool.query(eligibleStudentQuery, [opening_id]);
  const eligibleStudentIdsArray = eligibleStudentResult.rows.map(
    (row) => row.student_id
  );

  if (!uniqueStudentIds.length) {
    uniqueStudentIds = eligibleStudentIdsArray;
  }

  if (!uniqueStudentIds.length) {
    throw new Error('No eligible scholars found for this opening');
  }

  const eligibleStudentIds = new Set(
    eligibleStudentResult.rows.map((row) => row.student_id)
  );

  const invalidStudentIds = uniqueStudentIds.filter(
    (id) => !eligibleStudentIds.has(id)
  );

  if (invalidStudentIds.length > 0) {
    throw new Error('One or more selected scholars do not belong to the selected opening');
  }

  const amount = Number(opening.amount_per_scholar || 0);
  const totalAmount = amount * uniqueStudentIds.length;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const batchResult = await client.query(
      `
      INSERT INTO payout_batches (
        opening_id,
        program_id,
        academic_year_id,
        period_id,
        payout_title,
        payout_date,
        payment_mode,
        amount_per_scholar,
        total_amount,
        batch_status,
        remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Draft', $10)
      RETURNING *;
      `,
      [
        opening.opening_id,
        opening.program_id,
        opening.academic_year_id,
        opening.period_id,
        payout_title || opening.opening_title || `${opening.program_name || 'Program'} Payout Batch`,
        payout_date || new Date().toISOString().slice(0, 10),
        payment_mode || 'Cash',
        amount,
        totalAmount,
        remarks || null,
      ]
    );

    const batch = batchResult.rows[0];

    for (const studentId of uniqueStudentIds) {
      const studentMetaResult = await client.query(
        `
        SELECT
          current_program_id AS program_id,
          current_application_id AS application_id
        FROM students
        WHERE student_id = $1
        LIMIT 1;
        `,
        [studentId]
      );

      const studentMeta = studentMetaResult.rows[0] || {};

      await client.query(
        `
        INSERT INTO payout_batch_students (
          payout_batch_id,
          student_id,
          program_id,
          application_id,
          amount_received,
          release_status
        )
        VALUES ($1, $2, $3, $4, $5, 'Pending')
        `,
        [
          batch.payout_batch_id,
          studentId,
          studentMeta.program_id || opening.program_id,
          studentMeta.application_id || null,
          amount,
        ]
      );
    }

    await client.query('COMMIT');
    try {
      const notifyResult = await pool.query(
        `
    SELECT
      st.user_id,
      st.first_name,
      st.last_name,
      pbs.amount_received,
      pb.payout_batch_id,
      pb.payout_title,
      pb.payout_date
    FROM payout_batch_students pbs
    INNER JOIN payout_batches pb
      ON pbs.payout_batch_id = pb.payout_batch_id
    INNER JOIN students st
      ON pbs.student_id = st.student_id
    WHERE pbs.payout_batch_id = $1
      AND st.user_id IS NOT NULL;
    `,
        [batch.payout_batch_id]
      );

      for (const row of notifyResult.rows) {
        const amount = Number(row.amount_received || 0).toLocaleString('en-PH', {
          style: 'currency',
          currency: 'PHP',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });

        await notificationService.createUserNotification({
          userId: row.user_id,
          type: 'payout_scheduled',
          title: 'Payout Scheduled',
          message: `Your scholarship payout of ${amount} has been scheduled. Please check the payout page for details.`,
          referenceId: String(row.payout_batch_id),
          referenceType: 'payout_batch',
        });
      }
    } catch (notifyError) {
      console.error('PAYOUT SCHEDULE NOTIFICATION ERROR:', notifyError);
    }
    return batch;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// =========================
// UPDATE STATUS
// =========================
async function updateScholarPayoutStatus({
  payout_entry_id,
  next_status,
  processed_by = null,
  remarks = null,
  check_number = null,
}) {
  if (!payout_entry_id) {
    const err = new Error('payout_entry_id is required');
    err.statusCode = 400;
    throw err;
  }

  const allowedStatuses = ['Pending', 'Released', 'Absent', 'On Hold', 'Cancelled'];

  if (!allowedStatuses.includes(next_status)) {
    const err = new Error(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const releasedAt = next_status === 'Released' ? new Date() : null;

  const updateQuery = `
    UPDATE payout_batch_students
    SET
      release_status = $1,
      released_at = $2,
      remarks = $3,
      check_number = $4,
      updated_at = NOW()
    WHERE payout_entry_id = $5
    RETURNING *;
  `;

  const { rows } = await pool.query(updateQuery, [
    next_status,
    releasedAt,
    remarks,
    check_number,
    payout_entry_id,
  ]);

  if (!rows.length) {
    const err = new Error('Payout entry not found');
    err.statusCode = 404;
    throw err;
  }

  const updated = rows[0];

  // 🔔 SEND NOTIFICATION (uses SAME DB flow)
  if (next_status === 'Released') {
    try {
      const userQuery = `
        SELECT user_id, first_name
        FROM students
        WHERE student_id = $1
        LIMIT 1;
      `;

      const userResult = await pool.query(userQuery, [updated.student_id]);

      if (userResult.rows.length) {
        const user = userResult.rows[0];

        const amount = Number(updated.amount_received || 0).toLocaleString('en-PH', {
          style: 'currency',
          currency: 'PHP',
        });

        await notificationService.createUserNotification({
          userId: user.user_id,
          type: 'payout_released',
          title: 'Payout Released',
          message: `Your scholarship payout of ${amount} has been released.`,
          referenceId: String(updated.payout_batch_id),
          referenceType: 'payout_batch',
        });
      }
    } catch (notifyError) {
      console.error('PAYOUT RELEASE NOTIFICATION ERROR:', notifyError);
    }
  }

  return updated;
}

// =========================
// ARCHIVE PAYOUT BATCH
// =========================
async function archivePayoutBatch({ payout_batch_id, archived_by }) {
  if (!payout_batch_id) {
    throw new Error('payout_batch_id is required');
  }

  const batchQuery = `
    SELECT
      pb.payout_batch_id,
      pb.payout_title,
      pb.batch_status,
      pb.is_archived
    FROM payout_batches pb
    WHERE pb.payout_batch_id = $1
    LIMIT 1;
  `;

  const batchResult = await pool.query(batchQuery, [payout_batch_id]);

  if (!batchResult.rows.length) {
    const err = new Error('Payout batch not found');
    err.statusCode = 404;
    throw err;
  }

  const batch = batchResult.rows[0];

  if (batch.is_archived) {
    const err = new Error('Payout batch is already archived');
    err.statusCode = 400;
    throw err;
  }

  const entriesQuery = `
    SELECT
      payout_entry_id,
      release_status
    FROM payout_batch_students
    WHERE payout_batch_id = $1;
  `;

  const entriesResult = await pool.query(entriesQuery, [payout_batch_id]);
  const entries = entriesResult.rows || [];

  if (!entries.length) {
    const err = new Error('Cannot archive a payout batch with no payout entries');
    err.statusCode = 400;
    throw err;
  }

  const hasPending = entries.some(
    (entry) => !entry.release_status || entry.release_status === 'Pending'
  );

  if (hasPending) {
    const err = new Error('Cannot archive payout batch while some scholars are still pending');
    err.statusCode = 400;
    throw err;
  }

  const updateQuery = `
    UPDATE payout_batches
    SET
      is_archived = TRUE,
      batch_status = 'Archived',
      updated_at = NOW()
    WHERE payout_batch_id = $1
    RETURNING *;
  `;

  const updateResult = await pool.query(updateQuery, [payout_batch_id]);

  return {
    success: true,
    message: 'Payout batch archived successfully',
    batch: updateResult.rows[0],
  };
}

async function fetchAcademicYears() {
  const query = `
    SELECT
      academic_year_id,
      start_year,
      end_year,
      label,
      is_active
    FROM academic_years
    ORDER BY start_year DESC;
  `;

  const { rows } = await pool.query(query);
  return rows;
}

module.exports = {
  fetchPayoutBatches,
  fetchPayoutOpenings,
  fetchEligibleScholarsByOpening,
  createPayoutBatchFromOpening,
  updateScholarPayoutStatus,
  archivePayoutBatch,
  fetchAcademicYears,
};