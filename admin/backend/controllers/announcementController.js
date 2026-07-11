const announcementService = require('../services/announcementService');
const auditLogService = require('../services/auditLogService');
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
        if (io && created.status === 'Published') {
            socketEvents.announcementCreated(io, {
                announcement_id: created.id,
                title: created.title,
                created_at: created.date || new Date().toISOString()
            });
        }
        
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
        const io = req.app.get('io');
        if (io) {
            socketEvents.announcementUpdated(io, {
                announcement_id: updated.id,
                title: updated.title,
                updated_at: updated.date || new Date().toISOString()
            });
        }
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
        const io = req.app.get('io');
        if (io) {
            socketEvents.announcementCreated(io, {
                announcement_id: published.id,
                title: published.title,
                created_at: published.date || new Date().toISOString()
            });
        }
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
        const io = req.app.get('io');
        if (io) {
            socketEvents.announcementDeleted(io, {
                announcement_id: archived.id,
                updated_at: archived.date || new Date().toISOString()
            });
        }
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
        const io = req.app.get('io');
        if (io) {
            socketEvents.announcementUpdated(io, {
                announcement_id: restored.id,
                title: restored.title,
                updated_at: restored.date || new Date().toISOString()
            });
        }
        res.status(200).json({
            message: 'Announcement restored successfully',
            data: restored,
        });
    } catch (err) {
        console.error('RESTORE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};
