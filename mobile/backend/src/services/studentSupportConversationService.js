// SMaRT-PDM: student Support Conversation Service — student Support Conversation Service (mobile backend service); contains mobile-facing business logic and data operations.
'use strict';

const db = require('../config/db');
const messageService = require('./messageService');

const SUPPORT_ROLES = new Set([
  'admin',
  'osfa_admin',
  'sdo',
  'guidance',
  'pd',
  'ro_coordinator',
]);

// safeText: handles safe text for the student Support Conversation Service flow.
function safeText(value) {
  return value == null ? '' : String(value).trim();
}

// isUuid: checks whether is uuid for the student Support Conversation Service flow.
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    safeText(value)
  );
}

// createHttpError: creates create http error for the student Support Conversation Service flow.
function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// supportTitle: handles support title for the student Support Conversation Service flow.
function supportTitle(row, fixedOsfaUserId) {
  if (row.user_id === fixedOsfaUserId) return 'OSFA Administrator';

  switch (safeText(row.role).toLowerCase()) {
    case 'sdo':
      return 'Student Discipline Office';
    case 'guidance':
      return 'Guidance and Counseling Office';
    case 'pd':
      return 'Program Director';
    case 'ro_coordinator':
      return 'Return of Obligations Coordinator';
    case 'osfa_admin':
      return 'OSFA Personnel';
    case 'admin': {
      const department = safeText(row.department);
      if (department.toLowerCase().includes('scholarship')) return 'OSFA Personnel';
      return department || safeText(row.position) || 'Administrative Personnel';
    }
    default:
      return safeText(row.department) || safeText(row.position) || 'Administrative Personnel';
  }
}

// roleLabel: handles role label for the student Support Conversation Service flow.
function roleLabel(role) {
  switch (safeText(role).toLowerCase()) {
    case 'sdo':
      return 'Student Discipline Office Administrator';
    case 'guidance':
      return 'Guidance and Counseling Administrator';
    case 'pd':
      return 'Program Director Administrator';
    case 'ro_coordinator':
      return 'RO Personnel-In-Charge';
    case 'osfa_admin':
    case 'admin':
      return 'OSFA Administrator';
    default:
      return safeText(role).replace(/_/g, ' ');
  }
}

// ensureStudentUser: ensures ensure student user for the student Support Conversation Service flow.
async function ensureStudentUser(userId) {
  const normalizedUserId = safeText(userId);
  if (!isUuid(normalizedUserId)) {
    throw createHttpError(401, 'Authentication required.');
  }

  const result = await db.query(
    `
      SELECT 1
      FROM students
      WHERE user_id = $1::uuid
        AND COALESCE(is_archived, false) = false
      LIMIT 1;
    `,
    [normalizedUserId]
  );

  if (!result.rows.length) {
    throw createHttpError(403, 'Student messaging access is required.');
  }

  return normalizedUserId;
}

// loadSupportProfile: loads and returns load support profile for the student Support Conversation Service flow.
async function loadSupportProfile(counterpartyId) {
  const result = await db.query(
    `
      SELECT
        u.user_id,
        LOWER(COALESCE(u.role, '')) AS role,
        u.email,
        u.username,
        ap.first_name,
        ap.last_name,
        ap.department,
        ap.position,
        COALESCE(ap.is_archived, false) AS is_archived
      FROM users u
      LEFT JOIN admin_profiles ap ON ap.user_id = u.user_id
      WHERE u.user_id = $1::uuid
      LIMIT 1;
    `,
    [counterpartyId]
  );

  return result.rows[0] || null;
}

// isSupportProfile: checks whether is support profile for the student Support Conversation Service flow.
function isSupportProfile(row) {
  if (!row || row.is_archived === true) return false;
  if (SUPPORT_ROLES.has(safeText(row.role).toLowerCase())) return true;

  const department = safeText(row.department).toLowerCase();
  const position = safeText(row.position).toLowerCase();
  return (
    department.includes('osfa') ||
    department.includes('scholarship') ||
    department.includes('discipline') ||
    department.includes('guidance') ||
    position.includes('program director') ||
    position.includes('coordinator')
  );
}

