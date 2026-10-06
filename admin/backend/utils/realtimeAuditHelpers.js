// SMaRT-PDM: realtime Audit Helpers — realtime Audit Helpers (admin backend); supports backend application behavior.
/**
 * Small helpers for controllers that need audit + realtime support.
 */

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getActorEmail: reads and returns get actor email for the realtime Audit Helpers flow.
function getActorEmail(req) {
    return req.user?.email || req.user?.username || null;
}

// writeAudit: handles write audit for the realtime Audit Helpers flow.
async function writeAudit(auditLogService, req, payload = {}) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') return;

        await auditLogService.logAudit({
            req,
            userId: payload.userId || getActorUserId(req),
            actionTaken: payload.actionTaken,
            module: payload.module,
            entityType: payload.entityType || null,
            entityId: payload.entityId ? String(payload.entityId) : null,
            description: payload.description || null,
            metadata: {
                actor_email: getActorEmail(req),
                ...(payload.metadata || {}),
            },
        });

        const io = req.app?.get?.('io');
        if (io) {
            io.emit('audit:created', {
                module: payload.module,
                action_taken: payload.actionTaken,
                entity_type: payload.entityType || null,
                entity_id: payload.entityId ? String(payload.entityId) : null,
                created_at: new Date().toISOString(),
            });
        }
    } catch (error) {
        console.error('WRITE AUDIT ERROR:', error.message);
    }
}

// emitMaintenance: handles emit maintenance for the realtime Audit Helpers flow.
function emitMaintenance(socketEvents, req, payload = {}) {
    const io = req.app?.get?.('io');
    if (!io) return;

    const data = {
        ...payload,
        updated_at: payload.updated_at || new Date().toISOString(),
    };

    if (socketEvents?.maintenanceUpdated) {
        socketEvents.maintenanceUpdated(io, data);
    } else {
        io.emit('maintenance:updated', data);
    }
}

// emitReport: handles emit report for the realtime Audit Helpers flow.
function emitReport(socketEvents, req, payload = {}) {
    const io = req.app?.get?.('io');
    if (!io) return;

    const data = {
        ...payload,
        updated_at: payload.updated_at || new Date().toISOString(),
    };

    if (socketEvents?.reportUpdated) {
        socketEvents.reportUpdated(io, data);
    } else {
        io.emit('report:updated', data);
    }
}

module.exports = {
    getActorUserId,
    getActorEmail,
    writeAudit,
    emitMaintenance,
    emitReport,
};
