const pool = require('../config/db');
const notificationService = require('./notificationService');

const REQUIRED_REVIEW_KEYS = Object.freeze([
  'certificate_of_registration',
  'student_grade_forms',
  'certificate_of_indigency',
  'letter_of_request',
  'application_form',
]);

const REQUIRED_UPLOAD_NAMES = Object.freeze([
  'certificate of registration',
  'student grade forms',
  'grade report',
  'certificate of indigency',
  'letter of request',
]);

function httpError(statusCode, message, code = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function actorUserId(actor = {}) {
  return actor.user_id || actor.userId || actor.sub || actor.id || null;
}

function normalizeLimit(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function validateApplicantGwa(gwa, threshold = null) {
  const numericGwa = Number(gwa);
  if (!Number.isFinite(numericGwa) || numericGwa < 1 || numericGwa > 5) {
    throw httpError(409, 'A valid GWA from 1.00 to 5.00 is required before selection.');
  }

  const numericThreshold = Number(threshold);
  if (Number.isFinite(numericThreshold) && numericThreshold >= 1 && numericThreshold <= 5) {
    // PDM uses the Philippine grading scale where a lower GWA is better.
    if (numericGwa > numericThreshold) {
      throw httpError(
        409,
        `Applicant GWA ${numericGwa.toFixed(2)} does not meet the required ${numericThreshold.toFixed(2)} threshold.`
      );
    }
  }
  return numericGwa;
}

function applicationName(row = {}) {
  return [row.first_name, row.middle_name, row.last_name]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getOpeningForUpdate(client, openingId) {
  const result = await client.query(
    `
      SELECT
        po.*,
        sp.program_name,
        sp.gwa_threshold,
        ay.label AS academic_year,
        ap.term AS semester,
        ap.is_active AS period_is_active
      FROM program_openings po
      LEFT JOIN scholarship_program sp ON sp.program_id = po.program_id
      LEFT JOIN academic_years ay ON ay.academic_year_id = po.academic_year_id
      LEFT JOIN academic_period ap ON ap.period_id = po.period_id
      WHERE po.opening_id = $1
      LIMIT 1
      FOR UPDATE OF po
    `,
    [openingId]
  );

  if (!result.rows.length) {
    throw httpError(404, 'Scholarship record not found.', 'OPENING_NOT_FOUND');
  }

  return result.rows[0];
}

async function countOccupiedSlots(client, openingId) {
  const result = await client.query(
    `
      SELECT COUNT(*)::int AS occupied_count
      FROM applications a
      INNER JOIN students st
        ON st.current_application_id = a.application_id
      WHERE a.opening_id = $1
        AND lower(COALESCE(a.application_status, '')) = 'approved'
        AND COALESCE(st.is_active_scholar, false) = true
        AND lower(COALESCE(st.scholarship_status, '')) = 'active'
        AND COALESCE(st.scholar_is_archived, false) = false
    `,
    [openingId]
  );

  return Number(result.rows[0]?.occupied_count || 0);
}

async function getQualifiedQueue(client, openingId, { forUpdate = false } = {}) {
  const lockClause = forUpdate ? 'FOR UPDATE OF a' : '';
  const result = await client.query(
    `
      SELECT
        a.application_id,
        a.student_id,
        a.program_id,
        a.opening_id,
        a.application_status,
        a.document_status,
        a.verification_status,
        a.selection_status,
        a.queue_position,
        a.waitlist_position,
        a.fcfs_completed_at,
        a.submission_date,
        a.requirements_completed_at,
        a.requirements_verified_at,
        a.remarks,
        st.user_id,
        st.pdm_id,
        st.first_name,
        st.middle_name,
        st.last_name,
        st.year_level,
        st.gwa,
        ac.course_code,
        ac.course_name,
        es.overall_status AS endorsement_status
      FROM applications a
      INNER JOIN students st ON st.student_id = a.student_id
      LEFT JOIN academic_course ac ON ac.course_id = st.course_id
      INNER JOIN endorsement_slips es ON es.application_id = a.application_id
      WHERE a.opening_id = $1
        AND COALESCE(a.is_archived, false) = false
        AND COALESCE(a.is_disqualified, false) = false
        AND lower(COALESCE(a.application_status, '')) NOT IN ('approved', 'rejected', 'disqualified')
        AND lower(COALESCE(a.verification_status, '')) = 'verified'
        AND lower(COALESCE(es.overall_status, '')) = 'completed'
        AND a.queue_position IS NOT NULL
      ORDER BY
        a.queue_position ASC,
        a.fcfs_completed_at ASC NULLS LAST,
        a.application_id ASC
      ${lockClause}
    `,
    [openingId]
  );

  return result.rows.map((row) => ({
    ...row,
    applicant_name: applicationName(row),
    queue_position: Number(row.queue_position),
  }));
}

function partitionQueue(queue, opening, occupiedBefore) {
  const capacity = Math.max(0, Number(opening.allocated_slots || 0));
  const availableSlots = Math.max(0, capacity - occupiedBefore);
  const waitingEnabled = opening.waiting_list_enabled !== false;
  const waitingLimit = normalizeLimit(opening.waiting_list_limit, 0);

  let waitlistCounter = 0;
  const entries = queue.map((row, index) => {
    if (index < availableSlots) {
      return { ...row, decision: 'Selected', waitlist_position: null };
    }

    if (waitingEnabled && (waitingLimit === 0 || waitlistCounter < waitingLimit)) {
      waitlistCounter += 1;
      return {
        ...row,
        decision: 'Waitlisted',
        waitlist_position: waitlistCounter,
      };
    }

    return { ...row, decision: 'Not Selected', waitlist_position: null };
  });

  return {
    capacity,
    occupied_before: occupiedBefore,
    available_slots: availableSlots,
    selected_count: entries.filter((entry) => entry.decision === 'Selected').length,
    waitlisted_count: entries.filter((entry) => entry.decision === 'Waitlisted').length,
    not_selected_count: entries.filter((entry) => entry.decision === 'Not Selected').length,
    entries,
  };
}

async function persistQueuePositions(client, entries) {
  for (const entry of entries) {
    await client.query(
      `
        UPDATE applications
        SET queue_position = $2,
            waitlist_position = $3,
            requirements_completed_at = COALESCE(requirements_completed_at, $4),
            selection_status = CASE
              WHEN selection_status IN ('Selected', 'Waitlisted', 'Promoted', 'Not Selected')
                THEN selection_status
              ELSE 'Qualified'
            END
        WHERE application_id = $1
      `,
      [
        entry.application_id,
        entry.queue_position,
        entry.waitlist_position,
        entry.requirements_completed_at,
      ]
    );
  }
}

async function getLatestFinalizedBatch(client, openingId) {
  const result = await client.query(
    `
      SELECT *
      FROM application_selection_batches
      WHERE opening_id = $1
        AND status = 'Finalized'
      ORDER BY finalized_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    [openingId]
  );
  return result.rows[0] || null;
}

async function getBatchEntries(client, selectionBatchId) {
  const result = await client.query(
    `
      SELECT
        ase.*,
        st.pdm_id,
        st.first_name,
        st.middle_name,
        st.last_name,
        st.year_level,
        st.gwa,
        ac.course_code,
        ac.course_name
      FROM application_selection_entries ase
      INNER JOIN students st ON st.student_id = ase.student_id
      LEFT JOIN academic_course ac ON ac.course_id = st.course_id
      WHERE ase.selection_batch_id = $1
      ORDER BY ase.queue_position ASC
    `,
    [selectionBatchId]
  );

  return result.rows.map((row) => ({
    ...row,
    applicant_name: applicationName(row),
  }));
}

async function getSelectionPreview(openingId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const opening = await getOpeningForUpdate(client, openingId);
    const finalizedBatch = await getLatestFinalizedBatch(client, openingId);

    if (finalizedBatch) {
      const entries = await getBatchEntries(client, finalizedBatch.selection_batch_id);
      await client.query('COMMIT');
      return {
        finalized: true,
        opening,
        batch: finalizedBatch,
        summary: {
          capacity: Number(finalizedBatch.slot_capacity || 0),
          occupied_before: Number(finalizedBatch.occupied_before || 0),
          available_slots: Number(finalizedBatch.available_slots || 0),
          qualified_count: Number(finalizedBatch.qualified_count || 0),
          selected_count: Number(finalizedBatch.selected_count || 0),
          waitlisted_count: Number(finalizedBatch.waitlisted_count || 0),
          not_selected_count: entries.filter((item) => item.decision === 'Not Selected').length,
        },
        entries,
      };
    }

    const occupiedBefore = await countOccupiedSlots(client, openingId);
    const queue = await getQualifiedQueue(client, openingId);
    const partitioned = partitionQueue(queue, opening, occupiedBefore);
    await persistQueuePositions(client, partitioned.entries);
    await client.query('COMMIT');

    return {
      finalized: false,
      opening,
      batch: null,
      summary: {
        capacity: partitioned.capacity,
        occupied_before: partitioned.occupied_before,
        available_slots: partitioned.available_slots,
        qualified_count: queue.length,
        selected_count: partitioned.selected_count,
        waitlisted_count: partitioned.waitlisted_count,
        not_selected_count: partitioned.not_selected_count,
      },
      entries: partitioned.entries,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function markApplicationQualified(applicationId, actor = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        SELECT
          a.application_id,
          a.student_id,
          a.opening_id,
          a.verification_status,
          a.is_disqualified,
          es.overall_status AS endorsement_status,
          st.gwa,
          sp.gwa_threshold
        FROM applications a
        LEFT JOIN endorsement_slips es ON es.application_id = a.application_id
        LEFT JOIN students st ON st.student_id = a.student_id
        LEFT JOIN scholarship_program sp ON sp.program_id = a.program_id
        WHERE a.application_id = $1
        LIMIT 1
        FOR UPDATE OF a
      `,
      [applicationId]
    );

    const application = result.rows[0];
    if (!application) throw httpError(404, 'Application not found.');
    if (application.is_disqualified) throw httpError(409, 'Disqualified applications cannot be qualified.');
    if (String(application.verification_status || '').toLowerCase() !== 'verified') {
      throw httpError(409, 'Complete document verification before marking this applicant qualified.');
    }
    if (String(application.endorsement_status || '').toLowerCase() !== 'completed') {
      throw httpError(409, 'Complete the endorsement workflow before marking this applicant qualified.');
    }

    validateApplicantGwa(application.gwa, application.gwa_threshold);

    const updated = await client.query(
      `
        UPDATE applications
        SET selection_status = 'Qualified',
            requirements_verified_at = COALESCE(requirements_verified_at, now()),
            evaluator_id = COALESCE(evaluator_id, (
              SELECT admin_id FROM admin_profiles WHERE user_id = $2 LIMIT 1
            ))
        WHERE application_id = $1
        RETURNING *
      `,
      [applicationId, actorUserId(actor)]
    );

    const opening = await getOpeningForUpdate(client, application.opening_id);
    const occupiedBefore = await countOccupiedSlots(client, application.opening_id);
    const queue = await getQualifiedQueue(client, application.opening_id, { forUpdate: true });
    const partitioned = partitionQueue(queue, opening, occupiedBefore);
    await persistQueuePositions(client, partitioned.entries);

    await client.query('COMMIT');
    return {
      application: updated.rows[0],
      queue_position: partitioned.entries.find((item) => item.application_id === applicationId)?.queue_position || null,
      message: 'Applicant marked as qualified and placed in the FCFS queue.',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function notifySelectionResults(entries, opening) {
  await Promise.allSettled(
    entries
      .filter((entry) => entry.user_id)
      .map((entry) => {
        const referenceId = entry.application_id;
        if (entry.decision === 'Selected') {
          return notificationService.createUserNotification({
            userId: entry.user_id,
            type: 'application_selected',
            title: 'Scholarship Selection Confirmed',
            message: `A scholarship slot for ${opening.program_name || 'the scholarship program'} has been reserved for you. Final scholar activation is still pending administrator confirmation.`,
            referenceId,
            referenceType: 'application',
          });
        }
        if (entry.decision === 'Waitlisted') {
          return notificationService.createUserNotification({
            userId: entry.user_id,
            type: 'application_waitlisted',
            title: 'Placed on the Waiting List',
            message: `You are waiting-list position ${entry.waitlist_position}. You will be notified if a slot becomes available.`,
            referenceId,
            referenceType: 'application',
          });
        }
        return notificationService.createUserNotification({
          userId: entry.user_id,
          type: 'application_not_selected',
          title: 'Scholarship Selection Result',
          message: 'You were not selected for this application period. You may apply again when another eligible scholarship becomes available.',
          referenceId,
          referenceType: 'application',
        });
      })
  );
}

async function finalizeSelection(openingId, actor = {}, notes = '') {
  const userId = actorUserId(actor);
  if (!userId) throw httpError(401, 'Authenticated Admin account is required.');

  const client = await pool.connect();
  let notificationEntries = [];
  let notificationOpening = null;

  try {
    await client.query('BEGIN');
    const opening = await getOpeningForUpdate(client, openingId);
    const existingBatch = await getLatestFinalizedBatch(client, openingId);
    if (existingBatch) {
      const entries = await getBatchEntries(client, existingBatch.selection_batch_id);
      await client.query('COMMIT');
      return {
        finalized: true,
        already_finalized: true,
        opening,
        batch: existingBatch,
        entries,
      };
    }

    const occupiedBefore = await countOccupiedSlots(client, openingId);
    const queue = await getQualifiedQueue(client, openingId, { forUpdate: true });
    queue.forEach((entry) => validateApplicantGwa(entry.gwa, opening.gwa_threshold));
    if (!queue.length) {
      throw httpError(409, 'No qualified applicants are ready for final selection.');
    }

    const partitioned = partitionQueue(queue, opening, occupiedBefore);

    const openingStatus = String(opening.posting_status || '')
      .trim()
      .toLowerCase();

    // Keep the semester opening active until its remaining scholarship slots
    // are filled. The Admin can still manually close an underfilled opening,
    // and a semester/year transition will close it automatically.
    if (
      openingStatus === 'open' &&
      partitioned.available_slots > partitioned.selected_count
    ) {
      const stillAvailable =
        partitioned.available_slots - partitioned.selected_count;

      throw httpError(
        409,
        `This opening still has ${stillAvailable} available scholarship slot${stillAvailable === 1 ? '' : 's'}. Keep the opening active for more eligible applicants, or close it manually before finalizing early.`,
        'OPENING_STILL_HAS_AVAILABLE_SLOTS'
      );
    }

    const batchResult = await client.query(
      `
        INSERT INTO application_selection_batches (
          opening_id,
          status,
          slot_capacity,
          occupied_before,
          available_slots,
          qualified_count,
          selected_count,
          waitlisted_count,
          created_by,
          finalized_by,
          finalized_at,
          notes
        )
        VALUES ($1, 'Finalized', $2, $3, $4, $5, $6, $7, $8, $8, now(), $9)
        RETURNING *
      `,
      [
        openingId,
        partitioned.capacity,
        partitioned.occupied_before,
        partitioned.available_slots,
        queue.length,
        partitioned.selected_count,
        partitioned.waitlisted_count,
        userId,
        String(notes || '').trim() || null,
      ]
    );
    const batch = batchResult.rows[0];

    for (const entry of partitioned.entries) {
      await client.query(
        `
          INSERT INTO application_selection_entries (
            selection_batch_id,
            opening_id,
            application_id,
            student_id,
            queue_position,
            decision,
            requirements_completed_at,
            submission_date,
            finalized_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
        `,
        [
          batch.selection_batch_id,
          openingId,
          entry.application_id,
          entry.student_id,
          entry.queue_position,
          entry.decision,
          entry.requirements_completed_at,
          entry.submission_date,
        ]
      );

      const isSelected = entry.decision === 'Selected';
      const isWaitlisted = entry.decision === 'Waitlisted';
      await client.query(
        `
          UPDATE applications
          SET selection_status = CASE
                WHEN $2 = 'Selected' THEN 'Reserved'
                ELSE $2
              END,
              selection_batch_id = $3,
              queue_position = $4,
              waitlist_position = $5,
              selected_at = CASE WHEN $2 = 'Selected' THEN now() ELSE selected_at END,
              waitlisted_at = CASE WHEN $2 = 'Waitlisted' THEN now() ELSE waitlisted_at END,
              not_selected_at = CASE WHEN $2 = 'Not Selected' THEN now() ELSE not_selected_at END,
              finalized_at = now(),
              finalized_by = $6,
              activation_status = 'Not Activated',
              activated_at = NULL,
              can_reapply = CASE WHEN $2 = 'Not Selected' THEN true ELSE false END,
              reapplication_reason = CASE
                WHEN $2 = 'Not Selected' THEN 'Not selected because available slots were already assigned.'
                ELSE NULL
              END,
              application_status = CASE
                WHEN $2 = 'Not Selected' THEN 'Rejected'
                ELSE application_status
              END,
              rejection_reason = CASE
                WHEN $2 = 'Not Selected' THEN 'Not selected due to slot availability.'
                ELSE rejection_reason
              END,
              is_disqualified = CASE WHEN $2 = 'Not Selected' THEN false ELSE is_disqualified END
          WHERE application_id = $1
        `,
        [
          entry.application_id,
          entry.decision,
          batch.selection_batch_id,
          entry.queue_position,
          entry.waitlist_position,
          userId,
        ]
      );

      // Final selection reserves a slot only. Scholar/account activation
      // remains the explicit action in the Readiness workflow.
    }

        const filledSlots = partitioned.occupied_before;
    await client.query(
      `
        UPDATE program_openings
        SET filled_slots = LEAST(allocated_slots, $2),
            selection_status = 'Finalized',
            selection_started_at = COALESCE(selection_started_at, now()),
            selection_finalized_at = now(),
            selection_finalized_by = $3,
            posting_status = 'closed',
            updated_at = now()
        WHERE opening_id = $1
      `,
      [openingId, filledSlots, userId]
    );

    await client.query('COMMIT');
    notificationEntries = partitioned.entries;
    notificationOpening = opening;

    await notifySelectionResults(notificationEntries, notificationOpening);

    return {
      finalized: true,
      already_finalized: false,
      opening,
      batch,
      summary: {
        capacity: partitioned.capacity,
        occupied_before: partitioned.occupied_before,
        available_slots: partitioned.available_slots,
        qualified_count: queue.length,
        selected_count: partitioned.selected_count,
        waitlisted_count: partitioned.waitlisted_count,
        not_selected_count: partitioned.not_selected_count,
      },
      entries: partitioned.entries,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function promoteNextWaitlisted({
  openingId,
  releasedStudentId = null,
  actor = {},
  reason = 'A scholarship slot became available.',
  client: externalClient = null,
} = {}) {
  const ownClient = !externalClient;
  const client = externalClient || (await pool.connect());
  const userId = actorUserId(actor);

  try {
    if (ownClient) await client.query('BEGIN');
    const opening = await getOpeningForUpdate(client, openingId);
    if (opening.waiting_list_enabled === false) {
      if (ownClient) await client.query('COMMIT');
      return { promoted: false, reason: 'Waiting list is disabled.' };
    }

    const nextResult = await client.query(
      `
        SELECT
          a.*,
          st.user_id,
          st.first_name,
          st.middle_name,
          st.last_name
        FROM applications a
        INNER JOIN students st ON st.student_id = a.student_id
        WHERE a.opening_id = $1
          AND a.selection_status = 'Waitlisted'
          AND lower(COALESCE(a.application_status, '')) NOT IN ('approved', 'rejected')
          AND COALESCE(a.is_disqualified, false) = false
        ORDER BY
          a.waitlist_position ASC NULLS LAST,
          a.requirements_completed_at ASC NULLS LAST,
          a.submission_date ASC NULLS LAST,
          a.application_id ASC
        LIMIT 1
        FOR UPDATE OF a
      `,
      [openingId]
    );

    const next = nextResult.rows[0];
    if (!next) {
      if (ownClient) await client.query('COMMIT');
      return { promoted: false, reason: 'No eligible waiting applicant is available.' };
    }

    const previousPosition = next.waitlist_position;
    // Promotion reserves the newly available slot but does NOT activate the
    // student automatically. The coordinator still performs the explicit
    // Activate Scholar action from Readiness.
    await client.query(
      `
        UPDATE applications
        SET selection_status = 'Promoted',
            activation_status = 'Not Activated',
            activated_at = NULL,
            selected_at = COALESCE(selected_at, now()),
            waitlist_position = NULL,
            can_reapply = false,
            reapplication_reason = NULL,
            rejection_reason = NULL,
            is_disqualified = false,
            updated_at = now()
        WHERE application_id = $1
      `,
      [next.application_id]
    );

    await client.query(
      `
        UPDATE application_selection_entries
        SET decision = 'Promoted',
            promoted_at = now(),
            promotion_reason = $2
        WHERE application_id = $1
          AND decision = 'Waitlisted'
      `,
      [next.application_id, reason]
    );

    await client.query(
      `
        INSERT INTO waiting_list_promotions (
          opening_id,
          application_id,
          student_id,
          selection_batch_id,
          released_student_id,
          promoted_by,
          reason,
          previous_waitlist_position
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        openingId,
        next.application_id,
        next.student_id,
        next.selection_batch_id,
        releasedStudentId,
        userId,
        reason,
        previousPosition,
      ]
    );

    await client.query(
      `
        UPDATE applications
        SET waitlist_position = waitlist_position - 1
        WHERE opening_id = $1
          AND selection_status = 'Waitlisted'
          AND waitlist_position > $2
      `,
      [openingId, previousPosition]
    );

    const occupied = await countOccupiedSlots(client, openingId);
    await client.query(
      `
        UPDATE program_openings
        SET filled_slots = LEAST(allocated_slots, $2),
            updated_at = now()
        WHERE opening_id = $1
      `,
      [openingId, occupied]
    );

    if (ownClient) await client.query('COMMIT');

    if (next.user_id) {
      await notificationService.createUserNotification({
        userId: next.user_id,
        type: 'waitlist_promoted',
        title: 'Scholarship Slot Available',
        message: `You were promoted from the waiting list for ${opening.program_name || 'the scholarship program'}. Your slot is now reserved and awaits final scholar activation.`,
        referenceId: next.application_id,
        referenceType: 'application',
      }).catch((error) => console.error('WAITLIST PROMOTION NOTIFICATION ERROR:', error.message));
    }

    return {
      promoted: true,
      application_id: next.application_id,
      student_id: next.student_id,
      applicant_name: applicationName(next),
      previous_waitlist_position: previousPosition,
    };
  } catch (error) {
    if (ownClient) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (ownClient) client.release();
  }
}

async function releaseScholarSlotAndPromote({ studentId, actor = {}, reason, notes = '' }) {
  const client = await pool.connect();
  let promotionResult = null;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        SELECT
          st.student_id,
          st.user_id,
          st.current_application_id,
          st.current_program_id,
          st.is_active_scholar,
          st.scholarship_status,
          st.scholar_is_archived,
          a.opening_id,
          a.application_id,
          a.application_status
        FROM students st
        LEFT JOIN applications a ON a.application_id = st.current_application_id
        WHERE st.student_id = $1
        LIMIT 1
        FOR UPDATE OF st
      `,
      [studentId]
    );
    const scholar = result.rows[0];
    if (!scholar) throw httpError(404, 'Scholar not found.');
    if (!scholar.opening_id) throw httpError(409, 'Scholar has no active scholarship slot to release.');
    const hasActivePrivilege =
      scholar.is_active_scholar === true &&
      String(scholar.scholarship_status || '').trim().toLowerCase() === 'active' &&
      scholar.scholar_is_archived !== true &&
      String(scholar.application_status || '').trim().toLowerCase() === 'approved';
    if (!hasActivePrivilege) {
      throw httpError(409, 'This scholar privilege was already removed or has no occupied opening slot.');
    }

    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) {
      throw httpError(400, 'A removal reason is required.');
    }
    // Keep one clear lifecycle state. Graduation, withdrawal, inactivity, and
    // disciplinary removal remain distinguishable through the required reason
    // instead of creating several meanings for an archived scholar record.
    const status = 'Removed';
    await getOpeningForUpdate(client, scholar.opening_id);
    const occupiedBefore = await countOccupiedSlots(client, scholar.opening_id);

    await client.query(
      `
        UPDATE students
        SET is_active_scholar = false,
            scholarship_status = $2,
            scholar_is_archived = true,
            scholar_archived_at = now(),
            scholar_removal_reason = $3,
            scholar_removal_notes = $4,
            scholar_removed_by = $5,
            updated_at = now()
        WHERE student_id = $1
      `,
      [studentId, status, normalizedReason, String(notes || '').trim() || null, actorUserId(actor)]
    );

    promotionResult = await promoteNextWaitlisted({
      openingId: scholar.opening_id,
      releasedStudentId: studentId,
      actor,
      reason: `Promoted after a slot was released: ${normalizedReason}`,
      client,
    });

    // Always reconcile the stored slot count from actual active scholar rows.
    // This prevents stale counts after remove + automatic replacement.
    const occupiedAfter = await countOccupiedSlots(client, scholar.opening_id);
    const allocatedCapacity = Math.max(0, Number(opening.allocated_slots || 0));
    const openingWasFull = allocatedCapacity > 0 && occupiedBefore >= allocatedCapacity;
    const releasedSlotStillAvailable =
      promotionResult?.promoted !== true && occupiedAfter < allocatedCapacity;
    const shouldReopenOpening =
      openingWasFull &&
      releasedSlotStillAvailable &&
      opening.period_is_active === true &&
      opening.is_archived !== true &&
      String(opening.posting_status || '').trim().toLowerCase() === 'closed';

    const openingResult = await client.query(
      `
        UPDATE program_openings
        SET filled_slots = LEAST(allocated_slots, $2),
            posting_status = CASE
              WHEN $3::boolean THEN 'open'
              ELSE posting_status
            END,
            updated_at = now()
        WHERE opening_id = $1
        RETURNING opening_id, allocated_slots, filled_slots, posting_status, updated_at
      `,
      [scholar.opening_id, occupiedAfter, shouldReopenOpening]
    );
    const updatedOpening = openingResult.rows[0];
    if (!updatedOpening) {
      throw httpError(404, 'Scholarship opening not found while releasing its slot.');
    }
    const allocatedSlots = Math.max(0, Number(updatedOpening.allocated_slots || 0));
    const filledSlots = Math.max(0, Number(updatedOpening.filled_slots || 0));

    await client.query('COMMIT');
    return {
      released: true,
      student_id: studentId,
      user_id: scholar.user_id || null,
      opening_id: scholar.opening_id,
      scholar_status: status,
      removal_reason: normalizedReason,
      promotion: promotionResult,
      slot_counts: {
        allocated_slots: allocatedSlots,
        filled_slots_before: Math.max(0, Number(occupiedBefore || 0)),
        filled_slots: filledSlots,
        available_slots: Math.max(0, allocatedSlots - filledSlots),
        released_slots: Math.max(0, Number(occupiedBefore || 0) - filledSlots),
      },
      opening: {
        ...updatedOpening,
        allocated_slots: allocatedSlots,
        filled_slots: filledSlots,
        remaining_slots: Math.max(0, allocatedSlots - filledSlots),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getSelectionPreview,
  markApplicationQualified,
  finalizeSelection,
  promoteNextWaitlisted,
  releaseScholarSlotAndPromote,
};
