const announcementService = require('./announcementService');
const socketEvents = require('../utils/socketEvents');

let isRunning = false;

exports.runAnnouncementScheduler = async (io = null) => {
    if (isRunning) {
        return;
    }

    try {
        isRunning = true;

        const published = await announcementService.publishDueAnnouncements();

        if (published.length > 0) {
            if (io) {
                published.forEach((announcement) => {
                    socketEvents.announcementCreated(io, {
                        announcement_id: announcement.id,
                        title: announcement.title,
                        created_at: announcement.date || new Date().toISOString(),
                    });
                });
            }

            console.log(
                `[SCHEDULER] Auto-published ${published.length} announcement(s):`,
                published.map((a) => a.id)
            );
        }
    } catch (err) {
        console.error('[SCHEDULER ERROR]:', err.message);
    } finally {
        isRunning = false;
    }
};
