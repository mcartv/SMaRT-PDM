const db = require('../config/db');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function getCurrentRole(req) {
  return String(req.user?.role || '').trim().toLowerCase();
}

function isAdminLike(req) {
  return ['admin', 'osfa_admin', 'sdo', 'guidance', 'pd'].includes(getCurrentRole(req));
}

function normalizeId(value) {
  return String(value || '').trim();
}

function uniqueIds(...values) {
  return [
    ...new Set(
      values
        .flat()
        .map((value) => normalizeId(value))
        .filter(Boolean)
    ),
  ];
}

function getMessageBody(req) {
  return (
    req.body?.messageBody ??
    req.body?.message_body ??
    req.body?.message ??
    ''
  );
}

function getAttachmentUrl(req) {
  return (
    req.body?.attachmentUrl ??
    req.body?.attachment_url ??
    null
  );
}

function getSubject(req) {
  return req.body?.subject || null;
}

function toMessagePayload(row = {}) {
  return {
    messageId: row.message_id,
    message_id: row.message_id,

    senderId: row.sender_id,
    sender_id: row.sender_id,

    receiverId: row.receiver_id || null,
    receiver_id: row.receiver_id || null,

    roomId: row.room_id || null,
    room_id: row.room_id || null,

    subject: row.subject || null,

    messageBody: row.message_body || '',
    message_body: row.message_body || '',

    attachmentUrl: row.attachment_url || null,
    attachment_url: row.attachment_url || null,

    sentAt: row.sent_at,
    sent_at: row.sent_at,

    isRead: row.is_read === true,
    is_read: row.is_read === true,

    senderName: row.sender_name || '',
    sender_name: row.sender_name || '',

    senderRole: row.sender_role || null,
    sender_role: row.sender_role || null,

    senderProfilePhotoUrl: row.sender_profile_photo_url || null,
    sender_profile_photo_url: row.sender_profile_photo_url || null,

    senderAvatarUrl: row.sender_avatar_url || row.sender_profile_photo_url || null,
    sender_avatar_url: row.sender_avatar_url || row.sender_profile_photo_url || null,

    created_at: row.sent_at || new Date().toISOString(),
  };
}

function buildMessageSocketPayload(message) {
  return {
    messageId: message.messageId || message.message_id,
    message_id: message.message_id || message.messageId,

    senderId: message.senderId || message.sender_id,
    sender_id: message.sender_id || message.senderId,

    receiverId: message.receiverId || message.receiver_id || null,
    receiver_id: message.receiver_id || message.receiverId || null,

    roomId: message.roomId || message.room_id || null,
    room_id: message.room_id || message.roomId || null,

    subject: message.subject || null,

    messageBody: message.messageBody || message.message_body || '',
    message_body: message.message_body || message.messageBody || '',

    attachmentUrl: message.attachmentUrl || message.attachment_url || null,
    attachment_url: message.attachment_url || message.attachmentUrl || null,

    sentAt: message.sentAt || message.sent_at || new Date().toISOString(),
    sent_at: message.sent_at || message.sentAt || new Date().toISOString(),

    isRead: message.isRead === true || message.is_read === true,
    is_read: message.is_read === true || message.isRead === true,

    senderName: message.senderName || message.sender_name || '',
    sender_name: message.sender_name || message.senderName || '',

    senderProfilePhotoUrl:
      message.senderProfilePhotoUrl || message.sender_profile_photo_url || null,
    sender_profile_photo_url:
      message.sender_profile_photo_url || message.senderProfilePhotoUrl || null,

    senderAvatarUrl: message.senderAvatarUrl || message.sender_avatar_url || null,
    sender_avatar_url: message.sender_avatar_url || message.senderAvatarUrl || null,

    created_at: new Date().toISOString(),
  };
}

async function logMessageAudit({
  req,
  actionTaken,
  entityType,
  entityId = null,
  description,
  metadata = {},
}) {
  try {
    if (!auditLogService?.logAudit) return;

    await auditLogService.logAudit({
      req,
      actionTaken,
      module: 'Messages',
      entityType,
      entityId,
      description,
      metadata,
    });
  } catch (err) {
    console.error('MESSAGE AUDIT LOG ERROR:', err.message);
  }
}

function emitToUsers(io, eventName, payload, targetUserIds = []) {
  if (!io) return;

  uniqueIds(targetUserIds).forEach((userId) => {
    io.to(`user:${userId}`).emit(eventName, payload);
  });
}

function emitMessageCreated(io, message, targetUserIds = []) {
  if (!io) return;

  const payload = buildMessageSocketPayload(message);
  const targets = uniqueIds(targetUserIds, payload.sender_id, payload.receiver_id);

  if (socketEvents?.messageCreated) {
    socketEvents.messageCreated(io, payload, {
      targetUserIds: targets,
    });
  } else {
    emitToUsers(io, 'message:new', payload, targets);
    emitToUsers(io, 'message:created', payload, targets);
  }

  io.emit('message:new', payload);
  io.emit('message:created', payload);
}

