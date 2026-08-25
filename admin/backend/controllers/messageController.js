const db = require('../config/db');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');
const studentRealtimeRelayService = require('../services/studentRealtimeRelayService');
const messageService = require('../services/messageService');
const { resolveAvatarUrl } = require('../services/avatarService');


let adminProfilePhotoColumnPromise = null;

async function hasAdminProfilePhotoColumn() {
  if (!adminProfilePhotoColumnPromise) {
    adminProfilePhotoColumnPromise = db.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'admin_profiles'
        AND column_name = 'profile_photo_url'
      LIMIT 1;
      `
    )
      .then((result) => result.rows.length > 0)
      .catch((error) => {
        adminProfilePhotoColumnPromise = null;
        console.warn('[Messaging] Unable to inspect admin profile photo column:', error.message);
        return false;
      });
  }

  return adminProfilePhotoColumnPromise;
}

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function getCurrentRole(req) {
  return String(req.user?.role || '').trim().toLowerCase();
}

function isAdminLike(req) {
  return ['admin', 'osfa_admin', 'sdo', 'guidance', 'pd', 'ro_coordinator'].includes(getCurrentRole(req));
}

function isSystemAdmin(req) {
  return ['admin', 'osfa_admin'].includes(getCurrentRole(req));
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

function getReplyToMessageId(req) {
  return normalizeId(
    req.body?.replyToMessageId ??
    req.body?.reply_to_message_id ??
    ''
  ) || null;
}

function getClientMessageId(req) {
  return normalizeId(
    req.body?.clientMessageId ??
    req.body?.client_message_id ??
    ''
  ) || null;
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

    replyToMessageId: row.reply_to_message_id || null,
    reply_to_message_id: row.reply_to_message_id || null,
    replyMessageBody: row.reply_message_body || null,
    reply_message_body: row.reply_message_body || null,
    replySenderId: row.reply_sender_id || null,
    reply_sender_id: row.reply_sender_id || null,
    replySenderName: row.reply_sender_name || null,
    reply_sender_name: row.reply_sender_name || null,

    clientMessageId: row.client_message_id || null,
    client_message_id: row.client_message_id || null,

    seenByCounterparty: row.seen_by_counterparty === true,
    seen_by_counterparty: row.seen_by_counterparty === true,

    deduplicated: row.deduplicated === true,

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

    replyToMessageId: message.replyToMessageId || message.reply_to_message_id || null,
    reply_to_message_id: message.reply_to_message_id || message.replyToMessageId || null,
    replyMessageBody: message.replyMessageBody || message.reply_message_body || null,
    reply_message_body: message.reply_message_body || message.replyMessageBody || null,
    replySenderId: message.replySenderId || message.reply_sender_id || null,
    reply_sender_id: message.reply_sender_id || message.replySenderId || null,
    replySenderName: message.replySenderName || message.reply_sender_name || null,
    reply_sender_name: message.reply_sender_name || message.replySenderName || null,

    clientMessageId: message.clientMessageId || message.client_message_id || null,
    client_message_id: message.client_message_id || message.clientMessageId || null,
    seenByCounterparty: message.seenByCounterparty === true || message.seen_by_counterparty === true,
    seen_by_counterparty: message.seen_by_counterparty === true || message.seenByCounterparty === true,

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

function relayToStudentBackend(eventName, payload, targetUserIds = []) {
  studentRealtimeRelayService
    .relayMessageEvent({
      event: eventName,
      payload,
      targetUserIds: uniqueIds(targetUserIds),
    })
    .catch((error) => {
      console.error('STUDENT REALTIME RELAY ERROR:', error.message);
    });
}

function emitToUsers(io, eventName, payload, targetUserIds = []) {
  if (!io) return;

  uniqueIds(targetUserIds).forEach((userId) => {
    io.to(`user:${userId}`).emit(eventName, payload);
  });
}

function emitRoomEvent(io, eventName, payload, targetUserIds = []) {
  const targets = uniqueIds(targetUserIds);
  emitToUsers(io, eventName, payload, targets);
  relayToStudentBackend(eventName, payload, targets);
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

  relayToStudentBackend('message:new', payload, targets);
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

  relayToStudentBackend('message:read', payload, targetUserIds);
}

function emitMessageUnread(io, payload, targetUserIds = []) {
  emitToUsers(io, 'message:unread', payload, targetUserIds);
  relayToStudentBackend('message:unread', payload, targetUserIds);
}

function emitThreadArchived(io, payload, targetUserIds = []) {
  emitToUsers(io, 'message:thread-archived', payload, targetUserIds);
  relayToStudentBackend('message:thread-archived', payload, targetUserIds);
}

function emitThreadRestored(io, payload, targetUserIds = []) {
  emitToUsers(io, 'message:thread-restored', payload, targetUserIds);
  relayToStudentBackend('message:thread-restored', payload, targetUserIds);
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
      AND LOWER(COALESCE(u.role, '')) IN ('admin', 'osfa_admin', 'sdo', 'guidance', 'pd', 'ro_coordinator')
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
    WHERE LOWER(COALESCE(u.role, '')) IN ('admin', 'osfa_admin', 'sdo', 'guidance', 'pd', 'ro_coordinator')
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
  const adminPhotoExpression = await hasAdminProfilePhotoColumn()
    ? 'ap.profile_photo_url'
    : 'NULL::text';
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
        NULLIF(TRIM(CONCAT(ap.first_name, ' ', ap.last_name)), ''),
        u.username,
        u.email,
        'Unknown'
      ) AS sender_name,
      COALESCE(s.profile_photo_url, ${adminPhotoExpression}) AS sender_profile_photo_url,
      COALESCE(s.profile_photo_url, ${adminPhotoExpression}) AS sender_avatar_url
    FROM messages m
    LEFT JOIN users u
      ON u.user_id = m.sender_id
    LEFT JOIN students s
      ON s.user_id = m.sender_id
    LEFT JOIN admin_profiles ap
      ON ap.user_id = m.sender_id
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
  const restoredArchives = await db.query(
    `
    DELETE FROM message_thread_archives
    WHERE thread_type = 'private'
      AND (
        (user_id = $1 AND counterparty_id = $2)
        OR
        (user_id = $2 AND counterparty_id = $1)
      )
    RETURNING user_id;
    `,
    [senderId, receiverId]
  );
  const adminPhotoExpression = await hasAdminProfilePhotoColumn()
    ? 'ap.profile_photo_url'
    : 'NULL::text';

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
        NULLIF(TRIM(CONCAT(ap.first_name, ' ', ap.last_name)), ''),
        u.username,
        u.email,
        'Unknown'
      ) AS sender_name,
      COALESCE(s.profile_photo_url, ${adminPhotoExpression}) AS sender_profile_photo_url,
      COALESCE(s.profile_photo_url, ${adminPhotoExpression}) AS sender_avatar_url
    FROM messages m
    LEFT JOIN users u
      ON u.user_id = m.sender_id
    LEFT JOIN students s
      ON s.user_id = m.sender_id
    LEFT JOIN admin_profiles ap
      ON ap.user_id = m.sender_id
    WHERE m.message_id = $1
    LIMIT 1;
    `,
    [inserted.message_id]
  );

  return {
    ...toMessagePayload(withProfile.rows[0] || inserted),
    restored_archive_user_ids: restoredArchives.rows
      .map((row) => row.user_id)
      .filter(Boolean),
  };
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
  const restoredArchives = await db.query(
    `
    DELETE FROM message_thread_archives mta
    WHERE mta.thread_type = 'group'
      AND mta.room_id = $1
      AND EXISTS (
        SELECT 1
        FROM chat_room_members crm
        WHERE crm.room_id = mta.room_id
          AND crm.user_id = mta.user_id
      )
    RETURNING mta.user_id;
    `,
    [roomId]
  );
  const adminPhotoExpression = await hasAdminProfilePhotoColumn()
    ? 'ap.profile_photo_url'
    : 'NULL::text';

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
        NULLIF(TRIM(CONCAT(ap.first_name, ' ', ap.last_name)), ''),
        u.username,
        u.email,
        'Unknown'
      ) AS sender_name,
      COALESCE(s.profile_photo_url, ${adminPhotoExpression}) AS sender_profile_photo_url,
      COALESCE(s.profile_photo_url, ${adminPhotoExpression}) AS sender_avatar_url
    FROM messages m
    LEFT JOIN users u
      ON u.user_id = m.sender_id
    LEFT JOIN students s
      ON s.user_id = m.sender_id
    LEFT JOIN admin_profiles ap
      ON ap.user_id = m.sender_id
    WHERE m.message_id = $1
    LIMIT 1;
    `,
    [inserted.message_id]
  );

  return {
    ...toMessagePayload(withProfile.rows[0] || inserted),
    restored_archive_user_ids: restoredArchives.rows
      .map((row) => row.user_id)
      .filter(Boolean),
  };
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
      replyToMessageId: getReplyToMessageId(req),
      clientMessageId: getClientMessageId(req),
    });

    const io = req.app.get('io');
    const restoredArchiveUserIds = uniqueIds(
      message.restored_archive_user_ids || []
    );

    for (const restoredUserId of restoredArchiveUserIds) {
      const restoredCounterpartyId =
        restoredUserId === senderId ? targetAdminId : senderId;
      emitThreadRestored(
        io,
        {
          thread_type: 'private',
          counterparty_id: restoredCounterpartyId,
          counterpartyId: restoredCounterpartyId,
          auto_restored: true,
          restored_at: new Date().toISOString(),
        },
        [restoredUserId]
      );
    }

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

    const rows = await messageService.fetchConversations(currentUserId);
    const items = rows.map((row) => ({
      ...row,
      counterpartyId: row.counterparty_id,
      studentNumber: row.student_number || '',
      avatarUrl: row.avatar_url || row.profile_photo_url || null,
      isDisabled: row.is_disabled === true,
      lastMessage: row.last_message || '',
      lastSentAt: row.last_sent_at || null,
      unreadCount: Number(row.unread_count || 0),
      isAdmin: row.is_admin === true,
      is_admin: row.is_admin === true,
    }));

    return res.json({ items });
  } catch (err) {
    console.error('GET CONVERSATIONS ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
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

    const [items, counterparty] = await Promise.all([
      messageService.fetchConversationMessages(currentUserId, counterpartyId),
      messageService.fetchUserSummary(counterpartyId),
    ]);

    return res.json({
      counterpartyId,
      counterparty_id: counterpartyId,
      counterparty: counterparty
        ? {
            user_id: counterparty.user_id,
            name: counterparty.display_name || 'Unknown User',
            is_disabled: counterparty.is_disabled === true,
          }
        : null,
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
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchArchivedThreads(currentUserId);

    return res.json({
      items,
      archived: items,
    });
  } catch (err) {
    console.error('GET ARCHIVED THREADS ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
      message: 'Failed to load archived threads',
      error: err.message,
    });
  }
};

exports.restoreConversation = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await messageService.restoreConversation(
      currentUserId,
      counterpartyId
    );

    if (result.restored) {
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
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('RESTORE CONVERSATION ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
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

    const result = await messageService.restoreRoom(currentUserId, roomId);

    if (result.restored) {
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
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('RESTORE ROOM ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
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

    const messageIds = await messageService.markConversationRead(
      currentUserId,
      counterpartyId
    );
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

    return res.status(getStatusCode(err)).json({
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

    const messageIds = await messageService.markConversationUnread(
      currentUserId,
      counterpartyId
    );
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

    return res.status(getStatusCode(err)).json({
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

    const archive = await messageService.archiveConversation(
      currentUserId,
      counterpartyId
    );
    const archivedAt = archive?.archived_at || new Date().toISOString();

    const io = req.app.get('io');

    emitThreadArchived(
      io,
      {
        thread_type: 'private',
        counterparty_id: counterpartyId,
        counterpartyId,
        archived_by: currentUserId,
        archived_at: archivedAt,
      },
      [currentUserId]
    );

    return res.json({
      success: true,
      archive: {
        ...archive,
        counterpartyId,
        counterparty_id: counterpartyId,
        archivedBy: currentUserId,
        archived_by: currentUserId,
        archivedAt,
        archived_at: archivedAt,
      },
    });
  } catch (err) {
    console.error('ARCHIVE CONVERSATION ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
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

    const message = await messageService.sendMessage({
      senderId,
      receiverId: counterpartyId,
      subject: getSubject(req),
      messageBody: cleanMessageBody,
      attachmentUrl: getAttachmentUrl(req),
      replyToMessageId: getReplyToMessageId(req),
      clientMessageId: getClientMessageId(req),
    });

    const io = req.app.get('io');
    const restoredArchiveUserIds = uniqueIds(
      message.restored_archive_user_ids || []
    );

    for (const restoredUserId of restoredArchiveUserIds) {
      const restoredCounterpartyId =
        restoredUserId === senderId ? counterpartyId : senderId;
      emitThreadRestored(
        io,
        {
          thread_type: 'private',
          counterparty_id: restoredCounterpartyId,
          counterpartyId: restoredCounterpartyId,
          auto_restored: true,
          restored_at: new Date().toISOString(),
        },
        [restoredUserId]
      );
    }

    if (!message.deduplicated) {
      emitMessageCreated(io, message, [senderId, counterpartyId]);
    }

    if (!message.deduplicated) {
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
    }

    return res.status(message.deduplicated ? 200 : 201).json(message);
  } catch (err) {
    console.error('SEND MESSAGE ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
      message: 'Failed to send message',
      error: err.message,
      code: err.code || 'MESSAGE_SEND_FAILED',
    });
  }
};

exports.hideMessageForMe = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { messageId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await messageService.hideMessageForUser(currentUserId, messageId);
    const io = req.app.get('io');
    const payload = {
      message_id: result.message_id,
      messageId: result.message_id,
      room_id: result.room_id,
      roomId: result.room_id,
      counterparty_id: result.counterparty_id,
      counterpartyId: result.counterparty_id,
      hidden_by: currentUserId,
      hiddenBy: currentUserId,
      hidden_at: new Date().toISOString(),
    };

    emitToUsers(io, 'message:hidden', payload, [currentUserId]);

    return res.json({ success: true, ...payload });
  } catch (err) {
    console.error('HIDE MESSAGE FOR ME ERROR:', err.message);
    return res.status(getStatusCode(err)).json({
      message: 'Failed to hide message',
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

    const rows = await messageService.fetchRooms(currentUserId);
    const items = rows.map((row) => ({
      ...row,
      roomId: row.room_id,
      roomName: row.room_name,
      createdBy: row.created_by,
      createdAt: row.created_at,
      lastMessage: row.last_message || '',
      lastSentAt: row.last_sent_at || null,
      memberCount: Number(row.member_count || 0),
      unreadCount: Number(row.unread_count || 0),
    }));

    return res.json({ items });
  } catch (err) {
    console.error('GET ROOMS ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
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
      return res.status(403).json({ message: 'Account messaging access is required.' });
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

    const roomMemberPayload = await messageService.fetchRoomMembers(currentUserId, room.room_id);
    const roomMembers = roomMemberPayload?.items || [];
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
      members: roomMembers,
      roomMembers,
      memberCount: roomMembers.length,
      member_count: roomMembers.length,
      viewerIsAdmin: roomMemberPayload?.viewer_is_admin === true,
      viewer_is_admin: roomMemberPayload?.viewer_is_admin === true,
    };

    const io = req.app.get('io');

    if (socketEvents?.roomCreated) {
      socketEvents.roomCreated(io, payload, {
        targetUserIds: memberIds,
      });
    } else {
      emitToUsers(io, 'room:created', payload, memberIds);
    }
    relayToStudentBackend('room:created', payload, memberIds);

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

    const [items, memberPayload] = await Promise.all([
      messageService.fetchRoomMessages(currentUserId, roomId),
      messageService.fetchRoomMembers(currentUserId, roomId),
    ]);
    const members = memberPayload?.items || [];

    return res.json({
      roomId,
      room_id: roomId,
      items,
      messages: items,
      members,
      roomMembers: members,
      memberCount: members.length,
      member_count: members.length,
      viewerIsAdmin: memberPayload?.viewer_is_admin === true,
      viewer_is_admin: memberPayload?.viewer_is_admin === true,
    });
  } catch (err) {
    console.error('GET ROOM MESSAGES ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
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

    const message = await messageService.sendRoomMessage({
      senderId,
      roomId,
      subject: getSubject(req),
      messageBody: cleanMessageBody,
      attachmentUrl: getAttachmentUrl(req),
      replyToMessageId: getReplyToMessageId(req),
      clientMessageId: getClientMessageId(req),
    });

    const memberIds = await messageService.fetchRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(memberIds, senderId);
    const restoredArchiveUserIds = uniqueIds(
      message.restored_archive_user_ids || []
    );
    const io = req.app.get('io');

    if (restoredArchiveUserIds.length) {
      emitThreadRestored(
        io,
        {
          thread_type: 'group',
          room_id: roomId,
          roomId,
          auto_restored: true,
          restored_at: new Date().toISOString(),
        },
        restoredArchiveUserIds
      );
    }

    if (!message.deduplicated) {
      emitMessageCreated(io, message, targetUserIds);
    }

    return res.status(message.deduplicated ? 200 : 201).json(message);
  } catch (err) {
    console.error('SEND ROOM MESSAGE ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
      message: 'Failed to send room message',
      error: err.message,
    });
  }
};

exports.getRoomMembers = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const payload = await messageService.fetchRoomMembers(currentUserId, roomId);
    return res.json({
      roomId,
      room_id: roomId,
      viewerIsAdmin: payload.viewer_is_admin === true,
      viewer_is_admin: payload.viewer_is_admin === true,
      items: payload.items || [],
      members: payload.items || [],
      roomMembers: payload.items || [],
      memberCount: (payload.items || []).length,
      member_count: (payload.items || []).length,
    });
  } catch (err) {
    console.error('GET ROOM MEMBERS ERROR:', err.message);
    return res.status(getStatusCode(err)).json({
      message: 'Failed to load room members',
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

    const action = String(req.body?.action || 'add').trim().toLowerCase();

    if (action === 'promote_admin' || action === 'promote') {
      const memberId = String(req.body?.memberId || req.body?.member_id || '').trim();
      if (!memberId) {
        return res.status(400).json({ message: 'A valid member is required.' });
      }

      const result = await messageService.promoteRoomMemberToAdmin({
        actorId: currentUserId,
        roomId,
        memberId,
      });

      const refreshed = await messageService.fetchRoomMembers(currentUserId, roomId);
      const members = refreshed?.items || [];
      const allRoomMemberIds = await messageService.fetchRoomMemberUserIds(roomId);
      const io = req.app.get('io');

      emitRoomEvent(io, 'room:member-promoted', {
        room_id: roomId,
        roomId,
        member_id: memberId,
        memberId,
        promoted_by: currentUserId,
        promotedBy: currentUserId,
        updated_at: new Date().toISOString(),
      }, uniqueIds(allRoomMemberIds, currentUserId, memberId));

      return res.json({
        success: true,
        action: 'promote_admin',
        ...result,
        members,
        roomMembers: members,
        memberCount: members.length,
        member_count: members.length,
        viewerIsAdmin: refreshed?.viewer_is_admin === true,
        viewer_is_admin: refreshed?.viewer_is_admin === true,
      });
    }

    if (action === 'remove') {
      const memberId = String(req.body?.memberId || req.body?.member_id || '').trim();
      if (!memberId) {
        return res.status(400).json({ message: 'Member ID is required.' });
      }

      const beforeMemberIds = await messageService.fetchRoomMemberUserIds(roomId);
      const result = await messageService.removeRoomMember({
        actorId: currentUserId,
        roomId,
        memberId,
      });
      const io = req.app.get('io');
      emitRoomEvent(io, 'room:members-removed', {
        room_id: roomId,
        roomId,
        member_id: memberId,
        memberId,
        actor_id: currentUserId,
        actorId: currentUserId,
        updated_at: new Date().toISOString(),
      }, uniqueIds(beforeMemberIds, currentUserId, memberId));

      const refreshed = await messageService.fetchRoomMembers(currentUserId, roomId);
      const members = refreshed?.items || [];
      return res.json({
        success: true,
        action: 'remove',
        ...result,
        members,
        roomMembers: members,
        memberCount: members.length,
        member_count: members.length,
        viewerIsAdmin: refreshed?.viewer_is_admin === true,
        viewer_is_admin: refreshed?.viewer_is_admin === true,
      });
    }

    if (action === 'leave') {
      const beforeMemberIds = await messageService.fetchRoomMemberUserIds(roomId);
      const result = await messageService.leaveRoom(currentUserId, roomId);
      const io = req.app.get('io');
      const leaveTargets = uniqueIds(beforeMemberIds, currentUserId, result.promoted_user_id);
      emitRoomEvent(io, 'room:member-left', {
        room_id: roomId,
        roomId,
        user_id: currentUserId,
        userId: currentUserId,
        promoted_user_id: result.promoted_user_id || null,
        promotedUserId: result.promoted_user_id || null,
        updated_at: new Date().toISOString(),
      }, leaveTargets);

      if (result.promoted_user_id) {
        emitRoomEvent(io, 'room:member-promoted', {
          room_id: roomId,
          roomId,
          member_id: result.promoted_user_id,
          memberId: result.promoted_user_id,
          promoted_by: 'system',
          promotedBy: 'system',
          reason: 'last_admin_left',
          updated_at: new Date().toISOString(),
        }, leaveTargets);
      }

      emitThreadArchived(
        io,
        {
          thread_type: 'group',
          room_id: roomId,
          roomId,
          archived_by: currentUserId,
          archived_at: result.archived_at || result.archive?.archived_at || new Date().toISOString(),
          reason: 'left_group',
        },
        [currentUserId]
      );

      return res.json({ success: true, action: 'leave', ...result });
    }

    const memberIds =
      req.body?.memberIds ||
      req.body?.member_ids ||
      req.body?.userIds ||
      req.body?.user_ids ||
      [];

    const selectedUserIds = uniqueIds(Array.isArray(memberIds) ? memberIds : []);
    const result = await messageService.addRoomMembers({
      actorId: currentUserId,
      roomId,
      memberIds: selectedUserIds,
    });

    const allRoomMemberIds = await messageService.fetchRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(allRoomMemberIds, currentUserId, selectedUserIds);
    const payload = {
      room_id: roomId,
      roomId,
      actor_id: currentUserId,
      actorId: currentUserId,
      member_ids: selectedUserIds,
      memberIds: selectedUserIds,
      added_count: result.added_count || 0,
      addedCount: result.added_count || 0,
      updated_at: new Date().toISOString(),
    };

    const io = req.app.get('io');
    if (socketEvents?.roomMembersAdded) {
      socketEvents.roomMembersAdded(io, payload, { targetUserIds });
    } else {
      emitToUsers(io, 'room:members-added', payload, targetUserIds);
    }
    relayToStudentBackend('room:members-added', payload, targetUserIds);

    const refreshed = await messageService.fetchRoomMembers(currentUserId, roomId);
    const members = refreshed?.items || [];
    return res.json({
      success: true,
      action: 'add',
      ...result,
      members,
      roomMembers: members,
      memberCount: members.length,
      member_count: members.length,
      viewerIsAdmin: refreshed?.viewer_is_admin === true,
      viewer_is_admin: refreshed?.viewer_is_admin === true,
    });
  } catch (err) {
    console.error('MANAGE ROOM MEMBERS ERROR:', err.message);
    return res.status(getStatusCode(err)).json({
      message: 'Failed to update group members',
      error: err.message,
    });
  }
};

exports.removeRoomMember = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId, memberId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const beforeMemberIds = await messageService.fetchRoomMemberUserIds(roomId);
    const result = await messageService.removeRoomMember({
      actorId: currentUserId,
      roomId,
      memberId,
    });

    const io = req.app.get('io');
    const targetUserIds = uniqueIds(beforeMemberIds, currentUserId, memberId);
    emitRoomEvent(io, 'room:members-removed', {
      room_id: roomId,
      roomId,
      member_id: memberId,
      memberId,
      actor_id: currentUserId,
      actorId: currentUserId,
      updated_at: new Date().toISOString(),
    }, targetUserIds);

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('REMOVE ROOM MEMBER ERROR:', err.message);
    return res.status(getStatusCode(err)).json({
      message: 'Failed to remove group member',
      error: err.message,
    });
  }
};

exports.leaveRoom = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const beforeMemberIds = await messageService.fetchRoomMemberUserIds(roomId);
    const result = await messageService.leaveRoom(currentUserId, roomId);
    const io = req.app.get('io');
    const leaveTargets = uniqueIds(beforeMemberIds, currentUserId, result.promoted_user_id);
    emitRoomEvent(io, 'room:member-left', {
      room_id: roomId,
      roomId,
      user_id: currentUserId,
      userId: currentUserId,
      promoted_user_id: result.promoted_user_id || null,
      promotedUserId: result.promoted_user_id || null,
      updated_at: new Date().toISOString(),
    }, leaveTargets);

    if (result.promoted_user_id) {
      emitRoomEvent(io, 'room:member-promoted', {
        room_id: roomId,
        roomId,
        member_id: result.promoted_user_id,
        memberId: result.promoted_user_id,
        promoted_by: 'system',
        promotedBy: 'system',
        reason: 'last_admin_left',
        updated_at: new Date().toISOString(),
      }, leaveTargets);
    }

    emitThreadArchived(
      io,
      {
        thread_type: 'group',
        room_id: roomId,
        roomId,
        archived_by: currentUserId,
        archived_at: result.archived_at || result.archive?.archived_at || new Date().toISOString(),
        reason: 'left_group',
      },
      [currentUserId]
    );

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('LEAVE ROOM ERROR:', err.message);
    return res.status(getStatusCode(err)).json({
      message: 'Failed to leave group',
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

    const messageIds = await messageService.markRoomMessagesRead(currentUserId, roomId);
    const memberIds = await messageService.fetchRoomMemberUserIds(roomId);
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

    return res.status(getStatusCode(err)).json({
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

    const messageIds = await messageService.markRoomMessagesUnread(currentUserId, roomId);
    const memberIds = await messageService.fetchRoomMemberUserIds(roomId);
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

    return res.status(getStatusCode(err)).json({
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

    const archive = await messageService.archiveRoom(currentUserId, roomId);
    const archivedAt = archive?.archived_at || new Date().toISOString();

    const io = req.app.get('io');

    emitThreadArchived(
      io,
      {
        thread_type: 'group',
        room_id: roomId,
        roomId,
        archived_by: currentUserId,
        archived_at: archivedAt,
      },
      [currentUserId]
    );

    return res.json({
      success: true,
      archive: {
        ...archive,
        roomId,
        room_id: roomId,
        archivedBy: currentUserId,
        archived_by: currentUserId,
        archivedAt,
        archived_at: archivedAt,
      },
    });
  } catch (err) {
    console.error('ARCHIVE ROOM ERROR:', err.message);

    return res.status(getStatusCode(err)).json({
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

    const items = await Promise.all(result.rows.map(async (row) => {
      const avatarUrl = await resolveAvatarUrl(row.profile_photo_url || null);
      return {
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

        avatarUrl,
        avatar_url: avatarUrl,

        profilePhotoUrl: avatarUrl,
        profile_photo_url: avatarUrl,
      };
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

exports.getMessagingContacts = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const role = getCurrentRole(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!isAdminLike(req)) {
      return res.status(403).json({ message: 'Account messaging access is required.' });
    }

    const studentParams = [currentUserId];
    let pdCourseFilter = '';
    if (role === 'pd') {
      pdCourseFilter = `
        AND EXISTS (
          SELECT 1
          FROM program_director_course_assignments assignment
          WHERE assignment.pd_user_id = $1
            AND assignment.course_id = s.course_id
            AND assignment.is_active = true
        )
      `;
    }

    const studentsResult = await db.query(
      `
      SELECT
        u.user_id,
        u.role,
        s.student_id,
        s.pdm_id AS student_number,
        s.first_name,
        s.last_name,
        s.profile_photo_url,
        COALESCE(c.course_code, c.course_name, 'Student') AS program_name
      FROM students s
      JOIN users u ON u.user_id = s.user_id
      LEFT JOIN academic_course c ON c.course_id = s.course_id
      WHERE COALESCE(s.is_archived, false) = false
        AND u.user_id <> $1
        ${pdCourseFilter}
      ORDER BY s.last_name ASC NULLS LAST, s.first_name ASC NULLS LAST
      `,
      studentParams
    );

    const adminPhotoEnabled = await hasAdminProfilePhotoColumn();
    const adminPhotoSelect = adminPhotoEnabled
      ? 'ap.profile_photo_url'
      : 'NULL::text AS profile_photo_url';

    const staffResult = await db.query(
      `
      SELECT
        u.user_id,
        u.role,
        u.username,
        u.email,
        ap.first_name,
        ap.last_name,
        ap.department,
        ap.position,
        ${adminPhotoSelect}
      FROM users u
      LEFT JOIN admin_profiles ap ON ap.user_id = u.user_id
      WHERE LOWER(COALESCE(u.role, '')) IN ('admin', 'osfa_admin', 'sdo', 'guidance', 'pd', 'ro_coordinator')
        AND COALESCE(ap.is_archived, false) = false
        AND u.user_id <> $1
      ORDER BY ap.last_name ASC NULLS LAST, ap.first_name ASC NULLS LAST
      `,
      [currentUserId]
    );

    const studentItems = await Promise.all(studentsResult.rows.map(async (row) => {
      const avatarUrl = await resolveAvatarUrl(row.profile_photo_url || null);
      return {
        user_id: row.user_id,
        userId: row.user_id,
        student_id: row.student_id,
        studentId: row.student_id,
        student_number: row.student_number,
        studentNumber: row.student_number,
        first_name: row.first_name,
        firstName: row.first_name,
        last_name: row.last_name,
        lastName: row.last_name,
        student_name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown Student',
        studentName: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown Student',
        avatar_url: avatarUrl,
        avatarUrl,
        program_name: row.program_name,
        programName: row.program_name,
        benefactor_name: 'Student',
        benefactorName: 'Student',
        role: row.role,
        contact_type: 'student',
      };
    }));

    const staffItems = await Promise.all(staffResult.rows.map(async (row) => {
      const avatarUrl = await resolveAvatarUrl(row.profile_photo_url || null);
      const name =
        [row.first_name, row.last_name].filter(Boolean).join(' ') ||
        row.username ||
        row.email ||
        'Account';
      const roleLabel = row.role === 'ro_coordinator'
        ? 'RO Coordinator'
        : String(row.role || 'user')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (character) => character.toUpperCase());
      return {
        user_id: row.user_id,
        userId: row.user_id,
        student_id: '',
        studentId: '',
        student_number: row.department || roleLabel,
        studentNumber: row.department || roleLabel,
        first_name: row.first_name,
        firstName: row.first_name,
        last_name: row.last_name,
        lastName: row.last_name,
        student_name: name,
        studentName: name,
        avatar_url: avatarUrl,
        avatarUrl,
        program_name: row.department || 'Office',
        programName: row.department || 'Office',
        benefactor_name: roleLabel,
        benefactorName: roleLabel,
        role: row.role,
        position: row.position,
        contact_type: 'authorized_user',
      };
    }));

    return res.json({ items: [...staffItems, ...studentItems] });
  } catch (err) {
    console.error('GET MESSAGING CONTACTS ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to load messaging contacts',
      error: err.message,
    });
  }
};
