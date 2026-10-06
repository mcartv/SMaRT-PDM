// SMaRT-PDM: admin Realtime Relay Service — admin Realtime Relay Service (mobile backend service); contains mobile-facing business logic and data operations.
const { resolveInternalRealtimeSecret } = require('../utils/internalRealtimeSecret');

const ADMIN_BACKEND_URL = String(
    process.env.ADMIN_BACKEND_URL || ''
).replace(/\/+$/, '');

// getInternalRealtimeSecret: reads and returns get internal realtime secret for the admin Realtime Relay Service flow.
function getInternalRealtimeSecret() {
    const explicit = String(process.env.INTERNAL_REALTIME_SECRET || '').trim();
    return explicit || resolveInternalRealtimeSecret();
}

// postToAdminBackend: handles post to admin backend for the admin Realtime Relay Service flow.
async function postToAdminBackend(path, payload = {}) {
    if (!ADMIN_BACKEND_URL || !getInternalRealtimeSecret()) {
        console.warn(
            '[Admin Realtime Relay] skipped direct same-environment relay: missing ADMIN_BACKEND_URL or shared realtime authentication. Shared Supabase realtime remains available.'
        );

        return {
            success: false,
            skipped: true,
            reason: 'missing_config',
        };
    }

    const url = ADMIN_BACKEND_URL + path;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-realtime-secret':
                    getInternalRealtimeSecret(),
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error('[Admin Realtime Relay] failed:', {
                url,
                status: response.status,
                data,
            });

            return {
                success: false,
                status: response.status,
                data,
            };
        }

        return { success: true, data };
    } catch (error) {
        console.error(
            '[Admin Realtime Relay] request error:',
            error.message
        );

        return {
            success: false,
            error: error.message,
        };
    }
}

// relayRoUpdated: handles relay ro updated for the admin Realtime Relay Service flow.
async function relayRoUpdated(payload = {}) {
    return postToAdminBackend('/api/internal/realtime/ro-updated', {
        source: 'mobile-backend',
        updated_at: new Date().toISOString(),
        ...payload,
    });
}

// relayMessageCreated: handles relay message created for the admin Realtime Relay Service flow.
async function relayMessageCreated(payload = {}, targetUserIds = []) {
    return postToAdminBackend(
        '/api/internal/realtime/message-created',
        { ...payload, targetUserIds }
    );
}

// relayMessageEvent: handles relay message event for the admin Realtime Relay Service flow.
async function relayMessageEvent(event, payload = {}, targetUserIds = []) {
    return postToAdminBackend('/api/internal/realtime/message-event', {
        event,
        payload,
        targetUserIds,
    });
}

// relayNotificationCreated: handles relay notification created for the admin Realtime Relay Service flow.
async function relayNotificationCreated(payload = {}) {
    return postToAdminBackend(
        '/api/internal/realtime/notification-created',
        payload
    );
}



// relayPayoutEvent: handles relay payout event for the admin Realtime Relay Service flow.
async function relayPayoutEvent(event, payload = {}) {
    return postToAdminBackend('/api/internal/realtime/payout-event', {
        event,
        payload,
    });
}

module.exports = {
    relayRoUpdated,
    relayMessageCreated,
    relayMessageEvent,
    relayNotificationCreated,
    relayPayoutEvent,
};
