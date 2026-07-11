/**
 * Socket.io Event Emitter Utility
 * Centralized place to emit all realtime events
 */

function normalizeUserIds(userIds = []) {
    return [
        ...new Set(
            userIds
                .flat()
                .map((id) => String(id || '').trim())
                .filter(Boolean)
        ),
    ];
}

const emitEvent = (io, eventName, data) => {
    if (!io) {
        console.warn(`[Socket] No io instance available for event: ${eventName}`);
        return;
    }

    console.log(`[Socket] Emitting global: ${eventName}`, data);
    io.emit(eventName, data);
};

const emitToUser = (io, userId, eventName, data) => {
    if (!io) {
        console.warn(`[Socket] No io instance available for event: ${eventName}`);
        return;
    }

    const normalizedUserId = String(userId || '').trim();

    if (!normalizedUserId) {
        console.warn(`[Socket] Missing userId for event: ${eventName}`);
        return;
    }

    console.log(`[Socket] Emitting to user ${normalizedUserId}: ${eventName}`, data);
    io.to(`user:${normalizedUserId}`).emit(eventName, data);
};

const emitToUsers = (io, userIds = [], eventName, data) => {
    if (!io) {
        console.warn(`[Socket] No io instance available for event: ${eventName}`);
        return;
    }

    const targetUserIds = normalizeUserIds(userIds);

    if (!targetUserIds.length) {
        console.warn(`[Socket] No target users for event: ${eventName}`);
        return;
    }

    targetUserIds.forEach((userId) => {
        console.log(`[Socket] Emitting to user ${userId}: ${eventName}`, data);
        io.to(`user:${userId}`).emit(eventName, data);
    });
};

const emitToRoom = (io, roomName, eventName, data) => {
    if (!io) {
        console.warn(`[Socket] No io instance available for event: ${eventName}`);
        return;
    }

    if (!roomName) {
        console.warn(`[Socket] Missing roomName for event: ${eventName}`);
        return;
    }

    console.log(`[Socket] Emitting to room ${roomName}: ${eventName}`, data);
    io.to(roomName).emit(eventName, data);
};

function emitMessageEvent(io, eventName, data, options = {}) {
    const targetUserIds = normalizeUserIds(options.targetUserIds || []);

    if (targetUserIds.length) {
        emitToUsers(io, targetUserIds, eventName, data);
        return;
    }

    emitEvent(io, eventName, data);
}

const socketEvents = {
    emitEvent,
    emitToUser,
    emitToUsers,
    emitToRoom,

    payoutCreated: (io, data) => emitEvent(io, 'payout:created', data),
    payoutUpdated: (io, data) => emitEvent(io, 'payout:updated', data),
    payoutDeleted: (io, data) => emitEvent(io, 'payout:deleted', data),
    scholarReleased: (io, data) => emitEvent(io, 'scholar:released', data),

    announcementCreated: (io, data) => emitEvent(io, 'announcement:created', data),
    announcementUpdated: (io, data) => emitEvent(io, 'announcement:updated', data),
    announcementDeleted: (io, data) => emitEvent(io, 'announcement:deleted', data),
    announcementPublished: (io, data) => emitEvent(io, 'announcement:published', data),
    announcementRefresh: (io, data) => emitEvent(io, 'announcement:refresh', data),

    applicationCreated: (io, data) => emitEvent(io, 'application:created', data),
    applicationUpdated: (io, data) => emitEvent(io, 'application:updated', data),
    applicationApproved: (io, data) => emitEvent(io, 'application:approved', data),
    applicationRejected: (io, data) => emitEvent(io, 'application:rejected', data),
    applicationDisqualified: (io, data) => emitEvent(io, 'application:disqualified', data),

    applicationDocumentUploaded: (io, data) =>
        emitEvent(io, 'application-document:uploaded', data),

    applicationDocumentReviewed: (io, data) =>
        emitEvent(io, 'application-document:reviewed', data),

    applicationOcrQueued: (io, data) =>
        emitEvent(io, 'application-ocr:queued', data),

    applicationOcrSnapshotSaved: (io, data) =>
        emitEvent(io, 'application-ocr:snapshot-saved', data),

    scholarUpdated: (io, data) => emitEvent(io, 'scholar:updated', data),
    scholarCreated: (io, data) => emitEvent(io, 'scholar:created', data),

    renewalUpdated: (io, data) => emitEvent(io, 'renewal:updated', data),
    renewalApproved: (io, data) => emitEvent(io, 'renewal:approved', data),

    endorsementUpdated: (io, data) => emitEvent(io, 'endorsement:updated', data),

    roUpdated: (io, data) => emitEvent(io, 'ro:updated', data),

    maintenanceUpdated: (io, data) =>
        emitEvent(io, 'maintenance:updated', data),

    reportUpdated: (io, data) => emitEvent(io, 'report:updated', data),

    notificationCreated: (io, userId, data) =>
        emitToUser(io, userId, 'notification:created', data),

    notificationUpdated: (io, userId, data) =>
        emitToUser(io, userId, 'notification:updated', data),

    notificationReadAll: (io, userId, data) =>
        emitToUser(io, userId, 'notification:read-all', data),

    notificationDeleted: (io, userId, data) =>
        emitToUser(io, userId, 'notification:deleted', data),

    messageCreated: (io, data, options = {}) =>
        emitMessageEvent(io, 'message:created', data, options),

    messageRead: (io, data, options = {}) =>
        emitMessageEvent(io, 'message:read', data, options),

    conversationUpdated: (io, data, options = {}) =>
        emitMessageEvent(io, 'conversation:updated', data, options),

    roomCreated: (io, data, options = {}) =>
        emitMessageEvent(io, 'room:created', data, options),

    roomMembersAdded: (io, data, options = {}) =>
        emitMessageEvent(io, 'room:members-added', data, options),

    roomUpdated: (io, data, options = {}) =>
        emitMessageEvent(io, 'room:updated', data, options),

    openingCreated: (io, data) => emitEvent(io, 'opening:created', data),
    openingUpdated: (io, data) => emitEvent(io, 'opening:updated', data),
    openingClosed: (io, data) => emitEvent(io, 'opening:closed', data),

    ticketCreated: (io, data) => emitEvent(io, 'ticket:created', data),
    ticketUpdated: (io, data) => emitEvent(io, 'ticket:updated', data),
    ticketResolved: (io, data) => emitEvent(io, 'ticket:resolved', data),
};

module.exports = socketEvents;