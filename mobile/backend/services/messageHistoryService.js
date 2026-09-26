'use strict';

const db = require('../config/db');
const messageService = require('./messageService');
const { resolveAvatarUrl } = require('./avatarService');

const DEFAULT_BATCH_SIZE = 30;
const MAX_BATCH_SIZE = 50;
const ALLOWED_SUPPORT_ROLES = [
  'admin',
  'osfa_admin',
  'sdo',
  'guidance',
  'pd',
  'ro_coordinator',
];

function safeText(value) {
  return String(value || '').trim();
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE;
  return Math.min(parsed, MAX_BATCH_SIZE);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    safeText(value)
  );
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeCursor({ beforeSentAt, beforeMessageId } = {}) {
  const sentAt = safeText(beforeSentAt);
  const messageId = safeText(beforeMessageId);

  if (!sentAt && !messageId) return null;
  if (!sentAt || !messageId) {
    throw createHttpError(
      400,
      'beforeSentAt and beforeMessageId must be provided together.'
    );
  }

  if (Number.isNaN(new Date(sentAt).getTime()) || !isUuid(messageId)) {
    throw createHttpError(400, 'Invalid message history cursor.');
  }

  return { sentAt, messageId };
}

async function resolveUsableAvatar(value) {
  const raw = safeText(value);
  if (!raw) return null;

  try {
    const resolved = safeText(await resolveAvatarUrl(raw));
    return /^https?:\/\//i.test(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

async function fetchProfileMap(userIds = []) {
  const ids = [...new Set(userIds.map(safeText).filter(Boolean))];
  if (!ids.length) return new Map();

  const { rows } = await db.query(
    `
      SELECT
        u.user_id,
        u.email,
        u.username,
        u.role,
        s.pdm_id,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        s.profile_photo_url AS student_photo,
        ap.first_name AS admin_first_name,
        ap.last_name AS admin_last_name,
        ap.department,
        ap.position
      FROM users u
      LEFT JOIN students s ON s.user_id = u.user_id
      LEFT JOIN admin_profiles ap ON ap.user_id = u.user_id
      WHERE u.user_id = ANY($1::uuid[]);
    `,
    [ids]
  );

  const map = new Map();
  await Promise.all(
    rows.map(async (row) => {
      const studentName = [row.student_first_name, row.student_last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      const adminName = [row.admin_first_name, row.admin_last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      const rawUsername = safeText(row.username);
      const rawEmail = safeText(row.email);
      const deleted = /^deleted[-_]/i.test(rawUsername) || /^deleted[-_]/i.test(rawEmail);
      const name = studentName || adminName || (deleted ? 'Deleted user' : rawUsername || rawEmail || 'Unknown user');
      const avatarUrl = await resolveUsableAvatar(row.student_photo);

      map.set(row.user_id, {
        name,
        avatarUrl,
      });
    })
  );

  return map;
}

function mapMessageRow(row, profileMap) {
  const profile = profileMap.get(row.sender_id) || null;
  return {
    messageId: row.message_id,
    message_id: row.message_id,
    senderId: row.sender_id,
    sender_id: row.sender_id,
    receiverId: row.receiver_id,
    receiver_id: row.receiver_id,
    roomId: row.room_id,
    room_id: row.room_id,
    subject: row.subject,
    messageBody: row.message_body,
    message_body: row.message_body,
    sentAt: row.sent_at,
    sent_at: row.sent_at,
    isRead: row.is_read === true,
    is_read: row.is_read === true,
    attachmentUrl: row.attachment_url,
    attachment_url: row.attachment_url,
    isUnsent: Boolean(row.unsent_at),
    is_unsent: Boolean(row.unsent_at),
    unsentAt: row.unsent_at || null,
    unsent_at: row.unsent_at || null,
    unsentBy: row.unsent_by || null,
    unsent_by: row.unsent_by || null,
    senderName: profile?.name || null,
    sender_name: profile?.name || null,
    senderAvatarUrl: profile?.avatarUrl || null,
    sender_avatar_url: profile?.avatarUrl || null,
  };
}

function finishWindow(rows, limit) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const oldest = page.length ? page[page.length - 1] : null;

  return {
    rows: page,
    pagination: {
      limit,
      hasMore,
      has_more: hasMore,
      nextBeforeSentAt: hasMore ? oldest?.sent_at || null : null,
      next_before_sent_at: hasMore ? oldest?.sent_at || null : null,
      nextBeforeMessageId: hasMore ? oldest?.message_id || null : null,
      next_before_message_id: hasMore ? oldest?.message_id || null : null,
    },
  };
}

async function resolveSupportCounterpartyId(userId, requestedCounterpartyId = null) {
  const normalizedUserId = safeText(userId);
  const requested = safeText(requestedCounterpartyId);

  if (!normalizedUserId || !isUuid(normalizedUserId)) {
    throw createHttpError(401, 'Authentication required.');
  }

  if (requested) {
    if (!isUuid(requested) || requested === normalizedUserId) {
      throw createHttpError(400, 'A valid support contact is required.');
    }
    return requested;
  }

  const { rows } = await db.query(
    `
      SELECT
        CASE
          WHEN m.sender_id = $1::uuid THEN m.receiver_id
          ELSE m.sender_id
        END AS counterparty_id
      FROM messages m
      JOIN users u
        ON u.user_id = CASE
          WHEN m.sender_id = $1::uuid THEN m.receiver_id
          ELSE m.sender_id
        END
      LEFT JOIN admin_profiles ap ON ap.user_id = u.user_id
      WHERE m.room_id IS NULL
        AND (m.sender_id = $1::uuid OR m.receiver_id = $1::uuid)
        AND CASE
          WHEN m.sender_id = $1::uuid THEN m.receiver_id
          ELSE m.sender_id
        END IS NOT NULL
        AND COALESCE(ap.is_archived, false) = false
        AND (
          LOWER(COALESCE(u.role, '')) = ANY($2::text[])
          OR LOWER(COALESCE(ap.department, '')) LIKE '%osfa%'
          OR LOWER(COALESCE(ap.department, '')) LIKE '%admin%'
          OR LOWER(COALESCE(ap.position, '')) LIKE '%admin%'
          OR LOWER(COALESCE(ap.position, '')) LIKE '%officer%'
        )
      ORDER BY m.sent_at DESC, m.message_id DESC
      LIMIT 1;
    `,
    [normalizedUserId, ALLOWED_SUPPORT_ROLES]
  );

  const recentCounterpartyId = safeText(rows[0]?.counterparty_id);
  if (recentCounterpartyId) return recentCounterpartyId;

  return messageService.resolveFixedAdminUserId();
}

async function fetchPrivateWindow(currentUserId, options = {}) {
  const counterpartyId = await resolveSupportCounterpartyId(
    currentUserId,
    options.counterpartyId
  );
  const limit = normalizeLimit(options.limit);
  const cursor = normalizeCursor(options);
  const values = [safeText(currentUserId), counterpartyId];
  let cursorClause = '';

  if (cursor) {
    values.push(cursor.sentAt, cursor.messageId);
    cursorClause = `AND (m.sent_at, m.message_id) < ($3::timestamptz, $4::uuid)`;
  }

  values.push(limit + 1);
  const limitRef = `$${values.length}`;

  const { rows } = await db.query(
    `
      SELECT
        m.message_id,
        m.sender_id,
        m.receiver_id,
        m.room_id,
        m.subject,
        m.message_body,
        m.sent_at,
        CASE
          WHEN m.sender_id = $1::uuid THEN true
          ELSE COALESCE(mrs.is_read, m.is_read, false)
        END AS is_read,
        m.attachment_url,
        m.unsent_at,
        m.unsent_by
      FROM messages m
      LEFT JOIN message_read_states mrs
        ON mrs.message_id = m.message_id
       AND mrs.user_id = $1::uuid
      WHERE m.room_id IS NULL
        AND (
          (m.sender_id = $1::uuid AND m.receiver_id = $2::uuid)
          OR
          (m.sender_id = $2::uuid AND m.receiver_id = $1::uuid)
        )
        ${cursorClause}
      ORDER BY m.sent_at DESC, m.message_id DESC
      LIMIT ${limitRef}::int;
    `,
    values
  );

  const window = finishWindow(rows, limit);
  const profileMap = await fetchProfileMap(
    window.rows.map((row) => row.sender_id)
  );

  return {
    counterpartyId,
    counterparty_id: counterpartyId,
    items: window.rows.map((row) => mapMessageRow(row, profileMap)),
    pagination: window.pagination,
  };
}

async function ensureRoomMembership(currentUserId, roomId) {
  const normalizedUserId = safeText(currentUserId);
  const normalizedRoomId = safeText(roomId);
  if (!isUuid(normalizedUserId) || !isUuid(normalizedRoomId)) {
    throw createHttpError(400, 'Invalid room request.');
  }

  const { rows } = await db.query(
    `
      SELECT 1
      FROM chat_room_members
      WHERE room_id = $1::uuid
        AND user_id = $2::uuid
      LIMIT 1;
    `,
    [normalizedRoomId, normalizedUserId]
  );

  if (!rows.length) {
    throw createHttpError(403, 'You are not a member of this room.');
  }
}

async function fetchRoomWindow(currentUserId, roomId, options = {}) {
  await ensureRoomMembership(currentUserId, roomId);

  const normalizedUserId = safeText(currentUserId);
  const normalizedRoomId = safeText(roomId);
  const limit = normalizeLimit(options.limit);
  const cursor = normalizeCursor(options);
  const values = [normalizedRoomId, normalizedUserId];
  let cursorClause = '';

  if (cursor) {
    values.push(cursor.sentAt, cursor.messageId);
    cursorClause = `AND (m.sent_at, m.message_id) < ($3::timestamptz, $4::uuid)`;
  }

  values.push(limit + 1);
  const limitRef = `$${values.length}`;

  const { rows } = await db.query(
    `
      SELECT
        m.message_id,
        m.sender_id,
        m.receiver_id,
        m.room_id,
        m.subject,
        m.message_body,
        m.sent_at,
        CASE
          WHEN m.sender_id = $2::uuid THEN true
          ELSE COALESCE(mrs.is_read, m.is_read, false)
        END AS is_read,
        m.attachment_url,
        m.unsent_at,
        m.unsent_by
      FROM messages m
      LEFT JOIN message_read_states mrs
        ON mrs.message_id = m.message_id
       AND mrs.user_id = $2::uuid
      WHERE m.room_id = $1::uuid
        ${cursorClause}
      ORDER BY m.sent_at DESC, m.message_id DESC
      LIMIT ${limitRef}::int;
    `,
    values
  );

  const window = finishWindow(rows, limit);
  const profileMap = await fetchProfileMap(
    window.rows.map((row) => row.sender_id)
  );

  return {
    roomId: normalizedRoomId,
    room_id: normalizedRoomId,
    items: window.rows.map((row) => mapMessageRow(row, profileMap)),
    pagination: window.pagination,
  };
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  normalizeLimit,
  normalizeCursor,
  fetchPrivateWindow,
  fetchRoomWindow,
};
