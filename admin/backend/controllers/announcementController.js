const announcementService = require('../services/announcementService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function getAnnouncementId(announcement) {
    return announcement?.id || announcement?.announcement_id || null;
}

function getAnnouncementStatus(announcement) {
    return String(announcement?.status || 'Draft');
}

function buildAnnouncementSocketPayload(announcement = {}, action = 'updated') {
    const now = new Date().toISOString();

    return {
        module: 'announcements',
        action,
        announcement_id: getAnnouncementId(announcement),
        id: getAnnouncementId(announcement),
        title: announcement.title || '',
        content: announcement.content || '',
        status: getAnnouncementStatus(announcement),
        audience: announcement.audienceKey || announcement.audience || 'all',
        audience_key: announcement.audienceKey || announcement.audience || 'all',
        is_archived: !!announcement.is_archived || getAnnouncementStatus(announcement) === 'Archived',
        scheduled_at: announcement.scheduledAt || announcement.scheduled_at || null,
        published_at: announcement.publishedAt || announcement.published_at || announcement.date || null,
        updated_at: announcement.updatedAt || announcement.updated_at || announcement.date || now,
        created_at: announcement.createdAt || announcement.created_at || announcement.date || now,
    };
}

function emitAnnouncementRealtime(req, announcement, action = 'updated') {
    const io = req.app.get('io');
    if (!io || !announcement) return;

    const payload = buildAnnouncementSocketPayload(announcement, action);
    const status = String(payload.status || '').toLowerCase();

    const emitFallback = (eventName, data) => {
        io.emit(eventName, data);
    };

    if (action === 'created') {
        if (socketEvents?.announcementCreated) {
            socketEvents.announcementCreated(io, payload);
        } else {
            emitFallback('announcement:created', payload);
        }
    }

    if (action === 'updated') {
        if (socketEvents?.announcementUpdated) {
            socketEvents.announcementUpdated(io, payload);
        } else {
            emitFallback('announcement:updated', payload);
        }
    }

    if (action === 'published' || status === 'published') {
        if (socketEvents?.announcementPublished) {
            socketEvents.announcementPublished(io, payload);
        } else {
            emitFallback('announcement:published', payload);
        }
    }

    if (action === 'archived') {
        if (socketEvents?.announcementArchived) {
            socketEvents.announcementArchived(io, payload);
        } else {
            emitFallback('announcement:archived', payload);
        }
    }

    if (action === 'restored') {
        if (socketEvents?.announcementRestored) {
            socketEvents.announcementRestored(io, payload);
        } else {
            emitFallback('announcement:restored', payload);
        }
    }

    if (socketEvents?.announcementRefresh) {
        socketEvents.announcementRefresh(io, payload);
    } else {
        emitFallback('announcement:refresh', payload);
    }

    if (socketEvents?.maintenanceUpdated) {
        socketEvents.maintenanceUpdated(io, payload);
    } else {
        emitFallback('maintenance:updated', payload);
    }

    if (socketEvents?.reportUpdated) {
        socketEvents.reportUpdated(io, {
            module: 'reports',
            source: 'announcements',
            action,
            announcement_id: payload.announcement_id,
            updated_at: payload.updated_at,
        });
    } else {
        emitFallback('report:updated', {
            module: 'reports',
            source: 'announcements',
            action,
            announcement_id: payload.announcement_id,
            updated_at: payload.updated_at,
        });
    }
}

async function writeAnnouncementAudit(req, actionTaken, description, announcement = null, metadata = {}) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') {
            console.warn('ANNOUNCEMENT AUDIT WARNING: auditLogService.logAudit is not available.');
            return;
        }

        await auditLogService.logAudit({
            req,
            userId: getActorUserId(req),
            actionTaken,
            module: 'Announcements',
            entityType: 'announcement',
            entityId:
                getAnnouncementId(announcement) ||
                metadata?.announcement_id ||
                metadata?.id ||
                null,
            description,
            metadata: {
                announcement_id:
                    getAnnouncementId(announcement) ||
                    metadata?.announcement_id ||
                    metadata?.id ||
                    null,
                title: announcement?.title || metadata?.title || null,
                audience:
                    announcement?.audienceKey ||
                    announcement?.audience ||
                    metadata?.audience ||
                    null,
                status: announcement?.status || metadata?.status || null,
                scheduled_at:
                    announcement?.scheduledAt ||
                    announcement?.scheduled_at ||
                    metadata?.scheduled_at ||
                    null,
                published_at:
                    announcement?.publishedAt ||
                    announcement?.published_at ||
                    announcement?.date ||
                    metadata?.published_at ||
                    null,
                is_archived:
                    announcement?.is_archived ??
                    metadata?.is_archived ??
                    false,
                changes: metadata?.changes || undefined,
            },
        });
    } catch (err) {
        console.error('ANNOUNCEMENT AUDIT LOG ERROR:', err.message);
    }
}

