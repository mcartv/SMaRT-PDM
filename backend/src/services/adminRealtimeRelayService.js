const ADMIN_BACKEND_URL = String(process.env.ADMIN_BACKEND_URL || '').replace(/\/+$/, '');
const INTERNAL_REALTIME_SECRET = String(process.env.INTERNAL_REALTIME_SECRET || '').trim();

async function postToAdminBackend(path, payload = {}) {
    if (!ADMIN_BACKEND_URL || !INTERNAL_REALTIME_SECRET) {
        console.warn('[Admin Realtime Relay] skipped: missing ADMIN_BACKEND_URL or INTERNAL_REALTIME_SECRET');

        return {
            success: false,
            skipped: true,
            reason: 'missing_config',
        };
    }

    const url = `${ADMIN_BACKEND_URL}${path}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-realtime-secret': INTERNAL_REALTIME_SECRET,
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

        console.log('[Admin Realtime Relay] sent:', {
            url,
            action: payload.action,
            ro_id: payload.ro_id || payload.roId || null,
            student_id: payload.student_id || payload.studentId || null,
        });

        return {
            success: true,
            data,
        };
    } catch (error) {
        console.error('[Admin Realtime Relay] request error:', error.message);

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

async function relayMessageCreated(payload = {}) {
    return postToAdminBackend('/api/internal/realtime/message-created', payload);
}

module.exports = {
    relayRoUpdated,
    relayMessageCreated,
};