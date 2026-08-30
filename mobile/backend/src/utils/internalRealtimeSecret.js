const crypto = require('crypto');

const DERIVATION_NAMESPACE = 'smart-pdm-internal-realtime-v1';

function resolveInternalRealtimeSecret() {
    const explicit = String(
        process.env.INTERNAL_REALTIME_SECRET || ''
    ).trim();

    if (explicit) return explicit;

    // Keep Admin <-> Mobile realtime working when an explicit relay secret was
    // not added to Render yet. The service-role key itself is never transmitted.
    const sharedServiceKey = String(
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    ).trim();

    if (!sharedServiceKey) return '';

    return crypto
        .createHash('sha256')
        .update(`${DERIVATION_NAMESPACE}:${sharedServiceKey}`)
        .digest('hex');
}

module.exports = {
    resolveInternalRealtimeSecret,
};
