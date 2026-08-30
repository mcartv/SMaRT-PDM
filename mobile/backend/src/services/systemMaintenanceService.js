const pool = require('../config/db');

const DEFAULT_MAINTENANCE_MESSAGE =
  'SMaRT-PDM is temporarily unavailable while system maintenance is in progress. Please try again later.';

async function getPublicState() {
  const result = await pool.query(
    `SELECT
       COALESCE(maintenance_mode, false) AS maintenance_mode,
       COALESCE(NULLIF(BTRIM(maintenance_message), ''), $1) AS maintenance_message,
       updated_at
     FROM public.general_settings
     WHERE general_settings_id = 1
     LIMIT 1`,
    [DEFAULT_MAINTENANCE_MESSAGE]
  );

  const row = result.rows[0] || {};
  return {
    maintenance_mode: row.maintenance_mode === true,
    maintenance_message: row.maintenance_message || DEFAULT_MAINTENANCE_MESSAGE,
    updated_at: row.updated_at || null,
  };
}

module.exports = { getPublicState };
