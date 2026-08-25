const adminProfilePhotoService = require('../services/adminProfilePhotoService');
const auditLogService = require('../services/auditLogService');
const { getSafeStatusCode } = require('../utils/httpStatus');
const socketEvents = require('../utils/socketEvents');

function getRequestUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

async function getProfilePhotoReviews(req, res) {
  try {
    const result = await adminProfilePhotoService.getProfilePhotoReviews({
      adminUserId: getRequestUserId(req),
      query: req.query || {},
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('ADMIN PROFILE PHOTO LIST ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load profile photo reviews.',
    });
  }
}

async function getProfilePhotoReviewById(req, res) {
  try {
    const result = await adminProfilePhotoService.getProfilePhotoReviewById({
      adminUserId: getRequestUserId(req),
      reviewId: req.params.reviewId,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('ADMIN PROFILE PHOTO DETAIL ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load profile photo review.',
    });
  }
}

async function approveProfilePhotoReview(req, res) {
  try {
    const result = await adminProfilePhotoService.approveProfilePhotoReview({
      adminUserId: getRequestUserId(req),
      reviewId: req.params.reviewId,
      remarks: req.body?.remarks,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('ADMIN PROFILE PHOTO APPROVE ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to approve profile photo.',
    });
  }
}

async function rejectProfilePhotoReview(req, res) {
  try {
    const result = await adminProfilePhotoService.rejectProfilePhotoReview({
      adminUserId: getRequestUserId(req),
      reviewId: req.params.reviewId,
      rejectionReason: req.body?.rejection_reason || req.body?.reason,
      remarks: req.body?.remarks,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('ADMIN PROFILE PHOTO REJECT ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to reject profile photo.',
    });
  }
}

module.exports = {
  getProfilePhotoReviews,
  getProfilePhotoReviewById,
  approveProfilePhotoReview,
  rejectProfilePhotoReview,
};


/* Realtime + audit wrapper
 * This adds audit trail coverage to controller actions that previously had realtime only,
 * or no centralized audit. It skips read-only handlers.
 */
(function attachRealtimeAuditWrapper() {
    const MODULE_NAME = 'Admin Profile Photos';
    const EVENT_BASE = 'profile-photo-review';

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
