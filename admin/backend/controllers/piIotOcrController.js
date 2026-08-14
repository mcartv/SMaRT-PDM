const iotOcrRequestService = require('../services/iotOcrRequestService');
const { ensureIotOcrSchema } = require('../services/iotOcrSchemaService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');
const iotOcrPresenceService = require('../services/iotOcrPresenceService');

exports.getIotOcrSchemaStatus = async (_req, res) => {
    try {
        await ensureIotOcrSchema();
        return res.status(200).json({
            status: 'ok',
            iot_ocr_fix: 'canonical-review-candidate-v44',
        });
    } catch (err) {
        console.error('IOT OCR SCHEMA STATUS ERROR:', {
            message: err.message,
            code: err.code || null,
            constraint: err.constraint || null,
            detail: err.detail || null,
        });

        return res.status(err.statusCode || 500).json({
            status: 'error',
            code: err.code || null,
            error: err.message || 'IoT OCR schema compatibility failed',
        });
    }
};

exports.getNextIotOcrRequest = async (req, res) => {
    try {
        iotOcrPresenceService.checkIn(req.piAuth?.deviceId);
        const result = await iotOcrRequestService.claimNextRequest({
            claimedBy: req.piAuth?.deviceId || null,
        });

        return res.status(200).json({
            message: 'IoT OCR request claimed successfully',
            data: result,
        });
    } catch (err) {
        if ((err.statusCode || 500) !== 404) {
            console.error('CLAIM IOT OCR REQUEST CONTROLLER ERROR:', {
                message: err.message,
                code: err.code || null,
                constraint: err.constraint || null,
                detail: err.detail || null,
            });
        }

        return res.status(err.statusCode || 500).json({
            code: err.code || null,
            error: err.message || 'Failed to claim IoT OCR request',
        });
    }
};

exports.updateIotOcrRequestStatus = async (req, res) => {
    try {
        iotOcrPresenceService.checkIn(req.piAuth?.deviceId);
        const result = await iotOcrRequestService.updateRequestStatus({
            requestId: req.params.requestId,
            status: req.body?.status,
            claimedBy: req.piAuth?.deviceId || null,
        });

        socketEvents.applicationOcrStatus(req.app?.get?.('io'), {
            request_id: result.request_id,
            application_id: result.application_id,
            document_key: result.document_key,
            status: result.status,
            ocr_version: result.ocr_version || 'v1',
            expires_at: result.expires_at,
            updated_at: result.updated_at,
        });

        res.status(200).json({
            message: 'IoT OCR request status updated successfully',
            data: result,
        });
    } catch (err) {
        const requestStopped = err.code === 'IOT_OCR_REQUEST_STOPPED';
        const stoppedRequest = err.request || null;
        if (requestStopped && stoppedRequest) {
            socketEvents.applicationOcrStatus(req.app?.get?.('io'), {
                request_id: stoppedRequest.request_id,
                application_id: stoppedRequest.application_id,
                document_key: stoppedRequest.document_key,
                ocr_version: stoppedRequest.ocr_version || 'v1',
                status: stoppedRequest.status,
                expires_at: stoppedRequest.expires_at,
                updated_at: stoppedRequest.updated_at,
            });
        }
        const log = requestStopped ? console.info : console.error;
        log(requestStopped ? 'IOT_OCR_WORKER_STOP_ACKNOWLEDGED' : 'UPDATE IOT OCR REQUEST STATUS ERROR:', {
            request_id: String(req.params?.requestId || '').slice(0, 8),
            attempted_status: req.body?.status || null,
            current_status: err.currentStatus || null,
            message: err.message,
            code: err.code || null,
        });
        res.status(err.statusCode || 500).json({
            code: err.code || null,
            error: err.message || 'Failed to update IoT OCR request status',
            current_status: err.currentStatus || null,
            stop_processing: requestStopped,
        });
    }
};

