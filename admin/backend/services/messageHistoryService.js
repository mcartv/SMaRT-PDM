'use strict';

const db = require('../config/db');
const messageService = require('./messageService');

const DEFAULT_BATCH_SIZE = 30;
const MAX_BATCH_SIZE = 50;

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE;
  return Math.min(parsed, MAX_BATCH_SIZE);
}

function encodeCursor(row) {
  if (!row?.sent_at || !row?.message_id) return null;
  return Buffer.from(
    JSON.stringify({ sentAt: row.sent_at, messageId: row.message_id }),
    'utf8'
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeCursor(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    const sentAt = String(parsed?.sentAt || '').trim();
    const messageId = String(parsed?.messageId || '').trim();

    if (!sentAt || !messageId || Number.isNaN(new Date(sentAt).getTime())) {
      throw new Error('Invalid cursor payload.');
    }

    return { sentAt, messageId };
  } catch {
    const error = new Error('Invalid message history cursor.');
    error.statusCode = 400;
    throw error;
  }
}

async function enrichMessageRows(rows = []) {
  const userIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.sender_id, row.reply_sender_id])
        .filter(Boolean)
    ),
  ];

  const summaries = new Map();
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        summaries.set(userId, await messageService.fetchUserSummary(userId));
      } catch {
        summaries.set(userId, null);
      }
    })
  );

  return rows.map((row) => ({
    ...row,
    sender_name: summaries.get(row.sender_id)?.display_name || 'Unknown User',
    sender_profile_photo_url:
      summaries.get(row.sender_id)?.profile_photo_url || null,
    sender_avatar_url: summaries.get(row.sender_id)?.avatar_url || null,
    reply_sender_name: row.reply_sender_id
      ? summaries.get(row.reply_sender_id)?.display_name || 'Unknown User'
      : null,
  }));
}

async function enrichRoomReadReceipts(rows = []) {
  const readerIds = [
    ...new Set(
      rows
        .flatMap((row) => (Array.isArray(row.seen_by) ? row.seen_by : []))
        .map((receipt) => receipt?.user_id)
        .filter(Boolean)
    ),
  ];

  const summaries = new Map();
  await Promise.all(
    readerIds.map(async (userId) => {
      try {
        summaries.set(userId, await messageService.fetchUserSummary(userId));
      } catch {
        summaries.set(userId, null);
      }
    })
  );

  return rows.map((row) => ({
    ...row,
    seen_by: (Array.isArray(row.seen_by) ? row.seen_by : []).map((receipt) => {
      const summary = summaries.get(receipt.user_id);
      return {
        user_id: receipt.user_id,
        name: summary?.display_name || summary?.email || 'Unknown User',
        avatar_url: summary?.avatar_url || null,
        seen_at: receipt.seen_at || null,
      };
    }),
  }));
}

function finishWindow(rows, limit) {
  const hasMore = rows.length > limit;
  const descendingPage = hasMore ? rows.slice(0, limit) : rows;
  const ascendingPage = [...descendingPage].reverse();
  const nextCursor = hasMore && ascendingPage.length
    ? encodeCursor(ascendingPage[0])
    : null;

  return {
    rows: ascendingPage,
    pagination: {
      limit,
      hasMore,
      has_more: hasMore,
      nextCursor,
      next_cursor: nextCursor,
    },
  };
}

