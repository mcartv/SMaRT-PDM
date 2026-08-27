const express = require('express');

const router = express.Router();

function cleanText(value) {
  return String(value || '').trim();
}

function uniqueIds(values = []) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function requireInternalSecret(req, res, next) {
  const expected = cleanText(process.env.INTERNAL_REALTIME_SECRET);
  const supplied = cleanText(req.headers['x-internal-realtime-secret']);

  if (!expected) {
    return res.status(500).json({
      success: false,
      message: 'INTERNAL_REALTIME_SECRET is missing in student backend .env',
    });
  }

  if (!supplied || supplied !== expected) {
    return res.status(401).json({
      success: false,
      message: 'Invalid internal realtime secret',
    });
  }

  return next();
}

function normalizePayload(raw = {}) {
  const messageId = raw.message_id || raw.messageId || raw.id || '';
  const senderId = raw.sender_id || raw.senderId || '';
  const receiverId = raw.receiver_id || raw.receiverId || '';
  const roomId = raw.room_id || raw.roomId || null;
  const body = raw.message_body || raw.messageBody || raw.body || raw.content || '';

  return {
    ...raw,
    messageId,
    message_id: messageId,
    senderId,
    sender_id: senderId,
    receiverId,
    receiver_id: receiverId,
    roomId,
    room_id: roomId,
    messageBody: body,
    message_body: body,
    sentAt: raw.sent_at || raw.sentAt || raw.created_at || new Date().toISOString(),
    sent_at: raw.sent_at || raw.sentAt || raw.created_at || new Date().toISOString(),
    isRead: raw.is_read === true || raw.isRead === true,
    is_read: raw.is_read === true || raw.isRead === true,
    relayed_at: new Date().toISOString(),
  };
}

router.post('/message-event', requireInternalSecret, (req, res) => {
  const io = req.app.get('io');

  if (!io) {
    return res.status(500).json({
      success: false,
      message: 'Student Socket.IO instance is missing',
    });
  }

  const eventName = cleanText(req.body?.event || req.body?.event_name);
  const allowedEvents = new Set([
    'message:new',
    'message:created',
    'message:updated',
    'message:read',
    'message:unread',
    'message:thread-archived',
    'message:thread-restored',
    'room:created',
    'room:members-added',
    'room:members-removed',
    'room:member-left',
    'room:member-promoted',
  ]);

  if (!allowedEvents.has(eventName)) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported realtime message event',
    });
  }

  const rawPayload = req.body?.payload || req.body?.message || req.body || {};
  const payload = normalizePayload(rawPayload);
  const explicitTargets = req.body?.target_user_ids || req.body?.targetUserIds || [];
  const targetUserIds = uniqueIds([
    payload.sender_id,
    payload.receiver_id,
    ...(Array.isArray(explicitTargets) ? explicitTargets : []),
  ]);

  for (const userId of targetUserIds) {
    io.to(`user:${userId}`).emit(eventName, payload);
  }

  if (payload.room_id) {
    io.to(`group:${payload.room_id}`).emit(eventName, payload);
  }

  return res.status(200).json({
    success: true,
    event: eventName,
    targetUserIds,
    roomId: payload.room_id || null,
  });
});

module.exports = router;
