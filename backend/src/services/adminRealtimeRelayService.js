const ADMIN_BACKEND_URL = String(process.env.ADMIN_BACKEND_URL || '').replace(/\/+$/, '');
const INTERNAL_REALTIME_SECRET = String(process.env.INTERNAL_REALTIME_SECRET || '').trim();

function shouldSkipRelay() {
    return !ADMIN_BACKEND_URL || !INTERNAL_REALTIME_SECRET;
}

async function relayMessageCreated(message = {}) {
    if (shouldSkipRelay()) {
        console.warn('[Admin Realtime Relay] skipped: missing ADMIN_BACKEND_URL or INTERNAL_REALTIME_SECRET');
        return {
            success: false,
            skipped: true,
            reason: 'missing_config',
        };
    }

    const url = `${ADMIN_BACKEND_URL}/api/internal/realtime/message-created`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-realtime-secret': INTERNAL_REALTIME_SECRET,
            },
            body: JSON.stringify(message),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error('[Admin Realtime Relay] failed:', {
                status: response.status,
                payload,
            });

            return {
                success: false,
                status: response.status,
                payload,
            };
        }

        console.log('[Admin Realtime Relay] sent:', {
            message_id: message.message_id || message.messageId || message.id,
            payload,
        });

        return {
            success: true,
            payload,
        };
    } catch (error) {
        console.error('[Admin Realtime Relay] request error:', error.message);

        return {
            success: false,
            error: error.message,
        };
    }
}

module.exports = {
    relayMessageCreated,
};
