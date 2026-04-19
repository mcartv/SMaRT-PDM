const announcementService = require('../services/announcementService');
const socketEvents = require('../utils/socketEvents');

exports.getAnnouncements = async (req, res) => {
    try {
        const announcements = await announcementService.fetchAnnouncements();
        res.status(200).json(announcements);
    } catch (err) {
        console.error('GET ANNOUNCEMENTS CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getArchivedAnnouncements = async (req, res) => {
    try {
        const announcements = await announcementService.fetchArchivedAnnouncements();
        res.status(200).json(announcements);
    } catch (err) {
        console.error('GET ARCHIVED ANNOUNCEMENTS CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const created = await announcementService.createAnnouncement(req.body, req.user);
        
        const io = req.app.get('io');
        socketEvents.announcementCreated(io, {
            announcement_id: created.announcement_id,
            title: created.title,
            created_at: new Date().toISOString()
        });
        
        res.status(201).json({
            message: 'Announcement created successfully',
            data: created,
        });
    } catch (err) {
        console.error('CREATE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        
        const io = req.app.get('io');
        socketEvents.announcementUpdated(io, {
            announcement_id: updated.announcement_id,
            title: updated.title,
            updated_at: new Date().toISOString()
        });
        
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
        const archived = await announcementService.archiveAnnouncement(id);
        res.status(200).json({
            message: 'Announcement archived successfully',
            data: archived,
        });
    } catch (err) {
        console.error('ARCHIVE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.restoreAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const restored = await announcementService.restoreAnnouncement(id);
        res.status(200).json({
            message: 'Announcement restored successfully',
            data: restored,
        });
    } catch (err) {
        console.error('RESTORE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};