function emitMessageRead(io, payload, targetUserIds = []) {
  if (!io) return;

  if (socketEvents?.messageRead) {
    socketEvents.messageRead(io, payload, {
      targetUserIds,
    });
  } else {
    emitToUsers(io, 'message:read', payload, targetUserIds);
  }
}

function emitMessageUnread(io, payload, targetUserIds = []) {
  emitToUsers(io, 'message:unread', payload, targetUserIds);
}

function emitThreadArchived(io, payload, targetUserIds = []) {
  emitToUsers(io, 'message:thread-archived', payload, targetUserIds);
}

function emitThreadRestored(io, payload, targetUserIds = []) {
  emitToUsers(io, 'message:thread-restored', payload, targetUserIds);
}

async function getPrimarySupportAdminId(currentUserId) {
  const latestThreadResult = await db.query(
    `
    SELECT
      CASE
        WHEN m.sender_id = $1 THEN m.receiver_id
        ELSE m.sender_id
      END AS admin_user_id
    FROM messages m
    JOIN users u
      ON u.user_id = CASE
        WHEN m.sender_id = $1 THEN m.receiver_id
        ELSE m.sender_id
      END
    WHERE m.room_id IS NULL
      AND (m.sender_id = $1 OR m.receiver_id = $1)
      AND LOWER(COALESCE(u.role, '')) IN ('admin', 'osfa_admin', 'sdo', 'guidance', 'pd')
    ORDER BY m.sent_at DESC, m.message_id DESC
    LIMIT 1;
    `,
    [currentUserId]
  );

  if (latestThreadResult.rows[0]?.admin_user_id) {
    return latestThreadResult.rows[0].admin_user_id;
  }

  const fallbackAdminResult = await db.query(
    `
    SELECT u.user_id
    FROM users u
    LEFT JOIN admin_profiles ap
      ON ap.user_id = u.user_id
    WHERE LOWER(COALESCE(u.role, '')) IN ('admin', 'osfa_admin', 'sdo', 'guidance', 'pd')
    ORDER BY
      CASE WHEN ap.admin_id IS NULL THEN 1 ELSE 0 END,
      u.created_at ASC NULLS LAST,
      u.user_id ASC
    LIMIT 1;
    `
  );

  return fallbackAdminResult.rows[0]?.user_id || null;
}

async function fetchConversationMessages(leftUserId, rightUserId) {
  const result = await db.query(
    `
    SELECT
      m.message_id,
      m.sender_id,
      m.receiver_id,
      m.room_id,
      m.subject,
      m.message_body,
      m.attachment_url,
      m.sent_at,
      m.is_read,
      u.role AS sender_role,
      COALESCE(
        NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''),
        u.username,
        u.email,
        'Unknown'
      ) AS sender_name,
      s.profile_photo_url AS sender_profile_photo_url,
      s.profile_photo_url AS sender_avatar_url
    FROM messages m
    LEFT JOIN users u
      ON u.user_id = m.sender_id
    LEFT JOIN students s
      ON s.user_id = m.sender_id
    WHERE m.room_id IS NULL
      AND (
        (m.sender_id = $1 AND m.receiver_id = $2)
        OR
        (m.sender_id = $2 AND m.receiver_id = $1)
      )
    ORDER BY m.sent_at ASC, m.message_id ASC;
    `,
    [leftUserId, rightUserId]
  );

  return result.rows.map(toMessagePayload);
}

async function fetchRoomMemberUserIds(roomId) {
  const result = await db.query(
    `
    SELECT user_id
    FROM chat_room_members
    WHERE room_id = $1;
    `,
    [roomId]
  );

  return result.rows.map((row) => row.user_id).filter(Boolean);
}

