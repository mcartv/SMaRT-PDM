// SMaRT-PDM: db — db (admin backend config); configures shared backend infrastructure.
const { Pool } = require('pg');
require('dotenv').config();

function positiveInteger(value, fallback, minimum = 1) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Session-pooler slots are shared by deployed and local backend processes.
    // Reserve capacity for the scheduler's persistent connection and requests.
    max: positiveInteger(process.env.DB_POOL_MAX, 4, 4),
    idleTimeoutMillis: positiveInteger(process.env.DB_IDLE_TIMEOUT_MS, 5000),
    connectionTimeoutMillis: positiveInteger(process.env.DB_CONNECTION_TIMEOUT_MS, 10000),
    application_name: 'smartpdm-admin',
    keepAlive: true,
    ssl: {
        rejectUnauthorized: false // Required for Supabase/hosted SSL connections
    }
});

pool.on('error', error => {
    console.error('[Database pool]', error.code || 'CONNECTION_ERROR', error.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
};