async function fetchPrivateWindow(currentUserId, counterpartyId, options = {}) {
  const limit = normalizeLimit(options.limit);
  const cursor = decodeCursor(options.before);
  const values = [currentUserId, counterpartyId];
  let cursorClause = '';

  if (cursor) {
    values.push(cursor.sentAt, cursor.messageId);
    cursorClause = `AND (m.sent_at, m.message_id) < ($3::timestamptz, $4::uuid)`;
  }

  values.push(limit + 1);
  const limitRef = `$${values.length}`;

  const result = await db.query(
    `
    SELECT
      m.message_id,
      m.sender_id,
      m.receiver_id,
      m.room_id,
      m.subject,
      m.message_body,
      m.sent_at,
      m.edited_at,
      m.unsent_at,
      m.unsent_by,
      (SELECT COUNT(*)::int FROM message_edit_history meh WHERE meh.message_id = m.message_id) AS edit_count,
      CASE
        WHEN m.sender_id = $1 THEN true
        ELSE COALESCE(mrs.is_read, m.is_read, false)
      END AS is_read,
      CASE
        WHEN m.sender_id = $1
        THEN COALESCE(counterparty_read.is_read, m.is_read, false)
        ELSE false
      END AS seen_by_counterparty,
      m.attachment_url,
      m.reply_to_message_id,
      m.client_message_id,
      reply.message_body AS reply_message_body,
      reply.sender_id AS reply_sender_id
    FROM messages m
    LEFT JOIN message_read_states mrs
      ON mrs.message_id = m.message_id
     AND mrs.user_id = $1
    LEFT JOIN message_read_states counterparty_read
      ON counterparty_read.message_id = m.message_id
     AND counterparty_read.user_id = $2
    LEFT JOIN messages reply
      ON reply.message_id = m.reply_to_message_id
     AND NOT EXISTS (
       SELECT 1
       FROM message_hidden_states hidden_reply
       WHERE hidden_reply.message_id = reply.message_id
         AND hidden_reply.user_id = $1
     )
    WHERE m.room_id IS NULL
      AND (
        (m.sender_id = $1 AND m.receiver_id = $2)
        OR
        (m.sender_id = $2 AND m.receiver_id = $1)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM message_hidden_states mhs
        WHERE mhs.message_id = m.message_id
          AND mhs.user_id = $1
      )
      ${cursorClause}
    ORDER BY m.sent_at DESC, m.message_id DESC
    LIMIT ${limitRef}::int;
    `,
    values
  );

  const window = finishWindow(result.rows, limit);
  window.rows = await enrichMessageRows(window.rows);
  return { items: window.rows, pagination: window.pagination };
}

async function ensureRoomMembership(currentUserId, roomId) {
  const result = await db.query(
    `
      SELECT 1
      FROM chat_room_members
      WHERE room_id = $1
        AND user_id = $2
      LIMIT 1;
    `,
    [roomId, currentUserId]
  );

  if (!result.rows.length) {
    const error = new Error('You are not a member of this chat room');
    error.statusCode = 403;
    throw error;
  }
}

async function fetchRoomWindow(currentUserId, roomId, options = {}) {
  await ensureRoomMembership(currentUserId, roomId);

  const limit = normalizeLimit(options.limit);
  const cursor = decodeCursor(options.before);
  const values = [roomId, currentUserId];
  let cursorClause = '';

  if (cursor) {
    values.push(cursor.sentAt, cursor.messageId);
    cursorClause = `AND (m.sent_at, m.message_id) < ($3::timestamptz, $4::uuid)`;
  }

  values.push(limit + 1);
  const limitRef = `$${values.length}`;

  const result = await db.query(
    `
    SELECT
      m.message_id,
      m.sender_id,
      m.receiver_id,
      m.room_id,
      m.subject,
      m.message_body,
      m.sent_at,
      m.edited_at,
      m.unsent_at,
      m.unsent_by,
      (SELECT COUNT(*)::int FROM message_edit_history meh WHERE meh.message_id = m.message_id) AS edit_count,
      COALESCE(mrs.is_read, CASE WHEN m.sender_id = $2 THEN true ELSE false END) AS is_read,
      false AS seen_by_counterparty,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'user_id', reader.user_id,
              'seen_at', reader.updated_at
            )
            ORDER BY reader.updated_at DESC
          )
          FROM message_read_states reader
          WHERE reader.message_id = m.message_id
            AND reader.is_read = true
            AND reader.user_id <> m.sender_id
        ),
        '[]'::jsonb
      ) AS seen_by,
      m.attachment_url,
      m.reply_to_message_id,
      m.client_message_id,
      reply.message_body AS reply_message_body,
      reply.sender_id AS reply_sender_id
    FROM messages m
    LEFT JOIN message_read_states mrs
      ON mrs.message_id = m.message_id
     AND mrs.user_id = $2
    LEFT JOIN messages reply
      ON reply.message_id = m.reply_to_message_id
     AND NOT EXISTS (
       SELECT 1
       FROM message_hidden_states hidden_reply
       WHERE hidden_reply.message_id = reply.message_id
         AND hidden_reply.user_id = $2
     )
    WHERE m.room_id = $1
      AND NOT EXISTS (
        SELECT 1
        FROM message_hidden_states mhs
        WHERE mhs.message_id = m.message_id
          AND mhs.user_id = $2
      )
      ${cursorClause}
    ORDER BY m.sent_at DESC, m.message_id DESC
    LIMIT ${limitRef}::int;
    `,
    values
  );

  const window = finishWindow(result.rows, limit);
  const enriched = await enrichMessageRows(window.rows);
  window.rows = await enrichRoomReadReceipts(enriched);
  return { items: window.rows, pagination: window.pagination };
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  fetchPrivateWindow,
  fetchRoomWindow,
};
