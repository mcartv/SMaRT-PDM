function normalizeNotification(notification = {}) {
    const id = notification.notification_id || notification.notificationId || notification.id || null;
    const userId = notification.user_id || notification.userId || null;
    const referenceId = notification.reference_id || notification.referenceId || null;
    const referenceType = notification.reference_type || notification.referenceType || null;
    const createdAt = notification.created_at || notification.createdAt || new Date().toISOString();

    return {
        id,
        notificationId: id,
        notification_id: id,

        userId,
        user_id: userId,

        title: notification.title || '',
        message: notification.message || '',
        type: notification.type || '',

        referenceId,
        reference_id: referenceId,

        referenceType,
        reference_type: referenceType,

        isRead: notification.is_read === true || notification.isRead === true,
        is_read: notification.is_read === true || notification.isRead === true,

        createdAt,
        created_at: createdAt,
    };
}

function emitNotificationCreated(req, notification) {
    const io = req.app.get('io');

    if (!io || !notification) return;

    const payload = normalizeNotification(notification);

    io.emit('notification:new', payload);
    io.emit('notification:created', payload);
    io.emit('notification:updated', payload);

    // Compatibility aliases
    io.emit('notifications:updated', payload);
    io.emit('notificationCreated', payload);
    io.emit('notificationUpdated', payload);
}

function emitNotificationRead(req, payload = {}) {
    const io = req.app.get('io');

    if (!io) return;

    const data = {
        action: 'read',
        updated_at: new Date().toISOString(),
        ...payload,
    };

    io.emit('notification:read', data);
    io.emit('notification:updated', data);
    io.emit('notifications:updated', data);
    io.emit('notificationUpdated', data);
}

function emitNotificationReadAll(req, payload = {}) {
    const io = req.app.get('io');

    if (!io) return;

    const data = {
        action: 'read-all',
        updated_at: new Date().toISOString(),
        ...payload,
    };

    io.emit('notification:read-all', data);
    io.emit('notification:updated', data);
    io.emit('notifications:updated', data);
    io.emit('notificationUpdated', data);
}

module.exports = {
    normalizeNotification,
    emitNotificationCreated,
    emitNotificationRead,
    emitNotificationReadAll,
};