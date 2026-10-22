// SMaRT-PDM: scheduler Service — scheduler Service (admin backend service); contains business logic and data operations.
const announcementService = require('./announcementService');
const socketEvents = require('../utils/socketEvents');
const endorsementSlipService = require('./endorsementSlipService');

let isRunning = false;
let lastDigestSlotKey = null;

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

// Explicit schedules only; gaps and completed windows retain the current cycle.
exports.runAcademicSemesterScheduler = async (io = null) => {
    const result = await require('./academicSemesterAutomationService').tick();
    if(result.status !== 'activated') return result;
    const period=result.period;
    require('../config/appCache').invalidateNamespaces(['academic-years','program-openings']);
    const payload={module:'academic_periods',action:'scheduled_activation',id:period.period_id,academic_period:period,updated_at:new Date().toISOString()};
    socketEvents.maintenanceUpdated(io,payload);
    socketEvents.renewalUpdated(io,{action:'period_changed',period_id:period.period_id,academic_year_id:period.academic_year_id});
    socketEvents.dashboardUpdated(io,{source:'academic-period',action:'scheduled_activation'});
    if(io) io.emit('ro:updated',{action:'period_changed',period_id:period.period_id});
    await require('./studentRealtimeRelayService').relayModuleEvent({event:'academic:updated',payload}).catch(error=>console.error('ACADEMIC_REALTIME_RELAY_ERROR',error.message));
    await require('./auditLogService').logAudit({actionTaken:'AUTO_ACTIVATE_ACADEMIC_PERIOD',module:'Academic Years',entityType:'academic_period',entityId:period.period_id,description:'Automatically activated '+period.term+' using the configured semester dates.',metadata:{period}}).catch(error=>console.error('ACADEMIC_SCHEDULE_AUDIT_ERROR',error.message));
    return result;
};