// hasPrivateThread: checks whether has private thread for the student Support Conversation Service flow.
async function hasPrivateThread(studentUserId, counterpartyId) {
  const result = await db.query(
    `
      SELECT 1
      FROM messages
      WHERE room_id IS NULL
        AND (
          (sender_id = $1::uuid AND receiver_id = $2::uuid)
          OR
          (sender_id = $2::uuid AND receiver_id = $1::uuid)
        )
      LIMIT 1;
    `,
    [studentUserId, counterpartyId]
  );
  return result.rows.length > 0;
}

// resolveStudentSupportCounterparty: resolves resolve student support counterparty for the student Support Conversation Service flow.
async function resolveStudentSupportCounterparty(
  currentUserId,
  requestedCounterpartyId = null
) {
  const studentUserId = await ensureStudentUser(currentUserId);
  const fixedOsfaUserId = safeText(await messageService.resolveFixedAdminUserId());
  const requested = safeText(requestedCounterpartyId);

  if (!requested) return fixedOsfaUserId;
  if (!isUuid(requested) || requested === studentUserId) {
    throw createHttpError(400, 'A valid support conversation is required.');
  }
  if (requested === fixedOsfaUserId) return requested;

  const profile = await loadSupportProfile(requested);
  if (!isSupportProfile(profile)) {
    throw createHttpError(403, 'The selected support conversation is not available.');
  }

  if (!(await hasPrivateThread(studentUserId, requested))) {
    throw createHttpError(
      403,
      'You can reply only to an existing conversation with this office.'
    );
  }

  return requested;
}

// listSupportRows: loads a list of list support rows for the student Support Conversation Service flow.
async function listSupportRows(studentUserId, { archived = false } = {}) {
  const fixedOsfaUserId = safeText(await messageService.resolveFixedAdminUserId());

  const result = await db.query(
    `
      WITH candidate_ids AS (
        SELECT DISTINCT
          CASE
            WHEN m.sender_id = $1::uuid THEN m.receiver_id
            ELSE m.sender_id
          END AS user_id
        FROM messages m
        WHERE m.room_id IS NULL
          AND (m.sender_id = $1::uuid OR m.receiver_id = $1::uuid)
        UNION
        SELECT $2::uuid
      ),
      eligible AS (
        SELECT
          u.user_id,
          LOWER(COALESCE(u.role, '')) AS role,
          u.email,
          u.username,
          ap.first_name,
          ap.last_name,
          ap.department,
          ap.position,
          COALESCE(ap.is_archived, false) AS is_archived
        FROM candidate_ids c
        JOIN users u ON u.user_id = c.user_id
        LEFT JOIN admin_profiles ap ON ap.user_id = u.user_id
        WHERE c.user_id IS NOT NULL
          AND c.user_id <> $1::uuid
          AND COALESCE(ap.is_archived, false) = false
          AND (
            c.user_id = $2::uuid
            OR LOWER(COALESCE(u.role, '')) = ANY($3::text[])
            OR LOWER(COALESCE(ap.department, '')) LIKE '%osfa%'
            OR LOWER(COALESCE(ap.department, '')) LIKE '%scholarship%'
            OR LOWER(COALESCE(ap.department, '')) LIKE '%discipline%'
            OR LOWER(COALESCE(ap.department, '')) LIKE '%guidance%'
            OR LOWER(COALESCE(ap.position, '')) LIKE '%program director%'
            OR LOWER(COALESCE(ap.position, '')) LIKE '%coordinator%'
          )
      )
      SELECT
        e.*,
        lm.message_body AS last_message,
        lm.sent_at AS last_sent_at,
        COALESCE(uc.unread_count, 0)::int AS unread_count,
        ar.archive_id,
        ar.archived_at
      FROM eligible e
      LEFT JOIN LATERAL (
        SELECT m.message_body, m.sent_at, m.message_id
        FROM messages m
        WHERE m.room_id IS NULL
          AND (
            (m.sender_id = $1::uuid AND m.receiver_id = e.user_id)
            OR
            (m.sender_id = e.user_id AND m.receiver_id = $1::uuid)
          )
        ORDER BY m.sent_at DESC, m.message_id DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread_count
        FROM messages m
        LEFT JOIN message_read_states mrs
          ON mrs.message_id = m.message_id
         AND mrs.user_id = $1::uuid
        WHERE m.room_id IS NULL
          AND m.sender_id = e.user_id
          AND m.receiver_id = $1::uuid
          AND COALESCE(mrs.is_read, m.is_read, false) = false
      ) uc ON true
      LEFT JOIN LATERAL (
        SELECT a.archive_id, a.archived_at
        FROM message_thread_archives a
        WHERE a.user_id = $1::uuid
          AND a.thread_type = 'private'
          AND a.counterparty_id = e.user_id
        ORDER BY a.archived_at DESC
        LIMIT 1
      ) ar ON true
      WHERE ${archived ? 'ar.archive_id IS NOT NULL' : 'ar.archive_id IS NULL'}
      ORDER BY
        CASE WHEN e.user_id = $2::uuid THEN 0 ELSE 1 END,
        lm.sent_at DESC NULLS LAST,
        e.department ASC NULLS LAST,
        e.position ASC NULLS LAST;
    `,
    [studentUserId, fixedOsfaUserId, Array.from(SUPPORT_ROLES)]
  );

  return { rows: result.rows, fixedOsfaUserId };
}

