const announcementService = require('./announcementService');

let isRunning = false;

exports.runAnnouncementScheduler = async () => {
    if (isRunning) {
        return;
    }

    try {
        isRunning = true;

        const published = await announcementService.publishDueAnnouncements();

        if (published.length > 0) {
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