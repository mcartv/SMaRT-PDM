const announcementService = require('./announcementService');
const endorsementSlipService = require('./endorsementSlipService');

let isRunning = false;
let lastDigestSlotKey = null;

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

exports.runDepartmentDigestScheduler = async () => {
    if (isRunning) {
        return;
    }

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isDigestSlot = minute === 0 && (hour === 9 || hour === 15);

    if (!isDigestSlot) {
        return;
    }

    const slotKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${hour}`;
    if (lastDigestSlotKey === slotKey) {
        return;
    }

    try {
        isRunning = true;
        const results = await endorsementSlipService.sendPendingDigests();
        lastDigestSlotKey = slotKey;
        console.log('[SCHEDULER] Department digest results:', results);
    } catch (err) {
        console.error('[DEPARTMENT DIGEST SCHEDULER ERROR]:', err.message);
    } finally {
        isRunning = false;
    }
};