async function createPrivateMessage({
  senderId,
  receiverId,
  subject = null,
  messageBody,
  attachmentUrl = null,
}) {
  const cleanBody = String(messageBody || '').trim();

  if (!senderId) {
    const error = new Error('senderId is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!receiverId) {
    const error = new Error('receiverId is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!cleanBody) {
    const error = new Error('Message body is required.');
    error.statusCode = 400;
    throw error;
  }

  const result = await db.query(
    `
    INSERT INTO messages (
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      attachment_url,
      is_read
    )
    VALUES ($1, $2, NULL, $3, $4, $5, false)
    RETURNING
      message_id,
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      attachment_url,
      sent_at,
      is_read;
    `,
    [senderId, receiverId, subject, cleanBody, attachmentUrl]
  );

  const inserted = result.rows[0];

  const withProfile = await db.query(
    `
    SELECT
      m.message_id,
      m.sender_id,
      m.receiver_id,
      m.room_id,
      m.subject,
      m.message_body,
      m.attachment_url,
      m.sent_at,
      m.is_read,
      u.role AS sender_role,
      COALESCE(
        NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''),
        u.username,
        u.email,
        'Unknown'
      ) AS sender_name,
      s.profile_photo_url AS sender_profile_photo_url,
      s.profile_photo_url AS sender_avatar_url
    FROM messages m
    LEFT JOIN users u
      ON u.user_id = m.sender_id
    LEFT JOIN students s
      ON s.user_id = m.sender_id
    WHERE m.message_id = $1
    LIMIT 1;
    `,
    [inserted.message_id]
  );

  return toMessagePayload(withProfile.rows[0] || inserted);
}

async function createRoomMessage({
  senderId,
  roomId,
  subject = null,
  messageBody,
  attachmentUrl = null,
}) {
  const cleanBody = String(messageBody || '').trim();

  if (!senderId) {
    const error = new Error('senderId is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!roomId) {
    const error = new Error('roomId is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!cleanBody) {
    const error = new Error('Message body is required.');
    error.statusCode = 400;
    throw error;
  }

  const membership = await db.query(
    `
    SELECT room_id
    FROM chat_room_members
    WHERE room_id = $1
      AND user_id = $2
    LIMIT 1;
    `,
    [roomId, senderId]
  );

  if (!membership.rows.length) {
    return Promise.reject(Object.assign(new Error('You are not a member of this room.'), { statusCode: 403 }));
  }

  const result = await db.query(
    `
    INSERT INTO messages (
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      attachment_url,
      is_read
    )
    VALUES ($1, NULL, $2, $3, $4, $5, false)
    RETURNING
      message_id,
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      attachment_url,
      sent_at,
      is_read;
    `,
    [senderId, roomId, subject, cleanBody, attachmentUrl]
  );

  const inserted = result.rows[0];

  const withProfile = await db.query(
    `
    SELECT
      m.message_id,
      m.sender_id,
      m.receiver_id,
      m.room_id,
      m.subject,
      m.message_body,
      m.attachment_url,
      m.sent_at,
      m.is_read,
      u.role AS sender_role,
      COALESCE(
        NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''),
        u.username,
        u.email,
        'Unknown'
      ) AS sender_name,
      s.profile_photo_url AS sender_profile_photo_url,
      s.profile_photo_url AS sender_avatar_url
    FROM messages m
    LEFT JOIN users u
      ON u.user_id = m.sender_id
    LEFT JOIN students s
      ON s.user_id = m.sender_id
    WHERE m.message_id = $1
    LIMIT 1;
    `,
    [inserted.message_id]
  );

  return toMessagePayload(withProfile.rows[0] || inserted);
}

function getStatusCode(error) {
  return error?.statusCode || error?.status || 500;
}

/*
  GET /api/messages/unread-count
*/
exports.getUnreadCount = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const privateResult = await db.query(
      `
      SELECT COUNT(*)::int AS unread_count
      FROM messages m
      WHERE m.room_id IS NULL
        AND m.receiver_id = $1
        AND m.sender_id <> $1
        AND COALESCE(m.is_read, false) = false;
      `,
      [currentUserId]
    );

    let roomUnreadCount = 0;

    try {
      const roomResult = await db.query(
        `
        SELECT COUNT(*)::int AS unread_count
        FROM messages m
        JOIN chat_room_members crm
          ON crm.room_id = m.room_id
         AND crm.user_id = $1
        LEFT JOIN message_read_states mrs
          ON mrs.message_id = m.message_id
         AND mrs.user_id = $1
        WHERE m.room_id IS NOT NULL
          AND m.sender_id <> $1
          AND COALESCE(mrs.is_read, false) = false;
        `,
        [currentUserId]
      );

      roomUnreadCount = Number(roomResult.rows[0]?.unread_count || 0);
    } catch {
      roomUnreadCount = 0;
    }

    const privateUnreadCount = Number(privateResult.rows[0]?.unread_count || 0);
    const unreadCount = privateUnreadCount + roomUnreadCount;

    return res.json({
      unreadCount,
      count: unreadCount,
      privateUnreadCount,
      roomUnreadCount,
    });
  } catch (err) {
    console.error('GET MESSAGE UNREAD COUNT ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to load unread message count',
      error: err.message,
    });
  }
};

/*
  GET /api/messages/thread
*/
exports.getThread = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const requestedCounterpartyId =
      req.query?.counterpartyId ||
      req.query?.receiverId ||
      req.query?.adminId ||
      '';

    const counterpartyId =
      String(requestedCounterpartyId || '').trim() ||
      (await getPrimarySupportAdminId(currentUserId));

    if (!counterpartyId) {
      return res.json({
        items: [],
        messages: [],
        counterpartyId: null,
      });
    }

    const items = await fetchConversationMessages(currentUserId, counterpartyId);

    return res.json({
      items,
      messages: items,
      counterpartyId,
      counterparty_id: counterpartyId,
    });
  } catch (err) {
    console.error('GET MOBILE MESSAGE THREAD ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to load message thread',
      error: err.message,
    });
  }
};

