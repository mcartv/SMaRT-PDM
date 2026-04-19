/**
 * Socket.io Event Emitter Utility
 * Centralized place to emit all realtime events
 */

const emitEvent = (io, eventName, data) => {
    if (!io) {
        console.warn(`[Socket] No io instance available for event: ${eventName}`);
        return;
    }
    console.log(`[Socket] Emitting: ${eventName}`, data);
    io.emit(eventName, data);
};

const emitToUser = (io, userId, eventName, data) => {
    if (!io) return;
    console.log(`[Socket] Emitting to user ${userId}: ${eventName}`, data);
    io.to(`user:${userId}`).emit(eventName, data);
};

const emitToRoom = (io, roomName, eventName, data) => {
    if (!io) return;
    console.log(`[Socket] Emitting to room ${roomName}: ${eventName}`, data);
    io.to(roomName).emit(eventName, data);
};

// Event emission functions
const socketEvents = {
    // Payout Events
    payoutCreated: (io, data) => emitEvent(io, 'payout:created', data),
    payoutUpdated: (io, data) => emitEvent(io, 'payout:updated', data),
    payoutDeleted: (io, data) => emitEvent(io, 'payout:deleted', data),
    scholarReleased: (io, data) => emitEvent(io, 'scholar:released', data),

    // Announcement Events
    announcementCreated: (io, data) => emitEvent(io, 'announcement:created', data),
    announcementUpdated: (io, data) => emitEvent(io, 'announcement:updated', data),
    announcementDeleted: (io, data) => emitEvent(io, 'announcement:deleted', data),

    // Application Events
    applicationUpdated: (io, data) => emitEvent(io, 'application:updated', data),
    applicationApproved: (io, data) => emitEvent(io, 'application:approved', data),
    applicationRejected: (io, data) => emitEvent(io, 'application:rejected', data),

    // Scholar Events
    scholarUpdated: (io, data) => emitEvent(io, 'scholar:updated', data),
    scholarCreated: (io, data) => emitEvent(io, 'scholar:created', data),

    // Renewal Events
    renewalUpdated: (io, data) => emitEvent(io, 'renewal:updated', data),
    renewalApproved: (io, data) => emitEvent(io, 'renewal:approved', data),

    // Notification Events
    notificationCreated: (io, userId, data) => emitToUser(io, userId, 'notification:created', data),

    // Message Events
    messageCreated: (io, data) => emitEvent(io, 'message:created', data),

    // Scholarship Opening Events
    openingCreated: (io, data) => emitEvent(io, 'opening:created', data),
    openingUpdated: (io, data) => emitEvent(io, 'opening:updated', data),
    openingClosed: (io, data) => emitEvent(io, 'opening:closed', data),

    // Support Ticket Events
    ticketCreated: (io, data) => emitEvent(io, 'ticket:created', data),
    ticketUpdated: (io, data) => emitEvent(io, 'ticket:updated', data),
    ticketResolved: (io, data) => emitEvent(io, 'ticket:resolved', data),
};

module.exports = socketEvents;