// toConversation: handles to conversation for the student Support Conversation Service flow.
function toConversation(row, fixedOsfaUserId) {
  const personName =
    [safeText(row.first_name), safeText(row.last_name)].filter(Boolean).join(' ') ||
    safeText(row.username) ||
    safeText(row.email) ||
    'Administrative Personnel';
  const title = supportTitle(row, fixedOsfaUserId);
  const pinned = row.user_id === fixedOsfaUserId;

  return {
    counterpartyId: row.user_id,
    counterparty_id: row.user_id,
    title,
    name: title,
    personName,
    person_name: personName,
    role: safeText(row.role),
    roleLabel: roleLabel(row.role),
    role_label: roleLabel(row.role),
    email: safeText(row.email),
    department: safeText(row.department),
    position: safeText(row.position),
    lastMessage: safeText(row.last_message),
    last_message: safeText(row.last_message),
    lastSentAt: row.last_sent_at || null,
    last_sent_at: row.last_sent_at || null,
    unreadCount: Number(row.unread_count) || 0,
    unread_count: Number(row.unread_count) || 0,
    pinned,
    isPinned: pinned,
    is_pinned: pinned,
    archiveId: row.archive_id || null,
    archive_id: row.archive_id || null,
    archivedAt: row.archived_at || null,
    archived_at: row.archived_at || null,
  };
}

// listSupportConversations: loads a list of list support conversations for the student Support Conversation Service flow.
async function listSupportConversations(currentUserId) {
  const studentUserId = await ensureStudentUser(currentUserId);
  const { rows, fixedOsfaUserId } = await listSupportRows(studentUserId);
  return rows.map((row) => toConversation(row, fixedOsfaUserId));
}

// listArchivedSupportConversations: loads a list of list archived support conversations for the student Support Conversation Service flow.
async function listArchivedSupportConversations(currentUserId) {
  const studentUserId = await ensureStudentUser(currentUserId);
  const { rows, fixedOsfaUserId } = await listSupportRows(studentUserId, {
    archived: true,
  });
  return rows.map((row) => toConversation(row, fixedOsfaUserId));
}