/*
  POST /api/messages/thread
*/
exports.sendThreadMessage = async (req, res) => {
  try {
    const senderId = getCurrentUserId(req);

    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const cleanMessageBody = String(getMessageBody(req) || '').trim();

    if (!cleanMessageBody) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    const targetAdminId =
      String(req.body?.receiverId || req.body?.counterpartyId || req.body?.adminId || '').trim() ||
      (await getPrimarySupportAdminId(senderId));

    if (!targetAdminId) {
      return res.status(404).json({
        message: 'No admin account is available for this support thread.',
      });
    }

    const message = await createPrivateMessage({
      senderId,
      receiverId: targetAdminId,
      subject: getSubject(req),
      messageBody: cleanMessageBody,
      attachmentUrl: getAttachmentUrl(req),
    });

    const io = req.app.get('io');

    emitMessageCreated(io, message, [senderId, targetAdminId]);

    await logMessageAudit({
      req,
      actionTaken: 'SEND_MOBILE_THREAD_MESSAGE',
      entityType: 'message',
      entityId: message.message_id,
      description: 'Sent a mobile support thread message.',
      metadata: {
        message_id: message.message_id,
        sender_id: senderId,
        receiver_id: targetAdminId,
        message_length: cleanMessageBody.length,
      },
    });

    return res.status(201).json(message);
  } catch (err) {
    console.error('SEND MOBILE THREAD MESSAGE ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
      message: 'Failed to send message',
      error: err.message,
    });
  }
};

/*
  PATCH /api/messages/thread/read
*/
exports.markThreadRead = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const requestedCounterpartyId =
      req.body?.counterpartyId ||
      req.body?.receiverId ||
      req.body?.adminId ||
      req.query?.counterpartyId ||
      req.query?.receiverId ||
      req.query?.adminId ||
      '';

    const counterpartyId =
      String(requestedCounterpartyId || '').trim() ||
      (await getPrimarySupportAdminId(currentUserId));

    if (!counterpartyId) {
      return res.json({
        messageIds: [],
        message_ids: [],
        isRead: true,
        is_read: true,
        unreadCount: 0,
      });
    }

    const updateResult = await db.query(
      `
      UPDATE messages
      SET is_read = true
      WHERE room_id IS NULL
        AND receiver_id = $1
        AND sender_id = $2
        AND COALESCE(is_read, false) = false
      RETURNING message_id;
      `,
      [currentUserId, counterpartyId]
    );

    const messageIds = updateResult.rows.map((row) => row.message_id);

    const io = req.app.get('io');

    if (messageIds.length) {
      emitMessageRead(
        io,
        {
          reader_id: currentUserId,
          readerId: currentUserId,
          counterparty_id: counterpartyId,
          counterpartyId,
          room_id: null,
          roomId: null,
          message_ids: messageIds,
          messageIds,
          updated_at: new Date().toISOString(),
        },
        uniqueIds(currentUserId, counterpartyId)
      );
    }

    return res.json({
      messageIds,
      message_ids: messageIds,
      isRead: true,
      is_read: true,
      unreadCount: 0,
    });
  } catch (err) {
    console.error('MARK MOBILE THREAD READ ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to mark thread as read',
      error: err.message,
    });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await db.query(
      `
      WITH direct_messages AS (
        SELECT
          m.*,
          CASE
            WHEN m.sender_id = $1 THEN m.receiver_id
            ELSE m.sender_id
          END AS counterparty_id
        FROM messages m
        WHERE m.room_id IS NULL
          AND (m.sender_id = $1 OR m.receiver_id = $1)
      ),
      ranked AS (
        SELECT
          dm.*,
          ROW_NUMBER() OVER (
            PARTITION BY dm.counterparty_id
            ORDER BY dm.sent_at DESC, dm.message_id DESC
          ) AS rn,
          COUNT(*) FILTER (
            WHERE dm.receiver_id = $1
              AND dm.sender_id <> $1
              AND COALESCE(dm.is_read, false) = false
          ) OVER (PARTITION BY dm.counterparty_id) AS unread_count
        FROM direct_messages dm
        WHERE dm.counterparty_id IS NOT NULL
      )
      SELECT
        r.counterparty_id,
        r.message_id,
        r.message_body,
        r.sent_at,
        r.unread_count,
        u.role,
        COALESCE(
          NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''),
          u.username,
          u.email,
          'Unknown user'
        ) AS name,
        s.pdm_id AS student_number,
        s.profile_photo_url AS avatar_url
      FROM ranked r
      LEFT JOIN users u
        ON u.user_id = r.counterparty_id
      LEFT JOIN students s
        ON s.user_id = r.counterparty_id
      WHERE r.rn = 1
      ORDER BY r.sent_at DESC, r.message_id DESC;
      `,
      [currentUserId]
    );

    const items = result.rows.map((row) => ({
      counterpartyId: row.counterparty_id,
      counterparty_id: row.counterparty_id,

      messageId: row.message_id,
      message_id: row.message_id,

      name: row.name || 'Unknown user',

      role: row.role || null,

      studentNumber: row.student_number || null,
      student_number: row.student_number || null,

      avatarUrl: row.avatar_url || null,
      avatar_url: row.avatar_url || null,

      lastMessage: row.message_body || '',
      last_message: row.message_body || '',

      lastSentAt: row.sent_at,
      last_sent_at: row.sent_at,

      unreadCount: Number(row.unread_count || 0),
      unread_count: Number(row.unread_count || 0),
    }));

    return res.json({ items });
  } catch (err) {
    console.error('GET CONVERSATIONS ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to load conversations',
      error: err.message,
    });
  }
};

