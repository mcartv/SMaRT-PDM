const notificationService = require('../services/notificationService');

function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);
    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

async function getMyNotifications(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });

        const result = await notificationService.getMyNotifications(userId, req.query || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET NOTIFICATIONS ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load notifications.',
        });
    }
}

async function getUnreadCount(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });

        const result = await notificationService.getUnreadCount(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET UNREAD COUNT ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load unread count.',
        });
    }
}

async function markAsRead(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });

        const result = await notificationService.markAsRead(userId, req.params.notificationId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('MARK NOTIFICATION READ ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to mark notification as read.',
        });
    }
}

async function markAllAsRead(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });

        const result = await notificationService.markAllAsRead(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('MARK ALL READ ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to mark all notifications as read.',
        });
    }
}

async function deleteNotification(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });

        const result = await notificationService.deleteNotification(
            userId,
            req.params.notificationId
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('DELETE NOTIFICATION ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to delete notification.',
        });
    }
}

async function registerDeviceToken(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });

        const result = await notificationService.registerDeviceToken(userId, req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('REGISTER DEVICE TOKEN ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to register device token.',
        });
    }
}

async function createInternalUserNotification(req, res) {
    try {
        const result = await notificationService.createInternalUserNotification(req);
        return res.status(201).json(result);
    } catch (error) {
        console.error('INTERNAL USER NOTIFICATION ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to create internal notification.',
        });
    }
}

module.exports = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    registerDeviceToken,
    createInternalUserNotification,
};