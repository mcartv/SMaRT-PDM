const announcementService = require('../services/announcementService');

exports.getAnnouncements = async (req, res) => {
    try {
        const announcements = await announcementService.fetchAnnouncements();
        res.status(200).json(announcements);
    } catch (err) {
        console.error('GET ANNOUNCEMENTS CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const created = await announcementService.createAnnouncement(req.body, req.user);
        res.status(201).json({
            message: 'Announcement created successfully',
            data: created,
        });
    } catch (err) {
        console.error('CREATE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await announcementService.updateAnnouncement(id, req.body, req.user);
        res.status(200).json({
            message: 'Announcement updated successfully',
            data: updated,
        });
    } catch (err) {
        console.error('UPDATE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.publishAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const published = await announcementService.publishAnnouncement(id);
        res.status(200).json({
            message: 'Announcement published successfully',
            data: published,
        });
    } catch (err) {
        console.error('PUBLISH ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.archiveAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        await announcementService.archiveAnnouncement(id);
        res.status(200).json({
            message: 'Announcement archived successfully',
        });
    } catch (err) {
        console.error('ARCHIVE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};