exports.getConversationMessages = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await fetchConversationMessages(currentUserId, counterpartyId);

    return res.json({
      counterpartyId,
      counterparty_id: counterpartyId,
      items,
      messages: items,
    });
  } catch (err) {
    console.error('GET CONVERSATION MESSAGES ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to load messages',
      error: err.message,
    });
  }
};

exports.getArchivedThreads = async (req, res) => {
  return res.json({
    items: [],
    archived: [],
  });
};

exports.restoreConversation = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const io = req.app.get('io');

    emitThreadRestored(
      io,
      {
        thread_type: 'private',
        counterparty_id: counterpartyId,
        counterpartyId,
        restored_by: currentUserId,
        restored_at: new Date().toISOString(),
      },
      [currentUserId]
    );

    return res.json({
      success: true,
      restored: true,
    });
  } catch (err) {
    console.error('RESTORE CONVERSATION ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to restore conversation',
      error: err.message,
    });
  }
};

exports.restoreRoom = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const io = req.app.get('io');

    emitThreadRestored(
      io,
      {
        thread_type: 'group',
        room_id: roomId,
        roomId,
        restored_by: currentUserId,
        restored_at: new Date().toISOString(),
      },
      [currentUserId]
    );

    return res.json({
      success: true,
      restored: true,
    });
  } catch (err) {
    console.error('RESTORE ROOM ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to restore room thread',
      error: err.message,
    });
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const updateResult = await db.query(
      `
      UPDATE messages
      SET is_read = true
      WHERE room_id IS NULL
        AND receiver_id = $1
        AND sender_id = $2
        AND COALESCE(is_read, false) = false
      RETURNING message_id;
      `,
      [currentUserId, counterpartyId]
    );

    const messageIds = updateResult.rows.map((row) => row.message_id);
    const io = req.app.get('io');

    if (messageIds.length) {
      emitMessageRead(
        io,
        {
          reader_id: currentUserId,
          readerId: currentUserId,
          counterparty_id: counterpartyId,
          counterpartyId,
          room_id: null,
          roomId: null,
          message_ids: messageIds,
          messageIds,
          updated_at: new Date().toISOString(),
        },
        uniqueIds(currentUserId, counterpartyId)
      );
    }

    return res.json({
      messageIds,
      message_ids: messageIds,
      isRead: true,
      is_read: true,
      unreadCount: 0,
    });
  } catch (err) {
    console.error('MARK CONVERSATION READ ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to mark conversation as read',
      error: err.message,
    });
  }
};

exports.markConversationUnread = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const latestMessage = await db.query(
      `
      SELECT message_id
      FROM messages
      WHERE room_id IS NULL
        AND receiver_id = $1
        AND sender_id = $2
      ORDER BY sent_at DESC, message_id DESC
      LIMIT 1;
      `,
      [currentUserId, counterpartyId]
    );

    const messageIds = latestMessage.rows.map((row) => row.message_id);

    if (messageIds.length) {
      await db.query(
        `
        UPDATE messages
        SET is_read = false
        WHERE message_id = ANY($1::uuid[]);
        `,
        [messageIds]
      );
    }

    const io = req.app.get('io');

    if (messageIds.length) {
      emitMessageUnread(
        io,
        {
          reader_id: currentUserId,
          readerId: currentUserId,
          counterparty_id: counterpartyId,
          counterpartyId,
          room_id: null,
          roomId: null,
          message_ids: messageIds,
          messageIds,
          is_read: false,
          updated_at: new Date().toISOString(),
        },
        uniqueIds(currentUserId, counterpartyId)
      );
    }

    return res.json({
      messageIds,
      message_ids: messageIds,
      isRead: false,
      is_read: false,
      unreadCount: messageIds.length ? 1 : 0,
    });
  } catch (err) {
    console.error('MARK CONVERSATION UNREAD ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to mark conversation as unread',
      error: err.message,
    });
  }
};

