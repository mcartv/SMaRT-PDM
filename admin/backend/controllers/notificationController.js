const notificationService = require('../services/notificationService');

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