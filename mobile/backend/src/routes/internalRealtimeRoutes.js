const express = require('express');

const { resolveInternalRealtimeSecret } = require('../utils/internalRealtimeSecret');

const router = express.Router();

function cleanText(value) {
  return String(value || '').trim();
}

function uniqueIds(values = []) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function requireInternalSecret(req, res, next) {
  const expected = cleanText(resolveInternalRealtimeSecret());
  const supplied = cleanText(req.headers['x-internal-realtime-secret']);

  if (!expected) {
    return res.status(500).json({
      success: false,
      message: 'Internal realtime authentication is not configured.',
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
    'conversation:updated',
    'room:created',
    'room:members-added',
    'room:members-removed',
    'room:member-left',
    'room:member-promoted',
    'room:updated',
    'room:archived',
    'room:restored',
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



// RO events sent from the Admin/RO Coordinator backend to the scholar app.
// This is separate from message-event so message payload normalization cannot
// corrupt RO fields.
router.post('/ro-event', requireInternalSecret, (req, res) => {
  const io = req.app.get('io');

  if (!io) {
    return res.status(500).json({
      success: false,
      message: 'Student Socket.IO instance is missing',
    });
  }

  const eventName = cleanText(req.body?.event || req.body?.event_name);
  const allowedEvents = new Set([
    'ro:updated',
    'roUpdated',
    'ro:cleared',
    'ro:progress-updated',
    'ro:time-in',
    'ro:time-out',
    'ro:log-created',
    'ro:log-updated',
  ]);

  if (!allowedEvents.has(eventName)) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported realtime RO event',
    });
  }

  const rawPayload =
    req.body?.payload && typeof req.body.payload === 'object'
      ? req.body.payload
      : {};

  const payload = {
    ...rawPayload,
    relayed_at: new Date().toISOString(),
  };

  const explicitTargets =
    req.body?.target_user_ids ||
    req.body?.targetUserIds ||
    [];

  const targetUserIds = uniqueIds([
    payload.target_user_id,
    payload.targetUserId,
    ...(Array.isArray(explicitTargets) ? explicitTargets : []),
  ]);

  if (!targetUserIds.length) {
    return res.status(400).json({
      success: false,
      message: 'At least one target user is required for an RO realtime event',
    });
  }

  for (const userId of targetUserIds) {
    io.to(`user:${userId}`).emit(eventName, payload);
  }

  return res.status(200).json({
    success: true,
    event: eventName,
    targetUserIds,
  });
});


// Renewal/configuration events sent from the Admin backend to the scholar app.
// These events intentionally contain only non-sensitive refresh metadata.
router.post('/renewal-event', requireInternalSecret, (req, res) => {
  const io = req.app.get('io');

  if (!io) {
    return res.status(500).json({
      success: false,
      message: 'Student Socket.IO instance is missing',
    });
  }

  const eventName = cleanText(req.body?.event || req.body?.event_name);
  const allowedEvents = new Set([
    'renewal:created',
    'renewal:updated',
    'renewal:approved',
    'renewal:rejected',
  ]);

  if (!allowedEvents.has(eventName)) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported realtime renewal event',
    });
  }

  const rawPayload =
    req.body?.payload && typeof req.body.payload === 'object'
      ? req.body.payload
      : {};

  const payload = {
    ...rawPayload,
    relayed_at: new Date().toISOString(),
  };

  // Academic-period changes and Admin renewal decisions affect server state.
  // Broadcasting only refresh metadata lets every connected scholar re-fetch
  // their own authenticated renewal package without leaking another user's data.
  io.emit(eventName, payload);

  return res.status(200).json({
    success: true,
    event: eventName,
  });
});


// Generic refresh events sent from the Admin backend to the scholar app.
// Payloads are intentionally limited to non-sensitive metadata. Mobile screens
// re-fetch their own authenticated data after receiving the event.
router.post('/module-event', requireInternalSecret, (req, res) => {
  const io = req.app.get('io');

  if (!io) {
    return res.status(500).json({
      success: false,
      message: 'Student Socket.IO instance is missing',
    });
  }

  const eventName = cleanText(req.body?.event || req.body?.event_name);
  const allowedEvents = new Set([
    'settings:updated',
    'maintenance:updated',
    'faq:updated',
    'program:updated',
    'academic:updated',
    'profile:updated',
    'application:created',
    'application:updated',
    'application:approved',
    'application:rejected',
    'application:disqualified',
    'application-document:reviewed',
    'ro:settings-updated',
    'scholar:created',
    'scholar:updated',
    'scholar:archived',
    'scholar:restored',
    'scholar:released',
    'payout:created',
    'payout:updated',
    'payout:deleted',
    'payout:archived',
    'payout:restored',
    'payout:proof-reviewed',
  ]);

  if (!allowedEvents.has(eventName)) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported realtime module event',
    });
  }

  const rawPayload =
    req.body?.payload && typeof req.body.payload === 'object'
      ? req.body.payload
      : {};

  const payload = {
    ...rawPayload,
    relayed_at: new Date().toISOString(),
  };

  const explicitTargets =
    req.body?.target_user_ids || req.body?.targetUserIds || [];
  const targetUserIds = uniqueIds(
    Array.isArray(explicitTargets) ? explicitTargets : []
  );

  if (targetUserIds.length) {
    for (const userId of targetUserIds) {
      io.to(`user:${userId}`).emit(eventName, payload);
    }
  } else {
    // These are refresh-only events. Broadcasting does not expose another
    // scholar's records because clients fetch their own authenticated data.
    io.emit(eventName, payload);
  }

  return res.status(200).json({
    success: true,
    event: eventName,
    targetUserIds,
    broadcast: targetUserIds.length === 0,
  });
});

module.exports = router;
