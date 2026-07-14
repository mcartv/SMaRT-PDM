const scholarshipProgramService = require('../services/scholarshipProgramService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

exports.getScholarshipPrograms = async (req, res) => {
    try {
        const rows = await scholarshipProgramService.getScholarshipPrograms();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET SCHOLARSHIP PROGRAMS ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to fetch scholarship programs',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.createScholarshipProgram = async (req, res) => {
    try {
        const created = await scholarshipProgramService.createScholarshipProgram(req.body);
        const io = req.app.get('io');
        socketEvents.maintenanceUpdated(io, {
            module: 'programs',
            action: 'create',
            id: created?.program_id ?? created?.id ?? null,
            updated_at: new Date().toISOString(),
        });
        res.status(201).json(created);
    } catch (err) {
        console.error('CREATE SCHOLARSHIP PROGRAM ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to create scholarship program',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.updateScholarshipProgram = async (req, res) => {
    try {
        const updated = await scholarshipProgramService.updateScholarshipProgram(
            req.params.id,
            req.body
        );

        if (!updated) {
            return res.status(404).json({ message: 'Scholarship program not found' });
        }

        const io = req.app.get('io');
        socketEvents.maintenanceUpdated(io, {
            module: 'programs',
            action: 'update',
            id: req.params.id,
            updated_at: new Date().toISOString(),
        });
        res.status(200).json(updated);
    } catch (err) {
        console.error('UPDATE SCHOLARSHIP PROGRAM ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to update scholarship program',
            error: err.message || 'Unknown backend error',
        });
    }
};


/* Realtime + audit wrapper
 * This adds audit trail coverage to controller actions that previously had realtime only,
 * or no centralized audit. It skips read-only handlers.
 */
(function attachRealtimeAuditWrapper() {
    const MODULE_NAME = 'Maintenance - Scholarship Programs';
    const EVENT_BASE = 'maintenance';

    const readOnlyPrefixes = ['get', 'fetch', 'list', 'download', 'export'];

    function isReadOnlyAction(name) {
        return readOnlyPrefixes.some((prefix) => String(name).startsWith(prefix));
    }

    function resolveActionName(name) {
        const raw = String(name || '').toLowerCase();

        if (raw.includes('archive')) return 'archived';
        if (raw.includes('restore')) return 'restored';
        if (raw.includes('approve')) return 'approved';
        if (raw.includes('reject')) return 'rejected';
        if (raw.includes('disqualify')) return 'disqualified';
        if (raw.includes('create') || raw.includes('upload')) return 'created';
        return 'updated';
    }

    function getActorUserId(req) {
        return req.user?.user_id || req.user?.userId || req.user?.id || null;
    }

    function getEntityId(req, body) {
        return (
            req.params?.id ||
            req.params?.applicationId ||
            req.params?.studentId ||
            req.params?.scholarId ||
            req.params?.reviewId ||
            req.params?.ticketId ||
            req.params?.settingId ||
            body?.data?.id ||
            body?.data?.application_id ||
            body?.data?.student_id ||
            body?.id ||
            body?.application_id ||
            body?.student_id ||
            null
        );
    }

    function safeAudit(req, functionName, responseBody) {
        try {
            const action = resolveActionName(functionName);
            const entityId = getEntityId(req, responseBody);
            const actionTaken = `${action.toUpperCase()}_${EVENT_BASE.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;

            if (typeof auditLogService?.logAudit === 'function') {
                auditLogService.logAudit({
                    req,
                    userId: getActorUserId(req),
                    actionTaken,
                    module: MODULE_NAME,
                    entityType: EVENT_BASE,
                    entityId: entityId ? String(entityId) : null,
                    description: `${MODULE_NAME}: ${functionName} completed successfully.`,
                    metadata: {
                        action,
                        params: req.params || {},
                        query: req.query || {},
                        body_keys: Object.keys(req.body || {}),
                    },
                }).catch((error) => {
                    console.error(`${MODULE_NAME} AUDIT WRAPPER ERROR:`, error.message);
                });
            }

            const io = req.app?.get?.('io');
            if (io && socketEvents?.emitEvent) {
                socketEvents.emitEvent(io, `${EVENT_BASE}:${action}`, {
                    module: MODULE_NAME,
                    action,
                    entity_id: entityId ? String(entityId) : null,
                    source: functionName,
                    updated_at: new Date().toISOString(),
                });

                socketEvents.emitEvent(io, 'audit:created', {
                    module: MODULE_NAME,
                    action_taken: actionTaken,
                    entity_type: EVENT_BASE,
                    entity_id: entityId ? String(entityId) : null,
                    created_at: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.error(`${MODULE_NAME} REALTIME/AUDIT WRAPPER ERROR:`, error.message);
        }
    }

    Object.entries(module.exports).forEach(([functionName, handler]) => {
        if (typeof handler !== 'function' || isReadOnlyAction(functionName)) return;
        if (handler.__realtimeAuditWrapped) return;

        const wrapped = async function realtimeAuditWrappedHandler(req, res, next) {
            let captured = false;
            const originalJson = res.json.bind(res);

            res.json = function patchedJson(body) {
                if (!captured && res.statusCode >= 200 && res.statusCode < 400) {
                    captured = true;
                    safeAudit(req, functionName, body || {});
                }

                return originalJson(body);
            };

            return handler(req, res, next);
        };

        wrapped.__realtimeAuditWrapped = true;
        module.exports[functionName] = wrapped;
    });
})();