exports.setConversationReadState = async (req, res) => {
  if (req.body?.isRead === true || req.body?.is_read === true) {
    return exports.markConversationRead(req, res);
  }

  return exports.markConversationUnread(req, res);
};

exports.archiveConversation = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const io = req.app.get('io');

    emitThreadArchived(
      io,
      {
        thread_type: 'private',
        counterparty_id: counterpartyId,
        counterpartyId,
        archived_by: currentUserId,
        archived_at: new Date().toISOString(),
      },
      [currentUserId]
    );

    return res.json({
      success: true,
      archive: {
        counterpartyId,
        counterparty_id: counterpartyId,
        archivedBy: currentUserId,
        archived_by: currentUserId,
        archivedAt: new Date().toISOString(),
        archived_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('ARCHIVE CONVERSATION ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to archive conversation',
      error: err.message,
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const senderId = getCurrentUserId(req);
    const { counterpartyId } = req.params;
    const cleanMessageBody = String(getMessageBody(req) || '').trim();

    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!counterpartyId) {
      return res.status(400).json({ message: 'counterpartyId is required' });
    }

    if (!cleanMessageBody) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    const message = await createPrivateMessage({
      senderId,
      receiverId: counterpartyId,
      subject: getSubject(req),
      messageBody: cleanMessageBody,
      attachmentUrl: getAttachmentUrl(req),
    });

    const io = req.app.get('io');

    emitMessageCreated(io, message, [senderId, counterpartyId]);

    await logMessageAudit({
      req,
      actionTaken: 'SEND_PRIVATE_MESSAGE',
      entityType: 'message',
      entityId: message.message_id,
      description: 'Sent a private message.',
      metadata: {
        message_id: message.message_id,
        sender_id: senderId,
        receiver_id: counterpartyId,
        message_length: cleanMessageBody.length,
      },
    });

    return res.status(201).json(message);
  } catch (err) {
    console.error('SEND MESSAGE ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
      message: 'Failed to send message',
      error: err.message,
    });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let result;

    if (isAdminLike(req)) {
      result = await db.query(
        `
        SELECT
          cr.room_id,
          cr.room_name,
          cr.created_at,
          cr.created_by,
          0::int AS unread_count
        FROM chat_rooms cr
        ORDER BY cr.created_at DESC;
        `
      );
    } else {
      result = await db.query(
        `
        SELECT
          cr.room_id,
          cr.room_name,
          cr.created_at,
          cr.created_by,
          0::int AS unread_count
        FROM chat_room_members crm
        JOIN chat_rooms cr
          ON cr.room_id = crm.room_id
        WHERE crm.user_id = $1
        ORDER BY cr.created_at DESC;
        `,
        [currentUserId]
      );
    }

    const items = result.rows.map((row) => ({
      roomId: row.room_id,
      room_id: row.room_id,
      roomName: row.room_name,
      room_name: row.room_name,
      createdAt: row.created_at,
      created_at: row.created_at,
      createdBy: row.created_by,
      created_by: row.created_by,
      unreadCount: Number(row.unread_count || 0),
      unread_count: Number(row.unread_count || 0),
    }));

    return res.json({ items });
  } catch (err) {
    console.error('GET ROOMS ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to load chat rooms',
      error: err.message,
    });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!isAdminLike(req)) {
      return res.status(403).json({ message: 'Only administrators can create group chats.' });
    }

    const roomName =
      req.body?.roomName ||
      req.body?.room_name ||
      req.body?.name ||
      'Group Chat';

    const userIds =
      req.body?.userIds ||
      req.body?.user_ids ||
      req.body?.memberIds ||
      req.body?.member_ids ||
      [];

    const selectedUserIds = uniqueIds(Array.isArray(userIds) ? userIds : []);

    const roomResult = await db.query(
      `
      INSERT INTO chat_rooms (room_name, created_by)
      VALUES ($1, $2)
      RETURNING room_id, room_name, created_by, created_at;
      `,
      [String(roomName).trim() || 'Group Chat', currentUserId]
    );

    const room = roomResult.rows[0];
    const memberIds = uniqueIds(currentUserId, selectedUserIds);

    if (memberIds.length) {
      await db.query(
        `
        INSERT INTO chat_room_members (room_id, user_id, is_admin)
        SELECT $1, member_id, member_id = $2
        FROM unnest($3::uuid[]) AS member_id
        ON CONFLICT DO NOTHING;
        `,
        [room.room_id, currentUserId, memberIds]
      );
    }

    const payload = {
      roomId: room.room_id,
      room_id: room.room_id,
      roomName: room.room_name,
      room_name: room.room_name,
      createdBy: room.created_by,
      created_by: room.created_by,
      createdAt: room.created_at,
      created_at: room.created_at,
      memberIds,
      member_ids: memberIds,
    };

    const io = req.app.get('io');

    if (socketEvents?.roomCreated) {
      socketEvents.roomCreated(io, payload, {
        targetUserIds: memberIds,
      });
    } else {
      emitToUsers(io, 'room:created', payload, memberIds);
    }

    return res.status(201).json(payload);
  } catch (err) {
    console.error('CREATE ROOM ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to create chat room',
      error: err.message,
    });
  }
};

