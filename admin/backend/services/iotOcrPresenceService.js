const ONLINE_TTL_MS = Math.max(
    5000,
    Number(process.env.IOT_OCR_PI_ONLINE_TTL_MS || 12000)
);

const devices = new Map();

let availabilityListener = null;
let expiryTimer = null;
let lastPublishedSignature = null;

function pruneExpiredDevices(now = Date.now()) {
    for (const [deviceId, seenAt] of devices.entries()) {
        if (now - seenAt > ONLINE_TTL_MS) {
            devices.delete(deviceId);
        }
    }
}

function buildAvailability(now = Date.now()) {
    pruneExpiredDevices(now);

    const online = devices.size > 0;
    const lastSeenAt = online ? Math.max(...devices.values()) : null;

    return {
        online,
        device_count: devices.size,
        last_seen_at: lastSeenAt
            ? new Date(lastSeenAt).toISOString()
            : null,
        ttl_ms: ONLINE_TTL_MS,
    };
}

function availabilitySignature(availability) {
    return JSON.stringify({
        online: availability.online === true,
        device_count: Number(availability.device_count || 0),
    });
}

function publishIfChanged() {
    const availability = buildAvailability();
    const signature = availabilitySignature(availability);

    if (signature === lastPublishedSignature) {
        return availability;
    }

    lastPublishedSignature = signature;

    if (typeof availabilityListener === 'function') {
        try {
            availabilityListener(availability);
        } catch (error) {
            console.error(
                '[IoT OCR Presence] availability listener failed:',
                error?.message || error
            );
        }
    }

    return availability;
}

function scheduleExpiryCheck() {
    if (expiryTimer) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
    }

    if (!devices.size) return;

    const now = Date.now();
    const earliestSeenAt = Math.min(...devices.values());
    const delay = Math.max(
        100,
        earliestSeenAt + ONLINE_TTL_MS - now + 50
    );

    expiryTimer = setTimeout(() => {
        expiryTimer = null;
        publishIfChanged();
        scheduleExpiryCheck();
    }, delay);

    expiryTimer.unref?.();
}

function checkIn(deviceId) {
    if (!deviceId) return getAvailability();

    devices.set(String(deviceId), Date.now());

    const availability = publishIfChanged();
    scheduleExpiryCheck();

    return availability;
}

function getAvailability() {
    return publishIfChanged();
}

function setAvailabilityListener(listener) {
    availabilityListener =
        typeof listener === 'function' ? listener : null;

    // Establish the baseline state immediately. If no browser is connected yet,
    // Socket.IO simply has no recipient; later changes still emit normally.
    publishIfChanged();
    scheduleExpiryCheck();

    return () => {
        if (availabilityListener === listener) {
            availabilityListener = null;
        }
    };
}

module.exports = {
    checkIn,
    getAvailability,
    setAvailabilityListener,
};