// resolveSupportConversation: resolves resolve support conversation for the student Support Conversation Service flow.
async function resolveSupportConversation(currentUserId, referenceId) {
  const studentUserId = await ensureStudentUser(currentUserId);
  const normalizedReferenceId = safeText(referenceId);

  if (!isUuid(normalizedReferenceId)) {
    throw createHttpError(400, 'A valid message reference is required.');
  }

  const messageResult = await db.query(
    `
      SELECT sender_id, receiver_id, room_id
      FROM messages
      WHERE message_id = $1::uuid
        AND (sender_id = $2::uuid OR receiver_id = $2::uuid)
      LIMIT 1;
    `,
    [normalizedReferenceId, studentUserId]
  );

  const message = messageResult.rows[0] || null;
  if (message?.room_id) {
    throw createHttpError(400, 'The selected message belongs to a group conversation.');
  }

  // New payloads may provide the office user directly. Older notifications
  // store the message ID, so derive the other participant from that message.
  const requestedCounterpartyId = message
    ? message.sender_id === studentUserId
      ? message.receiver_id
      : message.sender_id
    : normalizedReferenceId;

  const counterpartyId = await resolveStudentSupportCounterparty(
    studentUserId,
    requestedCounterpartyId
  );
  const profile = await loadSupportProfile(counterpartyId);
  const fixedOsfaUserId = safeText(await messageService.resolveFixedAdminUserId());

  if (!profile) {
    throw createHttpError(404, 'The selected support conversation was not found.');
  }

  return toConversation(profile, fixedOsfaUserId);
}

// archiveSupportConversation: archives archive support conversation for the student Support Conversation Service flow.
async function archiveSupportConversation(currentUserId, requestedCounterpartyId) {
  const studentUserId = await ensureStudentUser(currentUserId);
  const counterpartyId = await resolveStudentSupportCounterparty(
    studentUserId,
    requestedCounterpartyId
  );

  await db.query(
    `
      DELETE FROM message_thread_archives
      WHERE user_id = $1::uuid
        AND thread_type = 'private'
        AND counterparty_id = $2::uuid;
    `,
    [studentUserId, counterpartyId]
  );

  const result = await db.query(
    `
      INSERT INTO message_thread_archives (
        user_id,
        thread_type,
        counterparty_id,
        room_id
      )
      VALUES ($1::uuid, 'private', $2::uuid, NULL)
      RETURNING archive_id, archived_at;
    `,
    [studentUserId, counterpartyId]
  );

  return {
    success: true,
    counterpartyId,
    counterparty_id: counterpartyId,
    archiveId: result.rows[0]?.archive_id || null,
    archive_id: result.rows[0]?.archive_id || null,
    archivedAt: result.rows[0]?.archived_at || null,
    archived_at: result.rows[0]?.archived_at || null,
  };
}

// restoreSupportConversation: restores restore support conversation for the student Support Conversation Service flow.
async function restoreSupportConversation(currentUserId, requestedCounterpartyId) {
  const studentUserId = await ensureStudentUser(currentUserId);
  const counterpartyId = safeText(requestedCounterpartyId);
  if (!isUuid(counterpartyId) || counterpartyId === studentUserId) {
    throw createHttpError(400, 'A valid support conversation is required.');
  }

  const profile = await loadSupportProfile(counterpartyId);
  const fixedOsfaUserId = safeText(await messageService.resolveFixedAdminUserId());
  if (counterpartyId !== fixedOsfaUserId && !isSupportProfile(profile)) {
    throw createHttpError(403, 'The selected support conversation is not available.');
  }

  const result = await db.query(
    `
      DELETE FROM message_thread_archives
      WHERE user_id = $1::uuid
        AND thread_type = 'private'
        AND counterparty_id = $2::uuid
      RETURNING archive_id;
    `,
    [studentUserId, counterpartyId]
  );

  return {
    success: true,
    restored: result.rows.length > 0,
    counterpartyId,
    counterparty_id: counterpartyId,
  };
}

module.exports = {
  SUPPORT_ROLES,
  resolveStudentSupportCounterparty,
  listSupportConversations,
  listArchivedSupportConversations,
  resolveSupportConversation,
  archiveSupportConversation,
  restoreSupportConversation,
};
