const ADMIN_BACKEND_URL = String(
    process.env.ADMIN_BACKEND_URL || ''
).replace(/\/+$/, '');

const INTERNAL_REALTIME_SECRET = String(
    process.env.INTERNAL_REALTIME_SECRET || ''
).trim();

async function postToAdminBackend(path, payload = {}) {
    if (!ADMIN_BACKEND_URL || !INTERNAL_REALTIME_SECRET) {
        console.warn(
            '[Admin Realtime Relay] skipped direct same-environment relay: missing ADMIN_BACKEND_URL or INTERNAL_REALTIME_SECRET. Shared Supabase realtime remains available.'
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
                    INTERNAL_REALTIME_SECRET,
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

async function relayRoUpdated(payload = {}) {
    return postToAdminBackend('/api/internal/realtime/ro-updated', {
        source: 'mobile-backend',
        updated_at: new Date().toISOString(),
        ...payload,
    });
}

async function relayMessageCreated(payload = {}, targetUserIds = []) {
    return postToAdminBackend(
        '/api/internal/realtime/message-created',
        { ...payload, targetUserIds }
    );
}

async function relayMessageEvent(event, payload = {}, targetUserIds = []) {
    return postToAdminBackend('/api/internal/realtime/message-event', {
        event,
        payload,
        targetUserIds,
    });
}

async function relayNotificationCreated(payload = {}) {
    return postToAdminBackend(
        '/api/internal/realtime/notification-created',
        payload
    );
}

module.exports = {
    relayRoUpdated,
    relayMessageCreated,
    relayMessageEvent,
    relayNotificationCreated,
};
