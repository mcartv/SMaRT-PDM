const renewalService = require('../services/renewalService');
const supabase = require('../config/supabase');

function getUserId(req) {
    return (
        req.user?.userId ||
        req.user?.user_id ||
        req.user?.id ||
        req.user?.sub ||
        null
    );
}

function getStatusCode(error) {
    const statusCode = Number(error?.statusCode || error?.status || 500);
    return statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
}

function emitRenewalUpdated(req, action, payload = {}) {
    const io = req.app?.get?.('io');

    if (!io) return;

    const realtimePayload = {
        source: 'mobile-renewal-controller',
        action,
        updated_at: new Date().toISOString(),
        ...payload,
    };

    io.emit('renewal:updated', realtimePayload);
    io.emit('renewalUpdated', realtimePayload);
}

async function writeRenewalSystemLog(req, {
    actionTaken,
    renewalId = null,
    description,
    metadata = {},
}) {
    try {
        const userId = getUserId(req);

        if (!userId || !actionTaken) return;

        const forwardedFor = String(
            req.headers?.['x-forwarded-for'] || ''
        )
            .split(',')[0]
            .trim();

        const actorEmail =
            req.user?.email ||
            req.user?.user_email ||
            null;

        const actorRole =
            req.user?.role ||
            'student';

        const { error } = await supabase
            .from('audit_logs')
            .insert({
                user_id: userId,
                action_taken: actionTaken,
                ip_address: forwardedFor || req.ip || null,
                module: 'Renewals',
                entity_type: 'renewal',
                entity_id: renewalId ? String(renewalId) : null,
                description: description || actionTaken,
                metadata: metadata || {},
                actor_role: actorRole,
                actor_email: actorEmail,
                user_agent:
                    req.get?.('user-agent') ||
                    req.headers?.['user-agent'] ||
                    null,
            });

        if (error) {
            console.error(
                'RENEWAL SYSTEM LOG ERROR:',
                error.message
            );
        }
    } catch (error) {
        console.error(
            'RENEWAL SYSTEM LOG ERROR:',
            error.message
        );
    }
}

exports.getCurrentRenewal = async (req, res) => {
    try {
        const payload = await renewalService.fetchCurrentRenewal(getUserId(req));
        return res.status(200).json(payload);
    } catch (error) {
        console.error('GET CURRENT RENEWAL ERROR:', error.message);
        return res.status(getStatusCode(error)).json({
            error: error.message || 'Failed to load renewal package.',
        });
    }
};

exports.uploadDocument = async (req, res) => {
    try {
        const payload = await renewalService.uploadDocument({
            userId: getUserId(req),
            routeParam: req.params.routeParam,
            file: req.file,
        });

        const renewalId =
            payload?.renewal?.renewal_id ||
            payload?.renewal_id ||
            null;

        emitRenewalUpdated(req, 'document-uploaded', {
            route_param: req.params.routeParam,
            renewal_id: renewalId,
        });

        await writeRenewalSystemLog(req, {
            actionTaken: 'RENEWAL_DOCUMENT_UPLOADED',
            renewalId,
            description: 'Scholar uploaded a renewal requirement document.',
            metadata: {
                route_param: req.params.routeParam,
                file_name: req.file?.originalname || null,
            },
        });

        return res.status(200).json(payload);
    } catch (error) {
        console.error('UPLOAD RENEWAL DOCUMENT ERROR:', error.message);
        return res.status(getStatusCode(error)).json({
            error: error.message || 'Failed to upload renewal document.',
        });
    }
};

exports.submitRenewal = async (req, res) => {
    try {
        const payload = await renewalService.submitRenewal(getUserId(req));

        const renewalId =
            payload?.renewal?.renewal_id ||
            payload?.renewal_id ||
            null;

        emitRenewalUpdated(req, 'submitted', {
            renewal_id: renewalId,
            status: payload?.renewal?.renewal_status || null,
        });

        await writeRenewalSystemLog(req, {
            actionTaken: 'RENEWAL_SUBMITTED',
            renewalId,
            description: 'Scholar submitted renewal requirements for review.',
            metadata: {
                renewal_status:
                    payload?.renewal?.renewal_status ||
                    payload?.renewal?.status ||
                    null,
            },
        });

        return res.status(200).json(payload);
    } catch (error) {
        console.error('SUBMIT RENEWAL ERROR:', error.message);
        return res.status(getStatusCode(error)).json({
            error: error.message || 'Failed to submit renewal.',
        });
    }
};
