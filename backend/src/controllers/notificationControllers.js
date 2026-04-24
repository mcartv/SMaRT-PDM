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

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await notificationService.getMyNotifications(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET MY NOTIFICATIONS ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load notifications.',
        });
    }
}

async function markAsRead(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await notificationService.markAsRead(
            userId,
            req.params.notificationId
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('MARK NOTIFICATION READ ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to update notification.',
        });
    }
}

async function markAllAsRead(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await notificationService.markAllAsRead(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('MARK ALL NOTIFICATIONS READ ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to update notifications.',
        });
    }
}

module.exports = {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
};