'use strict';

const db = require('../config/db');
const messageService = require('../services/messageService');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

function userId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function limitOf(value) {
  const parsed = Number.parseInt(value, 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : DEFAULT_LIMIT, 1), MAX_LIMIT);
}

async function archiveAccess(currentUserId, roomId) {
  const result = await db.query(`
    SELECT mta.archive_id, mta.archived_at, cr.room_name,
      EXISTS (
        SELECT 1 FROM chat_room_members crm
        WHERE crm.room_id = mta.room_id AND crm.user_id = mta.user_id
      ) AS is_current_member
    FROM message_thread_archives mta
    JOIN chat_rooms cr ON cr.room_id = mta.room_id
    WHERE mta.user_id = $1 AND mta.thread_type = 'group' AND mta.room_id = $2
    ORDER BY mta.archived_at DESC
    LIMIT 1;
  `, [currentUserId, roomId]);
  return result.rows[0] || null;
}

exports.listFormerRooms = async (req, res) => {
  try {
    const currentUserId = userId(req);
    if (!currentUserId) return res.status(401).json({ error: 'Authentication required.' });

    const result = await db.query(`
      SELECT mta.archive_id, mta.archived_at, cr.room_id, cr.room_name,
        cutoff.message_body AS last_message, cutoff.sent_at AS last_sent_at
      FROM message_thread_archives mta
      JOIN chat_rooms cr ON cr.room_id = mta.room_id
      LEFT JOIN LATERAL (
        SELECT m.message_body, m.sent_at
        FROM messages m
        WHERE m.room_id = mta.room_id AND m.sent_at <= mta.archived_at
        ORDER BY m.sent_at DESC, m.message_id DESC
        LIMIT 1
      ) cutoff ON true
      WHERE mta.user_id = $1
        AND mta.thread_type = 'group'
        AND NOT EXISTS (
          SELECT 1 FROM chat_room_members crm
          WHERE crm.room_id = mta.room_id AND crm.user_id = $1
        )
      ORDER BY mta.archived_at DESC;
    `, [currentUserId]);

    return res.json({ items: result.rows.map((row) => ({
      archiveId: row.archive_id,
      archive_id: row.archive_id,
      roomId: row.room_id,
      room_id: row.room_id,
      roomName: row.room_name || 'Group Chat',
      room_name: row.room_name || 'Group Chat',
      archivedAt: row.archived_at,
      archived_at: row.archived_at,
      lastMessage: row.last_message || '',
      last_message: row.last_message || '',
      lastSentAt: row.last_sent_at || null,
      last_sent_at: row.last_sent_at || null,
      readOnly: true,
      read_only: true,
      formerMember: true,
      former_member: true,
      canRestore: false,
      can_restore: false,
    })) });
  } catch (error) {
    console.error('LIST FORMER ROOM HISTORY ERROR:', error);
    return res.status(500).json({ error: 'Failed to load previous group conversations.' });
  }
};

exports.getFormerRoomWindow = async (req, res) => {
  try {
    const currentUserId = userId(req);
    const { roomId } = req.params;
    if (!currentUserId) return res.status(401).json({ error: 'Authentication required.' });

    const access = await archiveAccess(currentUserId, roomId);
    if (!access || access.is_current_member) {
      return res.status(403).json({ error: 'Former-member history is not available for this room.' });
    }

    const limit = limitOf(req.query.limit);
    const beforeSentAt = String(req.query.beforeSentAt || '').trim();
    const beforeMessageId = String(req.query.beforeMessageId || '').trim();
    const params = [roomId, currentUserId, access.archived_at];
    let cursorSql = '';
    if (beforeSentAt && beforeMessageId) {
      params.push(beforeSentAt, beforeMessageId);
      cursorSql = `AND (m.sent_at, m.message_id) < ($4::timestamptz, $5::uuid)`;
    }
    params.push(limit + 1);
    const limitRef = `$${params.length}`;

    const result = await db.query(`
      SELECT m.message_id, m.sender_id, m.receiver_id, m.room_id, m.subject,
        m.message_body, m.sent_at, m.edited_at, m.unsent_at, m.unsent_by,
        m.attachment_url, m.reply_to_message_id, m.client_message_id,
        COALESCE(
          NULLIF(TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ap.first_name, '') || ' ' || COALESCE(ap.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(u.username, '')), ''),
          NULLIF(TRIM(COALESCE(u.email, '')), ''),
          'Unknown User'
        ) AS sender_name,
        CASE WHEN m.sender_id = $2 THEN true ELSE COALESCE(mrs.is_read, false) END AS is_read
      FROM messages m
      LEFT JOIN users u ON u.user_id = m.sender_id
      LEFT JOIN students st ON st.user_id = m.sender_id
      LEFT JOIN admin_profiles ap ON ap.user_id = m.sender_id
      LEFT JOIN message_read_states mrs
        ON mrs.message_id = m.message_id AND mrs.user_id = $2
      WHERE m.room_id = $1
        AND m.sent_at <= $3
        ${cursorSql}
        AND NOT EXISTS (
          SELECT 1 FROM message_hidden_states mhs
          WHERE mhs.message_id = m.message_id AND mhs.user_id = $2
        )
      ORDER BY m.sent_at DESC, m.message_id DESC
      LIMIT ${limitRef}::int;
    `, params);

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const enriched = await messageService.enrichMessageRowsForHistory?.(rows) || rows;
    const oldest = rows[rows.length - 1] || null;

    return res.json({
      roomId, room_id: roomId,
      readOnly: true, read_only: true,
      formerMember: true, former_member: true,
      cutoffAt: access.archived_at, cutoff_at: access.archived_at,
      roomName: access.room_name || 'Group Chat', room_name: access.room_name || 'Group Chat',
      items: enriched,
      pagination: {
        limit,
        hasMore,
        has_more: hasMore,
        nextBeforeSentAt: hasMore ? oldest?.sent_at || null : null,
        next_before_sent_at: hasMore ? oldest?.sent_at || null : null,
        nextBeforeMessageId: hasMore ? oldest?.message_id || null : null,
        next_before_message_id: hasMore ? oldest?.message_id || null : null,
      },
    });
  } catch (error) {
    console.error('GET FORMER ROOM HISTORY ERROR:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to load previous group messages.' });
  }
};
