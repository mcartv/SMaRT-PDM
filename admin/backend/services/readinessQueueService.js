const pool = require('../config/db');

function safeUuid(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

async function recalculateOpeningQueue(client, openingId) {
  const result = await client.query(
    `
      WITH ready AS (
        SELECT
          a.application_id,
          GREATEST(
            COALESCE(a.requirements_verified_at, a.updated_at, a.submission_date, a.created_at),
            COALESCE(es.completed_at, es.updated_at, a.updated_at, a.submission_date, a.created_at)
          ) AS ready_at,
          ROW_NUMBER() OVER (
            ORDER BY
              GREATEST(
                COALESCE(a.requirements_verified_at, a.updated_at, a.submission_date, a.created_at),
                COALESCE(es.completed_at, es.updated_at, a.updated_at, a.submission_date, a.created_at)
              ) ASC,
              a.submission_date ASC NULLS LAST,
              a.created_at ASC,
              a.application_id ASC
          )::int AS next_queue_position
        FROM applications a
        INNER JOIN endorsement_slips es
          ON es.application_id = a.application_id
        WHERE a.opening_id = $1
          AND COALESCE(a.is_archived, false) = false
          AND COALESCE(a.is_disqualified, false) = false
          AND LOWER(COALESCE(a.application_status, '')) NOT IN ('approved', 'rejected', 'disqualified')
          AND LOWER(COALESCE(a.verification_status, '')) = 'verified'
          AND LOWER(COALESCE(es.overall_status, '')) = 'completed'
      ),
      updated_ready AS (
        UPDATE applications a
        SET
          selection_status = CASE
            WHEN LOWER(COALESCE(a.selection_status, '')) IN (
              'selected', 'waitlisted', 'promoted', 'not selected'
            ) THEN a.selection_status
            ELSE 'Qualified'
          END,
          fcfs_completed_at = ready.ready_at,
          queue_position = ready.next_queue_position,
          requirements_verified_at = COALESCE(a.requirements_verified_at, ready.ready_at),
          updated_at = now()
        FROM ready
        WHERE a.application_id = ready.application_id
        RETURNING a.application_id, a.queue_position, a.fcfs_completed_at
      )
      SELECT * FROM updated_ready
      ORDER BY queue_position ASC
    `,
    [openingId]
  );

  await client.query(
    `
      UPDATE applications a
      SET
        queue_position = NULL,
        fcfs_completed_at = NULL,
        selection_status = CASE
          WHEN LOWER(COALESCE(a.selection_status, '')) = 'qualified' THEN 'Unranked'
          ELSE a.selection_status
        END,
        updated_at = now()
      WHERE a.opening_id = $1
        AND COALESCE(a.is_archived, false) = false
        AND LOWER(COALESCE(a.selection_status, '')) NOT IN (
          'selected', 'waitlisted', 'promoted', 'not selected'
        )
        AND NOT (
          LOWER(COALESCE(a.verification_status, '')) = 'verified'
          AND EXISTS (
            SELECT 1
            FROM endorsement_slips es
            WHERE es.application_id = a.application_id
              AND LOWER(COALESCE(es.overall_status, '')) = 'completed'
          )
        )
    `,
    [openingId]
  );

  return result.rows;
}

async function syncOpeningFcfsQueue(openingId) {
  const normalizedOpeningId = safeUuid(openingId);
  if (!normalizedOpeningId) return [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT opening_id FROM program_openings WHERE opening_id = $1 FOR UPDATE',
      [normalizedOpeningId]
    );
    const rows = await recalculateOpeningQueue(client, normalizedOpeningId);
    await client.query('COMMIT');
    return rows;
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
    'SELECT opening_id FROM applications WHERE application_id = $1 LIMIT 1',
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
        AND COALESCE(a.is_disqualified, false) = false
        AND LOWER(COALESCE(a.application_status, '')) NOT IN ('approved', 'rejected', 'disqualified')
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
