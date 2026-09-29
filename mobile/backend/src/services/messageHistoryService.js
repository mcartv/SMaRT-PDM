'use strict';

const db = require('../config/db');
const messageService = require('./messageService');
const messageReplyCompatibility = require('./messageReplyCompatibility');
const studentSupportConversationService = require('./studentSupportConversationService');
const { resolveAvatarUrl } = require('./avatarService');

const DEFAULT_BATCH_SIZE = 30;
const MAX_BATCH_SIZE = 50;

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

async function fetchAdminPhotoMap(userIds = []) {
  const ids = [...new Set(userIds.map(safeText).filter(Boolean))];
  if (!ids.length) return new Map();

  try {
    const { rows } = await db.query(
      `
        SELECT user_id, profile_photo_url
        FROM admin_profiles
        WHERE user_id = ANY($1::uuid[]);
      `,
      [ids]
    );
    return new Map(
      rows.map((row) => [row.user_id, row.profile_photo_url || null])
    );
  } catch (error) {
    // Keep message history available on older deployments where the optional
    // admin profile-photo column has not been added yet.
    if (error?.code !== '42703') {
      console.warn('MESSAGE HISTORY ADMIN PHOTO FETCH ERROR:', error?.message || error);
    }
    return new Map();
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
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        s.profile_photo_url AS student_photo,
        ap.first_name AS admin_first_name,
        ap.last_name AS admin_last_name
      FROM users u
      LEFT JOIN students s ON s.user_id = u.user_id
      LEFT JOIN admin_profiles ap ON ap.user_id = u.user_id
      WHERE u.user_id = ANY($1::uuid[]);
    `,
    [ids]
  );
  const adminPhotoMap = await fetchAdminPhotoMap(ids);

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
      const deleted =
        /^deleted[-_]/i.test(rawUsername) || /^deleted[-_]/i.test(rawEmail);
      const name =
        studentName ||
        adminName ||
        (deleted ? 'Deleted user' : rawUsername || rawEmail || 'Unknown user');
      const avatarUrl = await resolveUsableAvatar(
        row.student_photo || adminPhotoMap.get(row.user_id)
      );

      map.set(row.user_id, { name, avatarUrl });
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

async function resolveSupportCounterpartyId(
  currentUserId,
  requestedCounterpartyId = null
) {
  return studentSupportConversationService.resolveStudentSupportCounterparty(
    currentUserId,
    requestedCounterpartyId
  );
}

// Compatibility alias for older callers. The resolver now supports OSFA plus
// existing authorized-office conversations instead of forcing every thread to OSFA.
const resolveFixedOsfaCounterpartyId = resolveSupportCounterpartyId;

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
  const items = window.rows.map((row) => mapMessageRow(row, profileMap));

  return {
    counterpartyId,
    counterparty_id: counterpartyId,
    items: await messageReplyCompatibility.enrichReplyContexts(items),
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
  const items = window.rows.map((row) => mapMessageRow(row, profileMap));

  return {
    roomId: normalizedRoomId,
    room_id: normalizedRoomId,
    items: await messageReplyCompatibility.enrichReplyContexts(items),
    pagination: window.pagination,
  };
}

async function syncPrivateReadState(currentUserId, counterpartyId) {
  const userId = safeText(currentUserId);
  const supportUserId = safeText(counterpartyId);
  if (!isUuid(userId) || !isUuid(supportUserId)) {
    throw createHttpError(400, 'A valid private conversation is required.');
  }

  const target = await db.query(
    `
      SELECT message_id
      FROM messages
      WHERE room_id IS NULL
        AND receiver_id = $1::uuid
        AND sender_id = $2::uuid;
    `,
    [userId, supportUserId]
  );

  const messageIds = target.rows
    .map((row) => safeText(row.message_id))
    .filter((messageId) => isUuid(messageId));

  if (!messageIds.length) {
    return { updatedCount: 0, messageIds: [] };
  }

  await db.query(
    `
      INSERT INTO message_read_states (
        message_id,
        user_id,
        is_read
      )
      SELECT
        unnest($1::uuid[]),
        $2::uuid,
        true
      ON CONFLICT (message_id, user_id)
      DO UPDATE SET
        is_read = true,
        updated_at = now();
    `,
    [messageIds, userId]
  );

  await db.query(
    `
      UPDATE messages
      SET is_read = true
      WHERE message_id = ANY($1::uuid[])
        AND receiver_id = $2::uuid
        AND sender_id = $3::uuid;
    `,
    [messageIds, userId, supportUserId]
  );

  return {
    updatedCount: messageIds.length,
    messageIds,
  };
}

async function getMobileUnreadCount(currentUserId) {
  const userId = safeText(currentUserId);
  if (!isUuid(userId)) {
    throw createHttpError(401, 'Authentication required.');
  }

  return Number(await messageService.getUnreadCount(userId)) || 0;
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  normalizeLimit,
  normalizeCursor,
  resolveSupportCounterpartyId,
  resolveFixedOsfaCounterpartyId,
  fetchPrivateWindow,
  fetchRoomWindow,
  syncPrivateReadState,
  getMobileUnreadCount,
};
