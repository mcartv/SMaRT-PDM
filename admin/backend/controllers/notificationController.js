const notificationService = require('../services/notificationService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

async function writeNotificationAudit(req, actionTaken, description, metadata = {}) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') return;

        await auditLogService.logAudit({
            req,
            userId: getRequestUserId(req),
            actionTaken,
            module: 'Notifications',
            entityType: 'notification',
            entityId: metadata.notification_id || metadata.notificationId || null,
            description,
            metadata,
        });
    } catch (error) {
        console.error('NOTIFICATION AUDIT ERROR:', error.message);
    }
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
        await writeNotificationAudit(req, 'MARK_NOTIFICATION_READ', 'Marked notification as read.', { notification_id: req.params.notificationId, user_id: userId });
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
        await writeNotificationAudit(req, 'MARK_ALL_NOTIFICATIONS_READ', 'Marked all notifications as read.', { user_id: userId, updated_count: result.updatedCount });
        return res.status(200).json(result);
    } catch (err) {
        console.error('MARK ALL NOTIFICATIONS READ ERROR:', err.message || err);
        return res.status(500).json({ error: err.message || 'Failed to mark all notifications as read.' });
    }
};

exports.archiveNotification = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        if (typeof notificationService.archiveNotification !== 'function') {
            return res.status(501).json({ error: 'notificationService.archiveNotification is not implemented.' });
        }

        const result = await notificationService.archiveNotification(userId, req.params.notificationId);

        socketEvents.notificationArchived(req.app.get('io'), userId, {
            notificationId: result.notificationId || req.params.notificationId,
            notification_id: result.notificationId || req.params.notificationId,
            archived_at: new Date().toISOString(),
        });

        await writeNotificationAudit(
            req,
            'ARCHIVE_NOTIFICATION',
            'Archived notification.',
            {
                notification_id: result.notificationId || req.params.notificationId,
                user_id: userId,
            }
        );

        return res.status(200).json({
            ...result,
            message: result.message || 'Notification archived successfully.',
        });
    } catch (err) {
        console.error('ARCHIVE NOTIFICATION ERROR:', err.message || err);
        return res.status(500).json({ error: err.message || 'Failed to archive notification.' });
    }
};

exports.restoreNotification = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        if (typeof notificationService.restoreNotification !== 'function') {
            return res.status(501).json({ error: 'notificationService.restoreNotification is not implemented.' });
        }

        const result = await notificationService.restoreNotification(userId, req.params.notificationId);

        socketEvents.notificationRestored(req.app.get('io'), userId, {
            notificationId: result.notificationId || req.params.notificationId,
            notification_id: result.notificationId || req.params.notificationId,
            restored_at: new Date().toISOString(),
        });

        await writeNotificationAudit(
            req,
            'RESTORE_NOTIFICATION',
            'Restored notification.',
            {
                notification_id: result.notificationId || req.params.notificationId,
                user_id: userId,
            }
        );

        return res.status(200).json({
            ...result,
            message: result.message || 'Notification restored successfully.',
        });
    } catch (err) {
        console.error('RESTORE NOTIFICATION ERROR:', err.message || err);
        return res.status(500).json({ error: err.message || 'Failed to restore notification.' });
    }
};


exports.createAnnouncementNotifications = async (req, res) => {
    try {
        const result = await notificationService.createAnnouncementNotifications(
            req.body,
            req.user
        );

        if (Array.isArray(result?.notifications)) {
            result.notifications.forEach((notification) => {
                const targetUserId = notification.target_user_id || notification.user_id;
                if (targetUserId) {
                    socketEvents.notificationCreated(req.app.get('io'), targetUserId, notification);
                }
            });
        }

        await writeNotificationAudit(
            req,
            'CREATE_ANNOUNCEMENT_NOTIFICATIONS',
            'Created announcement notifications.',
            {
                total_created: result?.count || result?.notifications?.length || null,
                announcement_id: req.body?.announcement_id || req.body?.announcementId || null,
            }
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
