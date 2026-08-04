const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value) {
    const normalized = String(value || '').trim();
    return UUID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

function normalizeDeviceId(value) {
    return normalizeUuid(value);
}

function normalizeUserId(value) {
    return normalizeUuid(value);
}

function resolveActorUserId(req = {}) {
    return normalizeUserId(
        req.user?.user_id ||
        req.user?.userId ||
        req.user?.admin_id ||
        req.user?.id ||
        req.user?.sub ||
        req.adminSession?.user_id ||
        null
    );
}

module.exports = {
    UUID_PATTERN,
    normalizeUuid,
    normalizeDeviceId,
    normalizeUserId,
    resolveActorUserId,
};