exports.getRoomMessages = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const membership = await db.query(
      `
      SELECT room_id
      FROM chat_room_members
      WHERE room_id = $1
        AND user_id = $2
      LIMIT 1;
      `,
      [roomId, currentUserId]
    );

    if (!membership.rows.length && !isAdminLike(req)) {
      return res.status(403).json({ message: 'You are not a member of this room.' });
    }

    const result = await db.query(
      `
      SELECT
        m.message_id,
        m.sender_id,
        m.receiver_id,
        m.room_id,
        m.subject,
        m.message_body,
        m.attachment_url,
        m.sent_at,
        m.is_read,
        u.role AS sender_role,
        COALESCE(
          NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''),
          u.username,
          u.email,
          'Unknown'
        ) AS sender_name,
        s.profile_photo_url AS sender_profile_photo_url,
        s.profile_photo_url AS sender_avatar_url
      FROM messages m
      LEFT JOIN users u
        ON u.user_id = m.sender_id
      LEFT JOIN students s
        ON s.user_id = m.sender_id
      WHERE m.room_id = $1
      ORDER BY m.sent_at ASC, m.message_id ASC;
      `,
      [roomId]
    );

    const items = result.rows.map(toMessagePayload);

    return res.json({
      roomId,
      room_id: roomId,
      items,
      messages: items,
    });
  } catch (err) {
    console.error('GET ROOM MESSAGES ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to load room messages',
      error: err.message,
    });
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const senderId = getCurrentUserId(req);
    const { roomId } = req.params;
    const cleanMessageBody = String(getMessageBody(req) || '').trim();

    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!cleanMessageBody) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    const message = await createRoomMessage({
      senderId,
      roomId,
      subject: getSubject(req),
      messageBody: cleanMessageBody,
      attachmentUrl: getAttachmentUrl(req),
    });

    const memberIds = await fetchRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(memberIds, senderId);

    const io = req.app.get('io');

    emitMessageCreated(io, message, targetUserIds);

    return res.status(201).json(message);
  } catch (err) {
    console.error('SEND ROOM MESSAGE ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
      message: 'Failed to send room message',
      error: err.message,
    });
  }
};

exports.addRoomMembers = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!isAdminLike(req)) {
      return res.status(403).json({ message: 'Only administrators can add room members.' });
    }

    const memberIds =
      req.body?.memberIds ||
      req.body?.member_ids ||
      req.body?.userIds ||
      req.body?.user_ids ||
      [];

    const selectedUserIds = uniqueIds(Array.isArray(memberIds) ? memberIds : []);

    if (selectedUserIds.length) {
      await db.query(
        `
        INSERT INTO chat_room_members (room_id, user_id, is_admin)
        SELECT $1, member_id, false
        FROM unnest($2::uuid[]) AS member_id
        ON CONFLICT DO NOTHING;
        `,
        [roomId, selectedUserIds]
      );
    }

    const allRoomMemberIds = await fetchRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(allRoomMemberIds, currentUserId);

    const payload = {
      room_id: roomId,
      roomId,
      actor_id: currentUserId,
      actorId: currentUserId,
      member_ids: selectedUserIds,
      memberIds: selectedUserIds,
      added_count: selectedUserIds.length,
      addedCount: selectedUserIds.length,
      updated_at: new Date().toISOString(),
    };

    const io = req.app.get('io');

    if (socketEvents?.roomMembersAdded) {
      socketEvents.roomMembersAdded(io, payload, {
        targetUserIds,
      });
    } else {
      emitToUsers(io, 'room:members-added', payload, targetUserIds);
    }

    return res.json({
      success: true,
      addedCount: selectedUserIds.length,
      added_count: selectedUserIds.length,
      members: selectedUserIds,
      memberIds: selectedUserIds,
      member_ids: selectedUserIds,
    });
  } catch (err) {
    console.error('ADD ROOM MEMBERS ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to add room members',
      error: err.message,
    });
  }
};

