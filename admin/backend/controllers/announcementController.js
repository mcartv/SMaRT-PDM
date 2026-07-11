const announcementService = require('../services/announcementService');
const socketEvents = require('../utils/socketEvents');

function buildAnnouncementSocketPayload(announcement, source = 'manual') {
    return {
        announcement_id: announcement.id,
        title: announcement.title,
        status: announcement.status,
        audience: announcement.audienceKey || announcement.audience,
        is_archived: !!announcement.is_archived,
        date: announcement.date || new Date().toISOString(),
        published_at: announcement.publishedAt || null,
        scheduled_at: announcement.scheduledAt || null,
        updated_at: announcement.updatedAt || new Date().toISOString(),
        source,
    };
}

function emitAnnouncementRealtime(io, announcement, action) {
    if (!io || !announcement) return;

    const payload = buildAnnouncementSocketPayload(announcement, action);

    if (action === 'created') {
        socketEvents.announcementCreated(io, payload);
    }

    if (action === 'updated') {
        socketEvents.announcementUpdated(io, payload);
    }

    if (action === 'published') {
        socketEvents.announcementPublished(io, payload);
        socketEvents.announcementCreated(io, payload);
        socketEvents.announcementUpdated(io, payload);
    }

    if (action === 'archived') {
        socketEvents.announcementDeleted(io, payload);
        socketEvents.announcementUpdated(io, payload);
    }

    if (action === 'restored') {
        socketEvents.announcementUpdated(io, payload);
    }

    socketEvents.announcementRefresh(io, payload);
}

exports.getAnnouncements = async (req, res) => {
    try {
        const announcements = await announcementService.fetchAnnouncements();
        return res.status(200).json(announcements);
    } catch (err) {
        console.error('GET ANNOUNCEMENTS CONTROLLER ERROR:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

exports.getArchivedAnnouncements = async (req, res) => {
    try {
        const announcements = await announcementService.fetchArchivedAnnouncements();
        return res.status(200).json(announcements);
    } catch (err) {
        console.error('GET ARCHIVED ANNOUNCEMENTS CONTROLLER ERROR:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const created = await announcementService.createAnnouncement(req.body, req.user);
        const io = req.app.get('io');

        emitAnnouncementRealtime(io, created, created.status === 'Published' ? 'published' : 'created');

        return res.status(201).json({
            message: 'Announcement created successfully',
            data: created,
        });
    } catch (err) {
        console.error('CREATE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await announcementService.updateAnnouncement(id, req.body);
        const io = req.app.get('io');

        emitAnnouncementRealtime(io, updated, updated.status === 'Published' ? 'published' : 'updated');

        return res.status(200).json({
            message: 'Announcement updated successfully',
            data: updated,
        });
    } catch (err) {
        console.error('UPDATE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

exports.publishAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const published = await announcementService.publishAnnouncement(id);
        const io = req.app.get('io');

        emitAnnouncementRealtime(io, published, 'published');

        return res.status(200).json({
            message: 'Announcement published successfully',
            data: published,
        });
    } catch (err) {
        console.error('PUBLISH ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

exports.archiveAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const archived = await announcementService.archiveAnnouncement(id);
        const io = req.app.get('io');

        emitAnnouncementRealtime(io, archived, 'archived');

        return res.status(200).json({
            message: 'Announcement archived successfully',
            data: archived,
        });
    } catch (err) {
        console.error('ARCHIVE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

exports.restoreAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const restored = await announcementService.restoreAnnouncement(id);
        const io = req.app.get('io');

        emitAnnouncementRealtime(io, restored, 'restored');

        return res.status(200).json({
            message: 'Announcement restored successfully',
            data: restored,
        });
    } catch (err) {
        console.error('RESTORE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        return res.status(500).json({ error: err.message });
    }
};