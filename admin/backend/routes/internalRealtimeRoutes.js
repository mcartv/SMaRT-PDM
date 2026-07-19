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
        event: 'message-created',
        targetUserIds,
    });
});

router.post('/ro-updated', requireInternalSecret, (req, res) => {
    const io = req.app.get('io');

    if (!io) {
        return res.status(500).json({
            success: false,
            message: 'Admin Socket.IO instance is missing',
        });
    }

    const now = new Date().toISOString();

    const payload = {
        source: req.body?.source || 'mobile-relay',
        action: req.body?.action || 'update',
        updated_at: req.body?.updated_at || now,

        ro_id: req.body?.ro_id || req.body?.roId || null,
        roId: req.body?.roId || req.body?.ro_id || null,

        student_id: req.body?.student_id || req.body?.studentId || null,
        studentId: req.body?.studentId || req.body?.student_id || null,

        application_id: req.body?.application_id || req.body?.applicationId || null,
        applicationId: req.body?.applicationId || req.body?.application_id || null,

        opening_id: req.body?.opening_id || req.body?.openingId || null,
        openingId: req.body?.openingId || req.body?.opening_id || null,

        log_id: req.body?.log_id || req.body?.logId || null,
        logId: req.body?.logId || req.body?.log_id || null,

        proof_id: req.body?.proof_id || req.body?.proofId || null,
        proofId: req.body?.proofId || req.body?.proof_id || null,

        assignment_status:
            req.body?.assignment_status || req.body?.assignmentStatus || null,
        assignmentStatus:
            req.body?.assignmentStatus || req.body?.assignment_status || null,

        progress_status:
            req.body?.progress_status || req.body?.progressStatus || null,
        progressStatus:
            req.body?.progressStatus || req.body?.progress_status || null,

        ro_status: req.body?.ro_status || req.body?.roStatus || null,
        roStatus: req.body?.roStatus || req.body?.ro_status || null,

        data: req.body?.data || null,
        realtime: req.body?.realtime || null,
    };

    console.log('[Internal Realtime] ro-updated received:', {
        source: payload.source,
        action: payload.action,
        ro_id: payload.ro_id,
        student_id: payload.student_id,
        assignment_status: payload.assignment_status,
        progress_status: payload.progress_status,
        ro_status: payload.ro_status,
    });

    io.emit('ro:updated', payload);
    io.emit('roUpdated', payload);

    if (
        payload.action === 'assign' ||
        payload.action === 'batch-assign' ||
        payload.action === 'acknowledge' ||
        payload.action === 'conflict' ||
        payload.action === 'clear'
    ) {
        io.emit('ro:assignment-updated', payload);
    }

    if (
        payload.action === 'time-in' ||
        payload.action === 'time-out' ||
        payload.action === 'auto-time-out' ||
        payload.action === 'validate-log'
    ) {
        io.emit('ro:time-log-updated', payload);
    }

    if (payload.action === 'review-proof' || payload.action === 'upload-proof') {
        io.emit('ro:proof-updated', payload);
    }

    return res.json({
        success: true,
        emitted: true,
        event: 'ro-updated',
        payload,
    });
});

module.exports = router;