function resolveCreateAuditAction(created) {
    const status = String(created?.status || '').toLowerCase();

    if (status === 'published') {
        return {
            actionTaken: 'CREATE_AND_PUBLISH_ANNOUNCEMENT',
            eventAction: 'published',
            description: `Created and published announcement: ${created?.title || 'Untitled Announcement'}.`,
        };
    }

    if (status === 'scheduled') {
        return {
            actionTaken: 'SCHEDULE_ANNOUNCEMENT',
            eventAction: 'created',
            description: `Created scheduled announcement: ${created?.title || 'Untitled Announcement'}.`,
        };
    }

    return {
        actionTaken: 'CREATE_ANNOUNCEMENT_DRAFT',
        eventAction: 'created',
        description: `Created announcement draft: ${created?.title || 'Untitled Announcement'}.`,
    };
}

function resolveUpdateAuditAction(updated) {
    const status = String(updated?.status || '').toLowerCase();

    if (status === 'scheduled') {
        return {
            actionTaken: 'UPDATE_SCHEDULED_ANNOUNCEMENT',
            eventAction: 'updated',
            description: `Updated scheduled announcement: ${updated?.title || 'Untitled Announcement'}.`,
        };
    }

    if (status === 'published') {
        return {
            actionTaken: 'UPDATE_PUBLISHED_ANNOUNCEMENT',
            eventAction: 'updated',
            description: `Updated published announcement: ${updated?.title || 'Untitled Announcement'}.`,
        };
    }

    return {
        actionTaken: 'UPDATE_ANNOUNCEMENT',
        eventAction: 'updated',
        description: `Updated announcement: ${updated?.title || 'Untitled Announcement'}.`,
    };
}

exports.getAnnouncements = async (req, res) => {
    try {
        const announcements = await announcementService.fetchAnnouncements();
        res.status(200).json(announcements);
    } catch (err) {
        console.error('GET ANNOUNCEMENTS CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to load announcements',
        });
    }
};

exports.getArchivedAnnouncements = async (req, res) => {
    try {
        const announcements = await announcementService.fetchArchivedAnnouncements();
        res.status(200).json(announcements);
    } catch (err) {
        console.error('GET ARCHIVED ANNOUNCEMENTS CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to load archived announcements',
        });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const created = await announcementService.createAnnouncement(req.body, req.user);

        const audit = resolveCreateAuditAction(created);

        emitAnnouncementRealtime(req, created, 'created');

        if (String(created?.status || '').toLowerCase() === 'published') {
            emitAnnouncementRealtime(req, created, 'published');
        }

        await writeAnnouncementAudit(
            req,
            audit.actionTaken,
            audit.description,
            created,
            {
                changes: req.body,
            }
        );

        res.status(201).json({
            message: 'Announcement created successfully',
            data: created,
        });
    } catch (err) {
        console.error('CREATE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to create announcement',
        });
    }
};

exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        const updated = await announcementService.updateAnnouncement(id, req.body, req.user);

        const audit = resolveUpdateAuditAction(updated);

        emitAnnouncementRealtime(req, updated, audit.eventAction);

        if (String(updated?.status || '').toLowerCase() === 'published') {
            emitAnnouncementRealtime(req, updated, 'published');
        }

        await writeAnnouncementAudit(
            req,
            audit.actionTaken,
            audit.description,
            updated,
            {
                announcement_id: id,
                changes: req.body,
            }
        );

        res.status(200).json({
            message: 'Announcement updated successfully',
            data: updated,
        });
    } catch (err) {
        console.error('UPDATE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to update announcement',
        });
    }
};

exports.publishAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        const published = await announcementService.publishAnnouncement(id, req.user);

        emitAnnouncementRealtime(req, published, 'published');
        emitAnnouncementRealtime(req, published, 'updated');

        await writeAnnouncementAudit(
            req,
            'PUBLISH_ANNOUNCEMENT',
            `Published announcement: ${published?.title || 'Untitled Announcement'}.`,
            published,
            {
                announcement_id: id,
            }
        );

        res.status(200).json({
            message: 'Announcement published successfully',
            data: published,
        });
    } catch (err) {
        console.error('PUBLISH ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to publish announcement',
        });
    }
};

exports.archiveAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        const archived = await announcementService.archiveAnnouncement(id, req.user);

        emitAnnouncementRealtime(req, archived, 'archived');
        emitAnnouncementRealtime(req, archived, 'updated');

        await writeAnnouncementAudit(
            req,
            'ARCHIVE_ANNOUNCEMENT',
            `Archived announcement: ${archived?.title || 'Untitled Announcement'}.`,
            archived,
            {
                announcement_id: id,
            }
        );

        res.status(200).json({
            message: 'Announcement archived successfully',
            data: archived,
        });
    } catch (err) {
        console.error('ARCHIVE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to archive announcement',
        });
    }
};

exports.restoreAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        const restored = await announcementService.restoreAnnouncement(id, req.user);

        emitAnnouncementRealtime(req, restored, 'restored');
        emitAnnouncementRealtime(req, restored, 'updated');

        await writeAnnouncementAudit(
            req,
            'RESTORE_ANNOUNCEMENT',
            `Restored announcement: ${restored?.title || 'Untitled Announcement'}.`,
            restored,
            {
                announcement_id: id,
            }
        );

        res.status(200).json({
            message: 'Announcement restored successfully',
            data: restored,
        });
    } catch (err) {
        console.error('RESTORE ANNOUNCEMENT CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to restore announcement',
        });
    }
};