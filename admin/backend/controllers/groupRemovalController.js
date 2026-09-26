'use strict';

const db = require('../config/db');
const socketEvents = require('../utils/socketEvents');
const studentRealtimeRelayService = require('../services/studentRealtimeRelayService');
const auditLogService = require('../services/auditLogService');

function text(value) {
  return String(value || '').trim();
}

function currentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function uniqueIds(values = []) {
  return [...new Set(values.map(text).filter(Boolean))];
}

async function displayName(client, userId) {
  const result = await client.query(`
    SELECT COALESCE(
      NULLIF(TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')), ''),
      NULLIF(TRIM(COALESCE(ap.first_name, '') || ' ' || COALESCE(ap.last_name, '')), ''),
      NULLIF(TRIM(COALESCE(u.username, '')), ''),
      NULLIF(TRIM(COALESCE(u.email, '')), ''),
      'Unknown User'
    ) AS display_name
    FROM users u
    LEFT JOIN students st ON st.user_id = u.user_id
    LEFT JOIN admin_profiles ap ON ap.user_id = u.user_id
    WHERE u.user_id = $1
    LIMIT 1;
  `, [userId]);
  return result.rows[0]?.display_name || 'Unknown User';
}

function emitToUsers(io, eventName, payload, ids) {
  for (const userId of uniqueIds(ids)) {
    io?.to(`user:${userId}`).emit(eventName, payload);
  }
}

function relay(eventName, payload, ids) {
  studentRealtimeRelayService.relayMessageEvent({
    event: eventName,
    payload,
    targetUserIds: uniqueIds(ids),
  }).catch((error) => {
    console.error('[Messaging] group removal relay error:', error.message);
  });
}

async function removeMember(req, res, next) {
  const action = text(req.body?.action || '').toLowerCase();
  const routeMemberId = text(req.params?.memberId);
  if (!routeMemberId && action !== 'remove') return next();

  const actorId = text(currentUserId(req));
  const roomId = text(req.params?.roomId);
  const memberId = routeMemberId || text(req.body?.memberId || req.body?.member_id);

  if (!actorId) return res.status(401).json({ error: 'Authentication required.' });
  if (!roomId || !memberId) return res.status(400).json({ error: 'Room and member are required.' });
  if (actorId === memberId) return res.status(400).json({ error: 'Use Leave Group to remove yourself.' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const memberships = await client.query(`
      SELECT user_id, is_admin
      FROM chat_room_members
      WHERE room_id = $1
      ORDER BY user_id
      FOR UPDATE;
    `, [roomId]);

    const actorMembership = memberships.rows.find((row) => String(row.user_id) === actorId);
    const targetMembership = memberships.rows.find((row) => String(row.user_id) === memberId);

    if (!actorMembership || actorMembership.is_admin !== true) {
      const error = new Error('Only a group admin can remove members.');
      error.statusCode = 403;
      throw error;
    }
    if (!targetMembership) {
      const error = new Error('Group member not found.');
      error.statusCode = 404;
      throw error;
    }
    if (targetMembership.is_admin === true) {
      const error = new Error('Another group admin cannot be removed.');
      error.statusCode = 403;
      throw error;
    }

    const [actorName, targetName] = await Promise.all([
      displayName(client, actorId),
      displayName(client, memberId),
    ]);

    // Write the removal activity before deleting membership. The membership-end
    // trigger then records a cutoff at/after this message, making it the final
    // visible group event for the removed user.
    const messageResult = await client.query(`
      INSERT INTO messages (sender_id, receiver_id, room_id, subject, message_body)
      VALUES ($1, NULL, $2, 'system', $3)
      RETURNING message_id, sender_id, receiver_id, room_id, subject, message_body, sent_at;
    `, [actorId, roomId, `${actorName} removed ${targetName} from the group`]);
    const message = messageResult.rows[0];

    await client.query(`
      INSERT INTO message_read_states (message_id, user_id, is_read)
      SELECT $1, crm.user_id, (crm.user_id = $2)
      FROM chat_room_members crm
      WHERE crm.room_id = $3
      ON CONFLICT (message_id, user_id)
      DO UPDATE SET is_read = EXCLUDED.is_read, updated_at = now();
    `, [message.message_id, actorId, roomId]);

    await client.query(
      'DELETE FROM chat_room_members WHERE room_id = $1 AND user_id = $2;',
      [roomId, memberId]
    );

    await client.query('COMMIT');

    const targetIds = uniqueIds([...memberships.rows.map((row) => row.user_id), actorId, memberId]);
    const messagePayload = {
      messageId: message.message_id,
      message_id: message.message_id,
      senderId: actorId,
      sender_id: actorId,
      receiverId: null,
      receiver_id: null,
      roomId,
      room_id: roomId,
      subject: 'system',
      messageBody: message.message_body,
      message_body: message.message_body,
      sentAt: message.sent_at,
      sent_at: message.sent_at,
      senderName: actorName,
      sender_name: actorName,
      isRead: false,
      is_read: false,
      created_at: message.sent_at,
    };

    const io = req.app.get('io');
    if (socketEvents?.messageCreated) {
      socketEvents.messageCreated(io, messagePayload, { targetUserIds: targetIds });
    } else {
      emitToUsers(io, 'message:new', messagePayload, targetIds);
      emitToUsers(io, 'message:created', messagePayload, targetIds);
    }
    relay('message:new', messagePayload, targetIds);

    const removedAt = new Date().toISOString();
    const removalPayload = {
      room_id: roomId,
      roomId,
      member_id: memberId,
      memberId,
      removed_by: actorId,
      removedBy: actorId,
      removed_by_name: actorName,
      removedByName: actorName,
      member_name: targetName,
      memberName: targetName,
      removal_message_id: message.message_id,
      removalMessageId: message.message_id,
      updated_at: removedAt,
    };
    emitToUsers(io, 'room:members-removed', removalPayload, targetIds);
    relay('room:members-removed', removalPayload, targetIds);

    try {
      await auditLogService?.logAudit?.({
        req,
        actionTaken: 'REMOVE_GROUP_MEMBER',
        module: 'Messages',
        entityType: 'chat_room',
        entityId: roomId,
        description: `${actorName} removed ${targetName} from a group chat.`,
        metadata: { roomId, memberId, actorId, removalMessageId: message.message_id },
      });
    } catch (auditError) {
      console.warn('[Messaging] group removal audit error:', auditError.message);
    }

    return res.status(200).json({
      success: true,
      action: 'remove',
      roomId,
      room_id: roomId,
      memberId,
      member_id: memberId,
      removedBy: actorId,
      removed_by: actorId,
      removedByName: actorName,
      removed_by_name: actorName,
      memberName: targetName,
      member_name: targetName,
      removalMessage: messagePayload,
      removal_message: messagePayload,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('REMOVE GROUP MEMBER WITH AUDIT ERROR:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to remove group member.',
    });
  } finally {
    client.release();
  }
}

exports.removeMember = removeMember;