exports.submitIotOcrRequestResult = async (req, res) => {
    try {
        iotOcrPresenceService.checkIn(req.piAuth?.deviceId);
        const result = await iotOcrRequestService.completeRequest({
            requestId: req.params.requestId,
            status: req.body?.status,
            rawText: req.body?.raw_text,
            ocrConfidence: req.body?.ocr_confidence,
            extractedFields: req.body?.extracted_fields,
            sourcePayload: req.body?.source_payload,
            templateId: req.body?.template_id,
            fields: req.body?.fields,
            fieldConfidence: req.body?.field_confidence,
            validationIssues: req.body?.validation_issues,
            processing: req.body?.processing,
            errorMessage: req.body?.error_message,
            errorCode: req.body?.error_code,
            claimedBy: req.piAuth?.deviceId || null,
        });

        const request = result.request || result;
        socketEvents.applicationOcrStatus(req.app?.get?.('io'), {
            request_id: request.request_id,
            application_id: request.application_id,
            document_key: request.document_key,
            status: request.status,
            ocr_version: request.ocr_version || 'v1',
            expires_at: request.expires_at,
            updated_at: request.updated_at,
        });

        return res.status(200).json({
            message: 'IoT OCR request result saved successfully',
            data: result,
        });
    } catch (err) {
        const requestStopped = err.code === 'IOT_OCR_REQUEST_STOPPED';
        const stoppedRequest = err.request || null;
        if (requestStopped && stoppedRequest) {
            socketEvents.applicationOcrStatus(req.app?.get?.('io'), {
                request_id: stoppedRequest.request_id,
                application_id: stoppedRequest.application_id,
                document_key: stoppedRequest.document_key,
                ocr_version: stoppedRequest.ocr_version || 'v1',
                status: stoppedRequest.status,
                expires_at: stoppedRequest.expires_at,
                updated_at: stoppedRequest.updated_at,
            });
        }
        const log = requestStopped ? console.info : console.error;
        log(requestStopped ? 'IOT_OCR_LATE_RESULT_REJECTED' : 'SAVE IOT OCR REQUEST RESULT CONTROLLER ERROR:', {
            message: err.message,
            code: err.code || null,
            constraint: err.constraint || null,
            detail: err.detail || null,
        });

        return res.status(err.statusCode || 500).json({
            code: err.code || null,
            error: err.message || 'Failed to save IoT OCR request result',
            current_status: err.currentStatus || null,
            stop_processing: requestStopped,
        });
    }
};

exports.authorizeBirthV2Uploads = async (req, res) => {
    try {
        iotOcrPresenceService.checkIn(req.piAuth?.deviceId);
        const birthV2 = require('../services/birthOcrV2Service');
        const data = await birthV2.authorizeUploads({
            requestId: req.params.requestId,
            deviceId: req.piAuth?.deviceId,
            artifacts: req.body?.artifacts,
        });
        return res.status(200).json({ message: 'Private artifact uploads authorized', data });
    } catch (error) {
        console.error('BIRTH_V2_UPLOAD_AUTHORIZATION_ERROR', {
            request_id: String(req.params?.requestId || '').slice(0, 8),
            code: error.code || null,
            constraint: error.constraint || null,
            status_code: error.statusCode || 500,
        });
        return res.status(error.statusCode || 500).json({
            code: error.code || null,
            error: error.message || 'Failed to authorize Birth V2 uploads',
        });
    }
};

exports.completeBirthV2Uploads = async (req, res) => {
    try {
        iotOcrPresenceService.checkIn(req.piAuth?.deviceId);
        const birthV2 = require('../services/birthOcrV2Service');
        const data = await birthV2.completeUploads({
            requestId: req.params.requestId,
            deviceId: req.piAuth?.deviceId,
            diagnostic: req.body?.diagnostic || null,
        });
        const request = data.request || data;
        socketEvents.applicationOcrStatus(req.app?.get?.('io'), {
            request_id: request.request_id,
            application_id: request.application_id,
            document_key: request.document_key,
            ocr_version: request.ocr_version || 'v2',
            status: request.status,
            expires_at: request.expires_at,
            updated_at: request.updated_at,
        });
        return res.status(200).json({ message: 'Birth V2 extraction completed', data });
    } catch (error) {
        console.error('BIRTH_V2_UPLOAD_COMPLETION_ERROR', {
            request_id: String(req.params?.requestId || '').slice(0, 8),
            code: error.code || null,
            constraint: error.constraint || null,
            status_code: error.statusCode || 500,
        });
        return res.status(error.statusCode || 500).json({
            code: error.code || null,
            error: error.message || 'Failed to complete Birth V2 extraction',
        });
    }
};

/* Realtime + audit wrapper
 * This adds audit trail coverage to controller actions that previously had realtime only,
 * or no centralized audit. It skips read-only handlers.
 */
(function attachRealtimeAuditWrapper() {
    const MODULE_NAME = 'Pi IoT OCR Worker';
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
