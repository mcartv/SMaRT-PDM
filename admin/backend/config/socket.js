/**
 * Socket.io Event Emitter Utility
 * Centralized realtime event names for SMaRT-PDM.
 *
 * Naming rule:
 * - Use :created when a new record is created.
 * - Use :updated when an existing record changes.
 * - Use :archived when a record is hidden/soft-deleted.
 * - Use :restored when an archived record is brought back.
 * - Use :deleted only for true permanent deletion. Current admin modules use archive/restore.
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

const addMeta = (data = {}) => ({
    ...data,
    emitted_at: new Date().toISOString(),
});

const emitEvent = (io, eventName, data = {}) => {
    if (!io) {
        console.warn(`[Socket] No io instance available for event: ${eventName}`);
        return;
    }

    const payload = addMeta(data);
    console.log(`[Socket] Emitting global: ${eventName}`, payload);
    io.emit(eventName, payload);
};

const emitToUser = (io, userId, eventName, data = {}) => {
    if (!io) {
        console.warn(`[Socket] No io instance available for event: ${eventName}`);
        return;
    }

    const normalizedUserId = String(userId || '').trim();

    if (!normalizedUserId) {
        console.warn(`[Socket] Missing userId for event: ${eventName}`);
        return;
    }

    const payload = addMeta(data);
    console.log(`[Socket] Emitting to user ${normalizedUserId}: ${eventName}`, payload);
    io.to(`user:${normalizedUserId}`).emit(eventName, payload);
};

const emitToUsers = (io, userIds = [], eventName, data = {}) => {
    if (!io) {
        console.warn(`[Socket] No io instance available for event: ${eventName}`);
        return;
    }

    const targetUserIds = normalizeUserIds(userIds);

    if (!targetUserIds.length) {
        console.warn(`[Socket] No target users for event: ${eventName}`);
        return;
    }

    const payload = addMeta(data);

    targetUserIds.forEach((userId) => {
        console.log(`[Socket] Emitting to user ${userId}: ${eventName}`, payload);
        io.to(`user:${userId}`).emit(eventName, payload);
    });
};

const emitToRoom = (io, roomName, eventName, data = {}) => {
    if (!io) {
        console.warn(`[Socket] No io instance available for event: ${eventName}`);
        return;
    }

    if (!roomName) {
        console.warn(`[Socket] Missing roomName for event: ${eventName}`);
        return;
    }

    const payload = addMeta(data);
    console.log(`[Socket] Emitting to room ${roomName}: ${eventName}`, payload);
    io.to(roomName).emit(eventName, payload);
};

function emitMessageEvent(io, eventName, data = {}, options = {}) {
    const targetUserIds = normalizeUserIds(options.targetUserIds || []);

    if (targetUserIds.length) {
        emitToUsers(io, targetUserIds, eventName, data);
        return;
    }

    emitEvent(io, eventName, data);
}

const socketEvents = {
    /** Base emitters. */
    emitEvent,
    emitToUser,
    emitToUsers,
    emitToRoom,

    /** Dashboard-wide refresh channels. */
    dashboardUpdated: (io, data) => emitEvent(io, 'dashboard:updated', data),
    maintenanceUpdated: (io, data) => emitEvent(io, 'maintenance:updated', data),
    reportUpdated: (io, data) => emitEvent(io, 'report:updated', data),
    auditCreated: (io, data) => emitEvent(io, 'audit:created', data),

    /** Payout Management. */
    payoutCreated: (io, data) => emitEvent(io, 'payout:created', data),
    payoutUpdated: (io, data) => emitEvent(io, 'payout:updated', data),
    payoutArchived: (io, data) => emitEvent(io, 'payout:archived', data),
    payoutRestored: (io, data) => emitEvent(io, 'payout:restored', data),
    scholarReleased: (io, data) => emitEvent(io, 'scholar:released', data),

    /** Announcements. */
    announcementCreated: (io, data) => emitEvent(io, 'announcement:created', data),
    announcementUpdated: (io, data) => emitEvent(io, 'announcement:updated', data),
    announcementArchived: (io, data) => emitEvent(io, 'announcement:archived', data),
    announcementRestored: (io, data) => emitEvent(io, 'announcement:restored', data),
    announcementPublished: (io, data) => emitEvent(io, 'announcement:published', data),
    announcementRefresh: (io, data) => emitEvent(io, 'announcement:refresh', data),

    /** Applications and documents. */
    applicationCreated: (io, data) => emitEvent(io, 'application:created', data),
    applicationUpdated: (io, data) => emitEvent(io, 'application:updated', data),
    applicationApproved: (io, data) => emitEvent(io, 'application:approved', data),
    applicationRejected: (io, data) => emitEvent(io, 'application:rejected', data),
    applicationDisqualified: (io, data) => emitEvent(io, 'application:disqualified', data),
    applicationDocumentUploaded: (io, data) => emitEvent(io, 'application-document:uploaded', data),
    applicationDocumentReviewed: (io, data) => emitEvent(io, 'application-document:reviewed', data),
    applicationOcrQueued: (io, data) => emitEvent(io, 'application-ocr:queued', data),
    applicationOcrSnapshotSaved: (io, data) => emitEvent(io, 'application-ocr:snapshot-saved', data),

    /** Scholars and renewals. */
    scholarCreated: (io, data) => emitEvent(io, 'scholar:created', data),
    scholarUpdated: (io, data) => emitEvent(io, 'scholar:updated', data),
    scholarArchived: (io, data) => emitEvent(io, 'scholar:archived', data),
    scholarRestored: (io, data) => emitEvent(io, 'scholar:restored', data),
    renewalUpdated: (io, data) => emitEvent(io, 'renewal:updated', data),
    renewalApproved: (io, data) => emitEvent(io, 'renewal:approved', data),
    renewalArchived: (io, data) => emitEvent(io, 'renewal:archived', data),
    renewalRestored: (io, data) => emitEvent(io, 'renewal:restored', data),

    /** Endorsements. */
    endorsementUpdated: (io, data) => emitEvent(io, 'endorsement:updated', data),
    endorsementArchived: (io, data) => emitEvent(io, 'endorsement:archived', data),
    endorsementRestored: (io, data) => emitEvent(io, 'endorsement:restored', data),

    /** Return of Obligation. */
    roUpdated: (io, data) => emitEvent(io, 'ro:updated', data),
    roArchived: (io, data) => emitEvent(io, 'ro:archived', data),
    roRestored: (io, data) => emitEvent(io, 'ro:restored', data),

    /** Scholarship openings. */
    openingCreated: (io, data) => emitEvent(io, 'opening:created', data),
    openingUpdated: (io, data) => emitEvent(io, 'opening:updated', data),
    openingClosed: (io, data) => emitEvent(io, 'opening:closed', data),
    openingArchived: (io, data) => emitEvent(io, 'opening:archived', data),
    openingRestored: (io, data) => emitEvent(io, 'opening:restored', data),

    /** Notifications. */
    notificationCreated: (io, userId, data) => emitToUser(io, userId, 'notification:created', data),
    notificationUpdated: (io, userId, data) => emitToUser(io, userId, 'notification:updated', data),
    notificationReadAll: (io, userId, data) => emitToUser(io, userId, 'notification:read-all', data),
    notificationArchived: (io, userId, data) => emitToUser(io, userId, 'notification:archived', data),
    notificationRestored: (io, userId, data) => emitToUser(io, userId, 'notification:restored', data),

    /** Messages and rooms. */
    messageCreated: (io, data, options = {}) => emitMessageEvent(io, 'message:created', data, options),
    messageRead: (io, data, options = {}) => emitMessageEvent(io, 'message:read', data, options),
    messageUnread: (io, data, options = {}) => emitMessageEvent(io, 'message:unread', data, options),
    conversationUpdated: (io, data, options = {}) => emitMessageEvent(io, 'conversation:updated', data, options),
    threadArchived: (io, data, options = {}) => emitMessageEvent(io, 'message:thread-archived', data, options),
    threadRestored: (io, data, options = {}) => emitMessageEvent(io, 'message:thread-restored', data, options),
    roomCreated: (io, data, options = {}) => emitMessageEvent(io, 'room:created', data, options),
    roomMembersAdded: (io, data, options = {}) => emitMessageEvent(io, 'room:members-added', data, options),
    roomUpdated: (io, data, options = {}) => emitMessageEvent(io, 'room:updated', data, options),
    roomArchived: (io, data, options = {}) => emitMessageEvent(io, 'room:archived', data, options),
    roomRestored: (io, data, options = {}) => emitMessageEvent(io, 'room:restored', data, options),

    /** Tickets. */
    ticketCreated: (io, data) => emitEvent(io, 'ticket:created', data),
    ticketUpdated: (io, data) => emitEvent(io, 'ticket:updated', data),
    ticketResolved: (io, data) => emitEvent(io, 'ticket:resolved', data),
    ticketArchived: (io, data) => emitEvent(io, 'ticket:archived', data),
    ticketRestored: (io, data) => emitEvent(io, 'ticket:restored', data),
};

module.exports = socketEvents;
