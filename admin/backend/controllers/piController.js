const ocrJobService = require('../services/ocrJobService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

exports.getNextOcrJob = async (req, res) => {
    try {
        const result = await ocrJobService.claimNextJob({
            claimedBy: req.piAuth?.deviceId || null,
        });

        res.status(200).json({
            message: 'OCR job claimed successfully',
            data: result,
        });
    } catch (err) {
        console.error('CLAIM OCR JOB CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to claim OCR job',
        });
    }
};

exports.submitOcrJobResult = async (req, res) => {
    try {
        const result = await ocrJobService.completeJob({
            jobId: req.params.id,
            status: req.body?.status,
            rawText: req.body?.raw_text,
            ocrConfidence: req.body?.ocr_confidence,
            extractedFields: req.body?.extracted_fields,
            sourcePayload: req.body?.source_payload,
            errorMessage: req.body?.error_message,
            claimedBy: req.piAuth?.deviceId || null,
        });

        res.status(200).json({
            message: 'OCR job result saved successfully',
            data: result,
        });
    } catch (err) {
        console.error('SAVE OCR JOB RESULT CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to save OCR job result',
        });
    }
};


/* Realtime + audit wrapper
 * This adds audit trail coverage to controller actions that previously had realtime only,
 * or no centralized audit. It skips read-only handlers.
 */
(function attachRealtimeAuditWrapper() {
    const MODULE_NAME = 'Pi OCR Worker';
    const EVENT_BASE = 'application-ocr';

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
