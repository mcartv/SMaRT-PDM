const ONLINE_TTL_MS = Math.max(5000, Number(process.env.IOT_OCR_PI_ONLINE_TTL_MS || 12000));
const devices = new Map();

function checkIn(deviceId) {
    if (deviceId) devices.set(String(deviceId), Date.now());
}

function getAvailability() {
    const now = Date.now();
    for (const [deviceId, seenAt] of devices.entries()) {
        if (now - seenAt > ONLINE_TTL_MS) devices.delete(deviceId);
    }
    const online = devices.size > 0;
    const lastSeenAt = online ? Math.max(...devices.values()) : null;
    return {
        online,
        device_count: devices.size,
        last_seen_at: lastSeenAt ? new Date(lastSeenAt).toISOString() : null,
        ttl_ms: ONLINE_TTL_MS,
    };
}

module.exports = { checkIn, getAvailability };
