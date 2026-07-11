const notificationService = require('../services/notificationService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

exports.getMyNotifications = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await notificationService.getMyNotifications(userId, req.query || {});
        return res.status(200).json(result);
    } catch (err) {
        console.error('GET NOTIFICATIONS ERROR:', err.message || err);
        return res.status(500).json({ error: err.message || 'Failed to load notifications.' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await notificationService.getUnreadCount(userId);
        return res.status(200).json(result);
    } catch (err) {
        console.error('GET UNREAD COUNT ERROR:', err.message || err);
        return res.status(500).json({ error: err.message || 'Failed to load unread count.' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await notificationService.markAsRead(userId, req.params.notificationId);
        socketEvents.notificationUpdated(req.app.get('io'), userId, result.notification);
        return res.status(200).json(result);
    } catch (err) {
        console.error('MARK NOTIFICATION READ ERROR:', err.message || err);
        return res.status(500).json({ error: err.message || 'Failed to mark notification as read.' });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await notificationService.markAllAsRead(userId);
        socketEvents.notificationReadAll(req.app.get('io'), userId, {
            user_id: userId,
            updatedCount: result.updatedCount,
        });
        return res.status(200).json(result);
    } catch (err) {
        console.error('MARK ALL NOTIFICATIONS READ ERROR:', err.message || err);
        return res.status(500).json({ error: err.message || 'Failed to mark all notifications as read.' });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await notificationService.deleteNotification(userId, req.params.notificationId);
        socketEvents.notificationDeleted(req.app.get('io'), userId, {
            notificationId: result.notificationId,
        });
        return res.status(200).json(result);
    } catch (err) {
        console.error('DELETE NOTIFICATION ERROR:', err.message || err);
        return res.status(500).json({ error: err.message || 'Failed to delete notification.' });
    }
};

exports.createAnnouncementNotifications = async (req, res) => {
    try {
        const result = await notificationService.createAnnouncementNotifications(
            req.body,
            req.user
        );

        res.status(201).json({
            message: 'Announcement notifications created successfully',
            data: result,
        });
    } catch (err) {
        console.error('CREATE ANNOUNCEMENT NOTIFICATIONS ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};
