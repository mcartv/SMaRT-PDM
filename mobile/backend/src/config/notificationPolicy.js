'use strict';

function createNotificationPolicy({ load, now = Date.now, ttlMs = 60000, warn = console.warn }) {
    let enabled = true;
    let expiresAt = 0;
    let pending = null;
    let revision = 0;

    function setNotificationsEnabled(value) {
        if (typeof value !== 'boolean') return;
        revision += 1;
        enabled = value;
        expiresAt = now() + ttlMs;
    }

    function invalidate() {
        revision += 1;
        expiresAt = 0;
    }

    async function notificationsEnabled() {
        if (pending) await pending;
        if (now() < expiresAt) return enabled;
        const startedRevision = revision;
        // Cache failures as well, retaining the last known setting.
        expiresAt = now() + ttlMs;
        pending = (async () => {
            try {
                const value = await load();
                if (revision === startedRevision) enabled = value !== false;
            } catch (error) {
                warn('NOTIFICATION POLICY READ WARNING:', error.message);
            }
        })();
        try {
            await pending;
        } finally {
            pending = null;
        }
        return enabled;
    }

    return { notificationsEnabled, setNotificationsEnabled, invalidate,
        isNotificationDeliveryEnabled: () => enabled };
}

const policy = createNotificationPolicy({
    load: async () => {
        const supabase = require('./supabase');
        const { data, error } = await supabase
            .from('general_settings')
            .select('notifications_enabled')
            .eq('general_settings_id', 1)
            .maybeSingle();
        if (error) throw error;
        return data?.notifications_enabled;
    },
});

module.exports = { ...policy, createNotificationPolicy };
