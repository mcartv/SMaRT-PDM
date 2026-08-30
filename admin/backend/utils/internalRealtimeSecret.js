const crypto = require('crypto');

const DERIVATION_NAMESPACE = 'smart-pdm-internal-realtime-v1';

function resolveInternalRealtimeSecret() {
  const explicit = String(process.env.INTERNAL_REALTIME_SECRET || '').trim();
  if (explicit) return explicit;

  // Both deployed backends already need the same Supabase service-role key.
  // Derive an internal-only relay secret from that key instead of sending the
  // service-role key itself or making realtime depend on another required env.
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
