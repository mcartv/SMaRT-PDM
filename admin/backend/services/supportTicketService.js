const pool = require('../config/db');

const ALLOWED_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

function normalizeStatus(status) {
    if (!status) return null;

    const trimmed = String(status).trim().toLowerCase();

    if (trimmed === 'open') return 'Open';
    if (trimmed === 'in progress') return 'In Progress';
    if (trimmed === 'resolved') return 'Resolved';
    if (trimmed === 'closed') return 'Closed';

    return null;
}

async function fetchSupportTickets() {
    const query = `
    SELECT
      st.ticket_id,
      st.student_id,
      st.issue_category,
      st.description,
      COALESCE(st.status, 'Open') AS status,
      st.handled_by,
      st.created_at,
      st.resolved_at,
      st.is_archived,

      s.first_name,
      s.last_name,
      s.pdm_id,

      CONCAT_WS(' ', s.first_name, s.last_name) AS student_name,
      s.pdm_id AS student_number,

      CONCAT_WS(' ', ap.first_name, ap.last_name) AS handler_name

    FROM support_tickets st
    LEFT JOIN students s
      ON s.student_id = st.student_id
    LEFT JOIN users hu
      ON hu.user_id = st.handled_by
    LEFT JOIN admin_profiles ap
      ON ap.user_id = hu.user_id

    WHERE COALESCE(st.is_archived, false) = false
    ORDER BY
      CASE
        WHEN COALESCE(st.status, 'Open') = 'Open' THEN 1
        WHEN COALESCE(st.status, 'Open') = 'In Progress' THEN 2
        WHEN COALESCE(st.status, 'Open') = 'Resolved' THEN 3
        WHEN COALESCE(st.status, 'Open') = 'Closed' THEN 4
        ELSE 5
      END,
      st.created_at DESC
  `;

    const { rows } = await pool.query(query);
    return rows;
}

async function getSupportTicketById(ticketId) {
    const query = `
    SELECT
      st.ticket_id,
      st.student_id,
      st.issue_category,
      st.description,
      COALESCE(st.status, 'Open') AS status,
      st.handled_by,
      st.created_at,
      st.resolved_at,
      st.is_archived,

      CONCAT_WS(' ', s.first_name, s.last_name) AS student_name,
      s.pdm_id AS student_number,

      CONCAT_WS(' ', ap.first_name, ap.last_name) AS handler_name

    FROM support_tickets st
    LEFT JOIN students s
      ON s.student_id = st.student_id
    LEFT JOIN users hu
      ON hu.user_id = st.handled_by
    LEFT JOIN admin_profiles ap
      ON ap.user_id = hu.user_id
    WHERE st.ticket_id = $1
    LIMIT 1
  `;

    const { rows } = await pool.query(query, [ticketId]);
    return rows[0] || null;
}

async function updateSupportTicket(ticketId, { status, assignToSelf, currentUser }) {
    const existing = await getSupportTicketById(ticketId);

    if (!existing || existing.is_archived) {
        throw new Error('Support ticket not found');
    }

    const updates = [];
    const values = [];
    let index = 1;

    if (assignToSelf === true) {
        if (!currentUser?.user_id) {
            throw new Error('Nothing to update');
        }

        updates.push(`handled_by = $${index++}`);
        values.push(currentUser.user_id);
    }

    if (typeof status !== 'undefined') {
        const normalized = normalizeStatus(status);

        if (!normalized || !ALLOWED_STATUSES.includes(normalized)) {
            throw new Error('Invalid status value');
        }

        updates.push(`status = $${index++}`);
        values.push(normalized);

        if (normalized === 'Resolved' || normalized === 'Closed') {
            updates.push(`resolved_at = NOW()`);
        } else {
            updates.push(`resolved_at = NULL`);
        }
    }

    if (updates.length === 0) {
        throw new Error('Nothing to update');
    }

    values.push(ticketId);

    const updateQuery = `
    UPDATE support_tickets
    SET
      ${updates.join(', ')}
    WHERE ticket_id = $${index}
    RETURNING ticket_id
  `;

    await pool.query(updateQuery, values);

    const updated = await getSupportTicketById(ticketId);
    return updated;
}

module.exports = {
    fetchSupportTickets,
    updateSupportTicket,
};