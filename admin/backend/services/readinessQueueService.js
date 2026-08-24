const pool = require('../config/db');

function safeUuid(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

/**
 * FCFS rules
 * -----------
 * 1. An applicant enters the queue only after BOTH:
 *    - applications.verification_status = verified
 *    - endorsement_slips.overall_status = completed
 * 2. fcfs_completed_at is the later of those two completion timestamps.
 * 3. queue_position is the current operational FCFS position among active eligible
 *    applicants only. It is compacted to 1..N whenever the opening queue is synchronized.
 *    Archived/tombstoned, approved/activated, rejected, and disqualified applications
 *    do not occupy an operational queue number.
 * 4. Reserved vs Waiting List is recalculated from the opening capacity and currently
 *    activated scholars. Activating a scholar consumes a slot; it does NOT free one.
 * 5. waitlist_position is dynamic and may change when the active queue changes.
 */
async function syncOpeningFcfsQueue(openingId) {
  const normalizedOpeningId = safeUuid(openingId);
  if (!normalizedOpeningId) return [];

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const openingResult = await client.query(
      `
        SELECT opening_id, allocated_slots
        FROM program_openings
        WHERE opening_id = $1::uuid
        FOR UPDATE
      `,
      [normalizedOpeningId]
    );

    if (!openingResult.rows.length) {
      await client.query('COMMIT');
      return [];
    }

    const capacity = Math.max(0, Number(openingResult.rows[0].allocated_slots || 0));

    // Lock currently eligible applicants and calculate their immutable ready timestamp.
    const eligibleResult = await client.query(
      `
        SELECT
          a.application_id,
          a.queue_position,
          a.selection_status,
          a.fcfs_completed_at,
          GREATEST(
            COALESCE(a.requirements_verified_at, a.updated_at, a.submission_date, a.created_at),
            COALESCE(es.completed_at, es.updated_at, a.updated_at, a.submission_date, a.created_at)
          ) AS ready_at
        FROM applications a
        INNER JOIN endorsement_slips es
          ON es.application_id = a.application_id
        WHERE a.opening_id = $1::uuid
          AND COALESCE(a.is_archived, false) = false
          AND COALESCE(a.is_disqualified, false) = false
          AND LOWER(COALESCE(a.application_status, '')) NOT IN ('approved', 'rejected', 'disqualified')
          AND LOWER(COALESCE(a.verification_status, '')) = 'verified'
          AND LOWER(COALESCE(es.overall_status, '')) = 'completed'
        ORDER BY
          GREATEST(
            COALESCE(a.requirements_verified_at, a.updated_at, a.submission_date, a.created_at),
            COALESCE(es.completed_at, es.updated_at, a.updated_at, a.submission_date, a.created_at)
          ) ASC,
          a.submission_date ASC NULLS LAST,
          a.created_at ASC,
          a.application_id ASC
        FOR UPDATE OF a
      `,
      [normalizedOpeningId]
    );

    const eligible = eligibleResult.rows;

    // queue_position represents the CURRENT active operational queue.
    // The eligible query above already removes archived/tombstoned,
    // activated/approved, rejected, and disqualified applications.
    // Re-number the remaining queue contiguously while preserving FCFS order
    // through the immutable fcfs_completed_at/ready_at ordering.
    for (let index = 0; index < eligible.length; index += 1) {
      const row = eligible[index];
      const queuePosition = index + 1;

      await client.query(
        `
          UPDATE applications
          SET
            fcfs_completed_at = COALESCE(fcfs_completed_at, $2::timestamptz),
            queue_position = $3::integer,
            requirements_verified_at = COALESCE(requirements_verified_at, $2::timestamptz),
            updated_at = now()
          WHERE application_id = $1::uuid
            AND (
              queue_position IS DISTINCT FROM $3::integer
              OR fcfs_completed_at IS NULL
              OR requirements_verified_at IS NULL
            )
        `,
        [row.application_id, row.ready_at, queuePosition]
      );
    }

    // Activated scholars continue occupying scholarship slots even though they are
    // intentionally removed from the Readiness work queue.
    const occupiedResult = await client.query(
      `
        SELECT COUNT(*)::int AS occupied_count
        FROM applications a
        INNER JOIN students st
          ON st.current_application_id = a.application_id
        WHERE a.opening_id = $1::uuid
          AND LOWER(COALESCE(a.application_status, '')) = 'approved'
          AND COALESCE(st.is_active_scholar, false) = true
          AND LOWER(COALESCE(st.scholarship_status, '')) = 'active'
          AND COALESCE(st.scholar_is_archived, false) = false
      `,
      [normalizedOpeningId]
    );

    const occupiedSlots = Number(occupiedResult.rows[0]?.occupied_count || 0);
    const openingIsFull = capacity > 0 && occupiedSlots >= capacity;

    // Scholarship opening lifecycle:
    // - active scholars continue occupying their awarded slots;
    // - reaching capacity closes the opening to NEW applications;
    // - closing does not archive the opening or its waiting list.
    await client.query(
      `
        UPDATE program_openings
        SET
          filled_slots = LEAST(allocated_slots, $2::integer),
          posting_status = CASE
            WHEN $3::boolean
             AND LOWER(COALESCE(posting_status, '')) = 'open'
              THEN 'closed'
            ELSE posting_status
          END,
          updated_at = CASE
            WHEN filled_slots IS DISTINCT FROM LEAST(allocated_slots, $2::integer)
              OR (
                $3::boolean
                AND LOWER(COALESCE(posting_status, '')) = 'open'
              )
              THEN now()
            ELSE updated_at
          END
        WHERE opening_id = $1::uuid
      `,
      [normalizedOpeningId, occupiedSlots, openingIsFull]
    );

    const reservableSlots = Math.max(0, capacity - occupiedSlots);

    const queueResult = await client.query(
      `
        SELECT
          a.application_id,
          a.queue_position,
          a.fcfs_completed_at,
          a.selection_status
        FROM applications a
        INNER JOIN endorsement_slips es
          ON es.application_id = a.application_id
        WHERE a.opening_id = $1::uuid
          AND COALESCE(a.is_archived, false) = false
          AND COALESCE(a.is_disqualified, false) = false
          AND LOWER(COALESCE(a.application_status, '')) NOT IN ('approved', 'rejected', 'disqualified')
          AND LOWER(COALESCE(a.verification_status, '')) = 'verified'
          AND LOWER(COALESCE(es.overall_status, '')) = 'completed'
          AND a.queue_position IS NOT NULL
        ORDER BY a.queue_position ASC, a.fcfs_completed_at ASC, a.application_id ASC
        FOR UPDATE OF a
      `,
      [normalizedOpeningId]
    );

    let waitingPosition = 0;

    for (let index = 0; index < queueResult.rows.length; index += 1) {
      const row = queueResult.rows[index];
      const insideCapacity = index < reservableSlots;

      if (insideCapacity) {
        const previous = String(row.selection_status || '')
          .trim()
          .toLowerCase();

        const nextStatus =
          previous === 'waitlisted' || previous === 'promoted'
            ? 'Promoted'
            : 'Reserved';

        await client.query(
          `
            UPDATE applications
            SET
                selection_status = $2::varchar(30),
                waitlist_position = NULL,
                selected_at = COALESCE(selected_at, now()),
                activation_status = CASE
                    WHEN LOWER(COALESCE(activation_status, '')) = 'activated'
                        THEN activation_status
                    ELSE 'Not Activated'
                END,
                updated_at = now()
            WHERE application_id = $1::uuid
              AND (
                selection_status IS DISTINCT FROM $2::varchar(30)
                OR waitlist_position IS NOT NULL
                OR selected_at IS NULL
                OR (
                  CASE
                    WHEN LOWER(COALESCE(activation_status, '')) = 'activated'
                      THEN activation_status
                    ELSE 'Not Activated'
                  END
                ) IS DISTINCT FROM activation_status
              )
        `,
          [
            row.application_id,
            nextStatus,
          ]
        );
      } else {
        waitingPosition += 1;
        await client.query(
          `
        UPDATE applications
        SET
            selection_status = 'Waitlisted',
            waitlist_position = $2::integer,
            waitlisted_at = COALESCE(waitlisted_at, now()),
            activation_status = CASE
                WHEN LOWER(COALESCE(activation_status, '')) = 'activated'
                    THEN activation_status
                ELSE 'Not Activated'
            END,
            updated_at = now()
        WHERE application_id = $1::uuid
          AND (
            selection_status IS DISTINCT FROM 'Waitlisted'
            OR waitlist_position IS DISTINCT FROM $2::integer
            OR waitlisted_at IS NULL
            OR (
              CASE
                WHEN LOWER(COALESCE(activation_status, '')) = 'activated'
                  THEN activation_status
                ELSE 'Not Activated'
              END
            ) IS DISTINCT FROM activation_status
          )
    `,
          [
            row.application_id,
            waitingPosition,
          ]
        );
      }
    }

    const result = await client.query(
      `
        SELECT
          application_id,
          selection_status,
          queue_position,
          waitlist_position,
          fcfs_completed_at
        FROM applications
        WHERE opening_id = $1::uuid
          AND COALESCE(is_archived, false) = false
          AND LOWER(COALESCE(application_status, '')) NOT IN ('approved', 'rejected', 'disqualified')
          AND queue_position IS NOT NULL
        ORDER BY queue_position ASC
      `,
      [normalizedOpeningId]
    );

    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function syncApplicationReadiness(applicationId) {
  const normalizedApplicationId = safeUuid(applicationId);
  if (!normalizedApplicationId) return null;

  const { rows } = await pool.query(
    'SELECT opening_id FROM applications WHERE application_id = $1::uuid LIMIT 1',
    [normalizedApplicationId]
  );

  const openingId = rows[0]?.opening_id || null;
  if (!openingId) return null;

  const queue = await syncOpeningFcfsQueue(openingId);
  return queue.find((row) => row.application_id === normalizedApplicationId) || null;
}

async function syncAllReadyApplications() {
  const { rows } = await pool.query(
    `
      SELECT DISTINCT a.opening_id
      FROM applications a
      INNER JOIN endorsement_slips es
        ON es.application_id = a.application_id
      WHERE a.opening_id IS NOT NULL
        AND COALESCE(a.is_archived, false) = false
        AND LOWER(COALESCE(a.verification_status, '')) = 'verified'
        AND LOWER(COALESCE(es.overall_status, '')) = 'completed'
    `
  );

  for (const row of rows) {
    await syncOpeningFcfsQueue(row.opening_id);
  }

  return rows.length;
}

module.exports = {
  syncApplicationReadiness,
  syncOpeningFcfsQueue,
  syncAllReadyApplications,
};