exports.markRoomMessagesRead = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let messageIds = [];

    try {
      const unread = await db.query(
        `
        SELECT m.message_id
        FROM messages m
        WHERE m.room_id = $1
          AND m.sender_id <> $2;
        `,
        [roomId, currentUserId]
      );

      messageIds = unread.rows.map((row) => row.message_id);

      if (messageIds.length) {
        await db.query(
          `
          INSERT INTO message_read_states (message_id, user_id, is_read, read_at)
          SELECT message_id, $2, true, now()
          FROM unnest($1::uuid[]) AS message_id
          ON CONFLICT (message_id, user_id)
          DO UPDATE SET is_read = true, read_at = now();
          `,
          [messageIds, currentUserId]
        );
      }
    } catch {
      messageIds = [];
    }

    const memberIds = await fetchRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(memberIds, currentUserId);

    const io = req.app.get('io');

    if (messageIds.length) {
      emitMessageRead(
        io,
        {
          reader_id: currentUserId,
          readerId: currentUserId,
          room_id: roomId,
          roomId,
          counterparty_id: null,
          counterpartyId: null,
          message_ids: messageIds,
          messageIds,
          updated_at: new Date().toISOString(),
        },
        targetUserIds
      );
    }

    return res.json({
      messageIds,
      message_ids: messageIds,
      isRead: true,
      is_read: true,
      unreadCount: 0,
    });
  } catch (err) {
    console.error('MARK ROOM MESSAGES READ ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to mark room messages as read',
      error: err.message,
    });
  }
};

exports.markRoomMessagesUnread = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const latest = await db.query(
      `
      SELECT message_id
      FROM messages
      WHERE room_id = $1
        AND sender_id <> $2
      ORDER BY sent_at DESC, message_id DESC
      LIMIT 1;
      `,
      [roomId, currentUserId]
    );

    const messageIds = latest.rows.map((row) => row.message_id);

    try {
      if (messageIds.length) {
        await db.query(
          `
          INSERT INTO message_read_states (message_id, user_id, is_read, read_at)
          SELECT message_id, $2, false, null
          FROM unnest($1::uuid[]) AS message_id
          ON CONFLICT (message_id, user_id)
          DO UPDATE SET is_read = false, read_at = null;
          `,
          [messageIds, currentUserId]
        );
      }
    } catch {
      // ignore read state failure
    }

    const memberIds = await fetchRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(memberIds, currentUserId);

    const io = req.app.get('io');

    if (messageIds.length) {
      emitMessageUnread(
        io,
        {
          reader_id: currentUserId,
          readerId: currentUserId,
          room_id: roomId,
          roomId,
          counterparty_id: null,
          counterpartyId: null,
          message_ids: messageIds,
          messageIds,
          is_read: false,
          updated_at: new Date().toISOString(),
        },
        targetUserIds
      );
    }

    return res.json({
      messageIds,
      message_ids: messageIds,
      isRead: false,
      is_read: false,
      unreadCount: messageIds.length ? 1 : 0,
    });
  } catch (err) {
    console.error('MARK ROOM MESSAGES UNREAD ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to mark room messages as unread',
      error: err.message,
    });
  }
};

exports.setRoomReadState = async (req, res) => {
  if (req.body?.isRead === true || req.body?.is_read === true) {
    return exports.markRoomMessagesRead(req, res);
  }

  return exports.markRoomMessagesUnread(req, res);
};

exports.archiveRoom = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const io = req.app.get('io');

    emitThreadArchived(
      io,
      {
        thread_type: 'group',
        room_id: roomId,
        roomId,
        archived_by: currentUserId,
        archived_at: new Date().toISOString(),
      },
      [currentUserId]
    );

    return res.json({
      success: true,
      archive: {
        roomId,
        room_id: roomId,
        archivedBy: currentUserId,
        archived_by: currentUserId,
        archivedAt: new Date().toISOString(),
        archived_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('ARCHIVE ROOM ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to archive room thread',
      error: err.message,
    });
  }
};

exports.getScholarMembers = async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT
        u.user_id,
        u.email,
        u.username,
        u.role,
        s.student_id,
        s.pdm_id,
        s.first_name,
        s.last_name,
        s.profile_photo_url
      FROM students s
      JOIN users u
        ON u.user_id = s.user_id
      WHERE COALESCE(s.is_archived, false) = false
      ORDER BY s.last_name ASC NULLS LAST, s.first_name ASC NULLS LAST, s.pdm_id ASC NULLS LAST;
      `
    );

    const items = result.rows.map((row) => ({
      userId: row.user_id,
      user_id: row.user_id,

      studentId: row.student_id,
      student_id: row.student_id,

      pdmId: row.pdm_id,
      pdm_id: row.pdm_id,

      name:
        [row.first_name, row.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        row.username ||
        row.email ||
        'Unknown scholar',

      firstName: row.first_name,
      first_name: row.first_name,

      lastName: row.last_name,
      last_name: row.last_name,

      email: row.email,
      username: row.username,
      role: row.role,

      avatarUrl: row.profile_photo_url,
      avatar_url: row.profile_photo_url,

      profilePhotoUrl: row.profile_photo_url,
      profile_photo_url: row.profile_photo_url,
    }));

    return res.json({ items });
  } catch (err) {
    console.error('GET SCHOLAR MEMBERS ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to load scholar member list',
      error: err.message,
    });
  }
};