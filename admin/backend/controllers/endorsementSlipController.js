const endorsementSlipService = require('../services/endorsementSlipService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

exports.getAllSlips = async (req, res) => {
    try {
        const rows = await endorsementSlipService.fetchAllSlips(req.user);
        res.status(200).json(rows);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load endorsement tracker.',
        });
    }
};

exports.getPdQueue = async (req, res) => {
    try {
        const rows = await endorsementSlipService.fetchQueue('pd', req.user);
        res.status(200).json(rows);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load PD queue.',
        });
    }
};

exports.getGuidanceQueue = async (req, res) => {
    try {
        const rows = await endorsementSlipService.fetchQueue('guidance', req.user);
        res.status(200).json(rows);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load Guidance queue.',
        });
    }
};

exports.getSdoQueue = async (req, res) => {
    try {
        const rows = await endorsementSlipService.fetchQueue('sdo', req.user);
        res.status(200).json(rows);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load SDO queue.',
        });
    }
};

exports.getSlipDetail = async (req, res) => {
    try {
        const payload = await endorsementSlipService.fetchSlipDetail(req.params.slipId, req.user);
        res.status(200).json(payload);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load endorsement slip.',
        });
    }
};

exports.downloadSlipPdf = async (req, res) => {
    try {
        const pdf = await endorsementSlipService.buildSlipPdfDownload(req.params.slipId, req.user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdf.fileName}"`);
        res.status(200).send(pdf.buffer);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to download endorsement slip PDF.',
        });
    }
};

exports.postPdAction = async (req, res) => {
    try {
        const result = await endorsementSlipService.applyStageAction('pd', req.params.slipId, req.body, req.user);
        const io = req.app.get('io');
        socketEvents.endorsementUpdated(io, {
            slip_id: req.params.slipId,
            current_stage: result.slip.current_stage,
            overall_status: result.slip.overall_status,
            queue: 'pd',
            action: result.action,
        });
        socketEvents.applicationUpdated(io, {
            application_id: result.slip.application_id,
            updated_at: new Date().toISOString(),
            source: 'endorsement',
        });

        (result.notifications || []).forEach((notification) => {
            socketEvents.notificationCreated(io, notification.target_user_id, notification);
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to update PD endorsement.',
        });
    }
};

exports.postGuidanceAction = async (req, res) => {
    try {
        const result = await endorsementSlipService.applyStageAction('guidance', req.params.slipId, req.body, req.user);
        const io = req.app.get('io');
        socketEvents.endorsementUpdated(io, {
            slip_id: req.params.slipId,
            current_stage: result.slip.current_stage,
            overall_status: result.slip.overall_status,
            queue: 'guidance',
            action: result.action,
        });
        socketEvents.applicationUpdated(io, {
            application_id: result.slip.application_id,
            updated_at: new Date().toISOString(),
            source: 'endorsement',
        });

        (result.notifications || []).forEach((notification) => {
            socketEvents.notificationCreated(io, notification.target_user_id, notification);
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to update Guidance clearance.',
        });
    }
};

exports.postSdoAction = async (req, res) => {
    try {
        const result = await endorsementSlipService.applyStageAction('sdo', req.params.slipId, req.body, req.user);
        const io = req.app.get('io');
        socketEvents.endorsementUpdated(io, {
            slip_id: req.params.slipId,
            current_stage: result.slip.current_stage,
            overall_status: result.slip.overall_status,
            queue: 'sdo',
            action: result.action,
        });
        socketEvents.applicationUpdated(io, {
            application_id: result.slip.application_id,
            updated_at: new Date().toISOString(),
            source: 'endorsement',
        });

        (result.notifications || []).forEach((notification) => {
            socketEvents.notificationCreated(io, notification.target_user_id, notification);
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to update SDO clearance.',
        });
    }
};

exports.verifySlip = async (req, res) => {
    try {
        const payload = await endorsementSlipService.fetchVerificationPayload(req.params.token);
        res.status(200).json(payload);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to verify endorsement slip.',
        });
    }
};


/* Realtime + audit wrapper
 * This adds audit trail coverage to controller actions that previously had realtime only,
 * or no centralized audit. It skips read-only handlers.
 */
(function attachRealtimeAuditWrapper() {
    const MODULE_NAME = 'Endorsement Slips';
    const EVENT_BASE = 'endorsement';

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
