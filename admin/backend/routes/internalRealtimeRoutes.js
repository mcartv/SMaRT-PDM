const express = require('express');

const router = express.Router();

function getSecret(req) {
    return String(req.headers['x-internal-realtime-secret'] || '').trim();
}

function requireInternalSecret(req, res, next) {
    const expected = String(process.env.INTERNAL_REALTIME_SECRET || '').trim();

    if (!expected) {
        return res.status(500).json({
            success: false,
            message: 'INTERNAL_REALTIME_SECRET is missing in admin backend .env',
        });
    }

    if (getSecret(req) !== expected) {
        return res.status(401).json({
            success: false,
            message: 'Invalid internal realtime secret',
        });
    }

    return next();
}

function cleanId(value) {
    return String(value || '').trim();
}

function uniqueIds(values = []) {
    return [...new Set(values.map(cleanId).filter(Boolean))];
}

function normalizeMessage(raw = {}) {
    const messageId = raw.message_id || raw.messageId || raw.id || '';
    const senderId = raw.sender_id || raw.senderId || '';
    const receiverId = raw.receiver_id || raw.receiverId || '';
    const roomId = raw.room_id || raw.roomId || null;
    const body = raw.message_body || raw.messageBody || raw.body || raw.content || '';

    return {
        messageId,
        message_id: messageId,

        senderId,
        sender_id: senderId,

        receiverId,
        receiver_id: receiverId,

        roomId,
        room_id: roomId,

        subject: raw.subject || null,

        messageBody: body,
        message_body: body,

        sentAt: raw.sent_at || raw.sentAt || raw.created_at || new Date().toISOString(),
        sent_at: raw.sent_at || raw.sentAt || raw.created_at || new Date().toISOString(),

        isRead: raw.is_read === true || raw.isRead === true,
        is_read: raw.is_read === true || raw.isRead === true,

        attachmentUrl: raw.attachment_url || raw.attachmentUrl || null,
        attachment_url: raw.attachment_url || raw.attachmentUrl || null,

        attachmentName: raw.attachment_name || raw.attachmentName || null,
        attachment_name: raw.attachment_name || raw.attachmentName || null,

        senderName: raw.sender_name || raw.senderName || '',
        sender_name: raw.sender_name || raw.senderName || '',

        senderRole: raw.sender_role || raw.senderRole || null,
        sender_role: raw.sender_role || raw.senderRole || null,

        senderProfilePhotoUrl:
            raw.sender_profile_photo_url || raw.senderProfilePhotoUrl || null,
        sender_profile_photo_url:
            raw.sender_profile_photo_url || raw.senderProfilePhotoUrl || null,

        senderAvatarUrl: raw.sender_avatar_url || raw.senderAvatarUrl || null,
        sender_avatar_url: raw.sender_avatar_url || raw.senderAvatarUrl || null,

        relayed_at: new Date().toISOString(),
    };
}

router.post('/message-created', requireInternalSecret, (req, res) => {
    const io = req.app.get('io');

    if (!io) {
        return res.status(500).json({
            success: false,
            message: 'Admin Socket.IO instance is missing',
        });
    }

    const payload = normalizeMessage(req.body || {});

    if (!payload.message_id) {
        return res.status(400).json({
            success: false,
            message: 'message_id is required',
        });
    }

    const explicitTargets =
        req.body?.target_user_ids ||
        req.body?.targetUserIds ||
        req.body?.targets ||
        [];

    const targetUserIds = uniqueIds([
        payload.sender_id,
        payload.receiver_id,
        ...(Array.isArray(explicitTargets) ? explicitTargets : []),
    ]);

    console.log('[Internal Realtime] message-created received:', {
        message_id: payload.message_id,
        sender_id: payload.sender_id,
        receiver_id: payload.receiver_id,
        room_id: payload.room_id,
        targetUserIds,
    });

    for (const userId of targetUserIds) {
        io.to(`user:${userId}`).emit('message:new', payload);
        io.to(`user:${userId}`).emit('message:created', payload);
    }

    io.emit('message:new', payload);
    io.emit('message:created', payload);

    return res.json({
        success: true,
        emitted: true,
        targetUserIds,
    });
});

module.exports = router;
