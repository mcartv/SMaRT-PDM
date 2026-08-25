const notificationService = require('../services/notificationService');

function getUserId(req) {
    return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getSafeStatusCode(error) {
    const statusCode = Number(error?.statusCode || error?.status || 500);

    if (statusCode < 400 || statusCode > 599) return 500;

    return statusCode;
}

exports.listMyNotifications = async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            throw createHttpError(401, 'Authentication required.');
        }

        const data = await notificationService.getMyNotifications(
            userId,
            req.query || {}
        );

        return res.status(200).json(data);
    } catch (err) {
        console.error('LIST NOTIFICATIONS ERROR:', err);

        return res.status(getSafeStatusCode(err)).json({
            error: err.message || 'Failed to load notifications.',
        });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            throw createHttpError(401, 'Authentication required.');
        }

        const data = await notificationService.getUnreadCount(userId);

        return res.status(200).json(data);
    } catch (err) {
        console.error('GET NOTIFICATION COUNT ERROR:', err);

        return res.status(getSafeStatusCode(err)).json({
            error: err.message || 'Failed to load notification count.',
        });
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            throw createHttpError(401, 'Authentication required.');
        }

        const notificationId = req.params.notificationId || req.params.id;

        const data = await notificationService.markAsRead(
            userId,
            notificationId
        );

        return res.status(200).json(data);
    } catch (err) {
        console.error('MARK NOTIFICATION READ ERROR:', err);

        return res.status(getSafeStatusCode(err)).json({
            error: err.message || 'Failed to mark notification as read.',
        });
    }
};

exports.markAllNotificationsRead = async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            throw createHttpError(401, 'Authentication required.');
        }

        const data = await notificationService.markAllAsRead(userId);

        return res.status(200).json(data);
    } catch (err) {
        console.error('MARK ALL NOTIFICATIONS READ ERROR:', err);

        return res.status(getSafeStatusCode(err)).json({
            error: err.message || 'Failed to mark all notifications as read.',
        });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            throw createHttpError(401, 'Authentication required.');
        }

        const notificationId = req.params.notificationId || req.params.id;

        const data = await notificationService.deleteNotification(
            userId,
            notificationId
        );

        return res.status(200).json(data);
    } catch (err) {
        console.error('DELETE NOTIFICATION ERROR:', err);

        return res.status(getSafeStatusCode(err)).json({
            error: err.message || 'Failed to delete notification.',
        });
    }
};

exports.registerDeviceToken = async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            throw createHttpError(401, 'Authentication required.');
        }

        const data = await notificationService.registerDeviceToken(
            userId,
            req.body || {}
        );

        return res.status(200).json(data);
    } catch (err) {
        console.error('REGISTER DEVICE TOKEN ERROR:', err);

        return res.status(getSafeStatusCode(err)).json({
            error: err.message || 'Failed to register device token.',
        });
    }
};

exports.createInternalUserNotification = async (req, res) => {
    try {
        const data = await notificationService.createInternalUserNotification(req);

        return res.status(201).json(data);
    } catch (err) {
        console.error('CREATE INTERNAL NOTIFICATION ERROR:', err);

        return res.status(getSafeStatusCode(err)).json({
            error: err.message || 'Failed to create notification.',
        });
    }
};